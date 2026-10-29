// Phase 5 tests: the customer wallet. Runs against the test database and resets it first.
// Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import { createAccount } from '../lib/accounts.ts';
import { saveVoucher, walletFor, removeVoucher, MAX_FAILED_SAVES } from '../lib/wallet.ts';
import { codeHash } from '../lib/campaigns.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
const day = 24 * 60 * 60 * 1000;
let phoneSeed = 1000000;

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (err) {
    assert.equal((err as { code?: string }).code, code, (err as Error).message);
    return;
  }
  assert.fail(`expected a ${code} error`);
}

async function account(name: string) {
  phoneSeed++;
  return createAccount(name, `+9715${phoneSeed}`);
}

/** One campaign with a pool that has `quantity` codes. Returns the codes and the voucher ids, in order. */
async function vouchers(name: string, quantity: number) {
  const campaign = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'Ten off', ar: 'خصم' }, type: 'percent', value: 1000, minSubtotalMinor: 3000, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  const pool = await c.createPool(campaign.id, { offerId: offers[0].id, codePattern: `${name.slice(0, 3).toUpperCase()}##-@@@` });
  await c.createBatch(pool.id, { quantity, expiresAt: new Date(Date.now() + 30 * day) }, `wallet-${name}-${quantity}`.padEnd(12, 'x'));
  // The codes are read back from the stored hashes' source: a made code is decrypted by the print path only, so the
  // tests compare by the voucher ids and check codes by re-issuing one known code instead.
  const { rows } = await db.query(`select id from vouchers where pool_id = $1 order by created_at`, [pool.id]);
  return { poolId: pool.id, ids: rows.map((r) => r.id as string) };
}

/** A known code, added by hand, so tests can type it. */
async function knownCode(name: string, code: string, extra: { expiresAt?: Date; assignedTo?: string } = {}) {
  const campaign = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'Ten off', ar: 'خصم' }, type: 'percent', value: 1000, minSubtotalMinor: 3000, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  const p = await c.createPool(campaign.id, { offerId: offers[0].id, codePattern: 'KNW##-@@@' });
  await c.addManualCode(p.id, { code, expiresAt: extra.expiresAt ?? new Date(Date.now() + 20 * day) });
  if (extra.assignedTo) await db.query(`update vouchers set assigned_customer_id = $2 where code_hash = $1`, [codeHash(code), extra.assignedTo]);
  const { rows } = await db.query(`select id from vouchers where code_hash = $1`, [codeHash(code)]);
  return rows[0].id as string;
}

test('saving a valid code adds it to the wallet without using it, and saving twice is one entry', async () => {
  const me = await account('Sara');
  const code = 'WALLET-OK1';
  const id = await knownCode('Save once', code);
  const first = await saveVoucher(me.id, code);
  assert.equal(first.state, 'available');
  await saveVoucher(me.id, code.toLowerCase());
  const { rows } = await db.query(`select status, (select count(*) from voucher_wallet where voucher_id = $1)::int as n from vouchers where id = $1`, [id]);
  assert.equal(rows[0].status, 'available', 'saving does not use the voucher');
  assert.equal(rows[0].n, 1, 'one wallet entry');
  const { rows: ledger } = await db.query(`select count(*)::int as n from voucher_ledger where voucher_id = $1 and event = 'saved'`, [id]);
  assert.equal(ledger[0].n, 2, 'each save is recorded');
});

test('a wrong code gives the same answer whether or not it exists', async () => {
  const me = await account('Omar');
  await knownCode('Exists', 'REAL-CODE1');
  const a = await saveVoucher(me.id, 'NOT-A-CODE1').catch((e) => e);
  const b = await saveVoucher(me.id, 'bad!').catch((e) => e);
  assert.equal(a.code, 'not_valid');
  assert.equal(b.code, 'not_valid');
  assert.equal(a.message, b.message);
});

test('a voucher bound to another customer cannot be saved by someone else, and the answer looks the same', async () => {
  const owner = await account('Owner');
  const stranger = await account('Stranger');
  await knownCode('Bound', 'BOUND-0001', { assignedTo: owner.id });
  await expectRule(saveVoucher(stranger.id, 'BOUND-0001'), 'not_valid');
  const saved = await saveVoucher(owner.id, 'BOUND-0001');
  assert.equal(saved.state, 'available');
});

test('used, expired and revoked vouchers say why they cannot be saved', async () => {
  const me = await account('Layla');
  const expiredId = await knownCode('Old', 'OLD-CODE01', { expiresAt: new Date(Date.now() + 20 * day) });
  await db.query(`update vouchers set expires_at = now() - interval '1 day' where id = $1`, [expiredId]);
  await expectRule(saveVoucher(me.id, 'OLD-CODE01'), 'expired');
  const usedId = await knownCode('Spent', 'SPENT-001');
  await db.query(`update vouchers set status = 'redeemed' where id = $1`, [usedId]);
  await expectRule(saveVoucher(me.id, 'SPENT-001'), 'used');
  const revokedId = await knownCode('Withdrawn', 'GONE-0001');
  await db.query(`update vouchers set status = 'revoked', revoked_at = now() where id = $1`, [revokedId]);
  await expectRule(saveVoucher(me.id, 'GONE-0001'), 'unavailable');
});

test('the wallet groups vouchers as available, used or expired', async () => {
  const me = await account('Nadia');
  await knownCode('Live', 'LIVE-0001');
  await saveVoucher(me.id, 'LIVE-0001');
  const usedId = await knownCode('Done', 'DONE-0001');
  await saveVoucher(me.id, 'DONE-0001');
  await db.query(`update vouchers set status = 'redeemed' where id = $1`, [usedId]);
  const expiredId = await knownCode('Past', 'PAST-0001');
  await saveVoucher(me.id, 'PAST-0001');
  await db.query(`update vouchers set expires_at = now() - interval '1 day' where id = $1`, [expiredId]);
  const w = await walletFor(me.id);
  assert.equal(w.available.length, 1);
  assert.equal(w.used.length, 1);
  assert.equal(w.expired.length, 1);
  assert.equal(w.available[0].discount, '10% OFF');
  assert.equal(w.available[0].minOrderMinor, 3000);
});

test('removing a voucher hides it but keeps it, and saving it again brings it back', async () => {
  const me = await account('Yusuf');
  const id = await knownCode('Remove me', 'REMV-0001');
  await saveVoucher(me.id, 'REMV-0001');
  await removeVoucher(me.id, id);
  assert.equal((await walletFor(me.id)).available.length, 0);
  const { rows } = await db.query(`select status from vouchers where id = $1`, [id]);
  assert.equal(rows[0].status, 'available', 'the voucher itself is kept');
  await saveVoucher(me.id, 'REMV-0001');
  assert.equal((await walletFor(me.id)).available.length, 1);
});

test('one customer cannot see or remove another customer\'s vouchers', async () => {
  const a = await account('Rami');
  const b = await account('Hana');
  const id = await knownCode('Private', 'PRIV-0001');
  await saveVoucher(a.id, 'PRIV-0001');
  assert.equal((await walletFor(b.id)).available.length, 0);
  await expectRule(removeVoucher(b.id, id), 'not_found');
  assert.equal((await walletFor(a.id)).available.length, 1);
});

test('after too many failed attempts, saving is paused for a few minutes', async () => {
  const me = await account('Limited');
  await knownCode('Real', 'LIMIT-0001');
  for (let i = 0; i < MAX_FAILED_SAVES; i++) await expectRule(saveVoucher(me.id, 'WRONG-CODE'), 'not_valid');
  await expectRule(saveVoucher(me.id, 'LIMIT-0001'), 'rate_limited');
});

test('issuing a batch does not put vouchers in anyone\'s wallet', async () => {
  const me = await account('Bystander');
  const { ids } = await vouchers('Batchy', 3);
  assert.equal(ids.length, 3);
  assert.equal((await walletFor(me.id)).available.length, 0);
});
