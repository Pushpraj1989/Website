// Phase 9 release-gate tests: tenant isolation, concurrent redemption, code collisions, and the refund policy.
// Runs against the test database and resets it first.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import * as data from '../lib/data.ts';
import * as r from '../lib/reports.ts';
import { revokeVoucher } from '../lib/operations.ts';
import { applyCartCode, placeOrder, hashToken, setOrderStatus, RuleError } from '../lib/orders.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-0000000000aa';
const SALAD = '00000000-0000-4000-8000-000000000101';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 6 });
const day = 24 * 60 * 60 * 1000;

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

async function guest() {
  const id = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(id, [{ itemId: SALAD, qty: 1, note: '' }]);
  return id;
}

async function campaignWithPool(name: string, pattern = 'GAT##-@@@', restaurant = RESTAURANT) {
  const cm = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  if (restaurant !== RESTAURANT) await db.query(`update campaigns set restaurant_id = $2 where id = $1`, [cm.id, restaurant]);
  await c.createCampaignOffer(cm.id, { name: { en: name, ar: name }, type: 'fixed', value: 300, startsAt: new Date(Date.now() - day), endsAt: new Date(new Date(cm.endsAt).getTime() - 3600000) });
  await c.transitionCampaign(cm.id, 'activate');
  const { offers } = await c.getCampaign(cm.id);
  const pool = await c.createPool(cm.id, { offerId: offers[0].id, codePattern: pattern });
  return { campaign: cm, pool };
}

test('tenant isolation: another restaurant\'s campaigns, reports and vouchers are invisible here', async () => {
  // A copy of the restaurant row under a new id, made on one connection in one transaction.
  const conn = await db.connect();
  try {
    await conn.query('begin');
    await conn.query(`create temp table r2 on commit drop as select * from restaurant where id = $1`, [RESTAURANT]);
    await conn.query(`update r2 set id = $1, name_en = 'Other kitchen'`, [OTHER]);
    await conn.query(`insert into restaurant select * from r2`);
    await conn.query('commit');
  } finally {
    conn.release();
  }
  const mine = await campaignWithPool('Mine');
  // The other restaurant's records are written directly: the library only ever writes the restaurant it serves.
  const cm = await db.query(
    `insert into campaigns (restaurant_id, name, status, starts_at, ends_at) values ($1, 'Theirs', 'active', now() - interval '1 day', now() + interval '40 days') returning id`,
    [OTHER],
  );
  const offer = await db.query(
    `insert into offers (restaurant_id, campaign_id, name_en, name_ar, offer_type, value_int, applies_to, audience, min_subtotal_minor, starts_at, ends_at, active)
     values ($1, $2, 'Theirs', 'لهم', 'fixed', 300, 'order', 'any', 0, now() - interval '1 day', now() + interval '39 days', true) returning id`,
    [OTHER, cm.rows[0].id],
  );
  const pool = await db.query(`insert into voucher_pools (campaign_id, offer_id, code_pattern) values ($1, $2, 'OTH##-@@@') returning id`, [cm.rows[0].id, offer.rows[0].id]);
  const { encryptSecret } = await import('../lib/crypto.ts');
  await db.query(
    `insert into vouchers (pool_id, offer_id, code_hash, code_ciphertext, expires_at) values ($1, $2, $3, $4, now() + interval '10 days')`,
    [pool.rows[0].id, offer.rows[0].id, c.codeHash('OTH-0001'), encryptSecret('OTH-0001')],
  );
  const theirs = { campaign: { id: cm.rows[0].id as string }, pool: { id: pool.rows[0].id as string } };
  const list = await c.listCampaigns();
  assert.ok(list.some((x) => x.id === mine.campaign.id));
  assert.ok(!list.some((x) => x.id === theirs.campaign.id), 'the other restaurant\'s campaign is not listed');
  await expectRule(c.getCampaign(theirs.campaign.id), 'not_found');
  await expectRule(c.getPool(theirs.pool.id), 'not_found');
  const rep = await r.campaignReport();
  assert.ok(!rep.some((x) => x.id === theirs.campaign.id), 'not in the report');
  const { rows } = await db.query(`select id from vouchers where code_hash = $1`, [c.codeHash('OTH-0001')]);
  await expectRule(revokeVoucher(rows[0].id, 'owner', 'not ours to revoke'), 'not_found');
});

test('two cash checkouts that both hold a single-use voucher: exactly one order gets it', async () => {
  const { pool } = await campaignWithPool('Race cash', 'RCE##-@@@');
  await c.addManualCode(pool.id, { code: 'RACE-CASH1', expiresAt: new Date(Date.now() + 10 * day) });
  const a = await guest();
  const b = await guest();
  await applyCartCode(a, null, 'RACE-CASH1', 'pickup', null);
  await applyCartCode(b, null, 'RACE-CASH1', 'pickup', null);
  const results = await Promise.allSettled([
    placeOrder({ guestId: a, accountId: null, idempotencyKey: 'race-cash-a-01', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' }),
    placeOrder({ guestId: b, accountId: null, idempotencyKey: 'race-cash-b-01', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' }),
  ]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  const redemptions = await db.query(`select count(*)::int as n from offer_redemptions r join vouchers v on v.id = r.voucher_id where v.code_hash = $1`, [c.codeHash('RACE-CASH1')]);
  assert.equal(redemptions.rows[0].n, 1, 'one redemption, never two');
});

test('a code collision retries, and when the whole code space is taken it stops with no partial batch', async () => {
  const { pool } = await campaignWithPool('Full space', 'ZZ-#');
  for (let i = 0; i < 10; i++) {
    await c.addManualCode(pool.id, { code: `ZZ-${i}`, expiresAt: new Date(Date.now() + 10 * day) });
  }
  const before = (await db.query(`select count(*)::int as n from vouchers where pool_id = $1`, [pool.id])).rows[0].n;
  await expectRule(c.createBatch(pool.id, { quantity: 1, expiresAt: new Date(Date.now() + 10 * day) }, 'full-space-0001'), 'collision');
  const after = (await db.query(`select count(*)::int as n from vouchers where pool_id = $1`, [pool.id])).rows[0].n;
  assert.equal(after, before, 'nothing partly made');
  const batches = (await db.query(`select count(*)::int as n from voucher_batches where pool_id = $1`, [pool.id])).rows[0].n;
  assert.equal(batches, 0, 'the batch record was rolled back too');
  assert.equal((await c.getPool(pool.id)).pool.issuedCount, 10, 'the issued count did not move');
});

test('a delivered order cannot be cancelled, so its voucher is not reversed', async () => {
  const { pool } = await campaignWithPool('Delivered', 'DLV##-@@@');
  await c.addManualCode(pool.id, { code: 'DLVR-0001', expiresAt: new Date(Date.now() + 10 * day) });
  const g = await guest();
  await applyCartCode(g, null, 'DLVR-0001', 'pickup', null);
  const order = await placeOrder({ guestId: g, accountId: null, idempotencyKey: 'delivered-order-1', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  for (const to of ['accepted', 'preparing', 'ready', 'collected'] as const) await setOrderStatus(order.id, to);
  await expectRule(setOrderStatus(order.id, 'cancelled'), 'bad_transition');
  const { rows } = await db.query(`select status from vouchers where code_hash = $1`, [c.codeHash('DLVR-0001')]);
  assert.equal(rows[0].status, 'redeemed', 'the voucher stays used');
  void RuleError;
});
