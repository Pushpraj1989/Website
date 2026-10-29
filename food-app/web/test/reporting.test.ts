// Phase 8 tests: reports, reconciliation, controlled revocation and the audit trail. Runs against the test database.
// Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import * as data from '../lib/data.ts';
import * as r from '../lib/reports.ts';
import { revokeVoucher, auditTrail } from '../lib/operations.ts';
import { applyCartCode, placeOrder, hashToken, setOrderStatus } from '../lib/orders.ts';
import { createPartnerClient, runPartnerCall, rotatePartnerKey } from '../lib/partners.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const SALAD = '00000000-0000-4000-8000-000000000101';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
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

async function guest(qty = 2) {
  const id = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(id, [{ itemId: SALAD, qty, note: '' }]);
  return id;
}

/** A campaign with a fixed rule, a pool, and the voucher codes given. */
async function campaign(name: string, funding: string, codes: string[]) {
  const cm = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day), fundingSource: funding });
  await c.createCampaignOffer(cm.id, { name: { en: name, ar: name }, type: 'fixed', value: 500, minSubtotalMinor: 2000, startsAt: new Date(Date.now() - day), endsAt: new Date(new Date(cm.endsAt).getTime() - 3600000) });
  await c.transitionCampaign(cm.id, 'activate', 'owner', 'launch');
  const { offers } = await c.getCampaign(cm.id);
  const pool = await c.createPool(cm.id, { offerId: offers[0].id, codePattern: 'RPT##-@@@' });
  for (const code of codes) await c.addManualCode(pool.id, { code, expiresAt: new Date(Date.now() + 20 * day) });
  return { cm, pool };
}

const voucherIdOf = async (code: string) => (await db.query(`select id from vouchers where code_hash = $1`, [c.codeHash(code)])).rows[0]?.id;

test('the campaign report counts what was issued, used, expired and revoked, and what it cost', async () => {
  const { cm } = await campaign('Report', 'platform', ['RPT-USED1', 'RPT-SPARE', 'RPT-OLD01', 'RPT-GONE1']);
  const g = await guest();
  await applyCartCode(g, null, 'RPT-USED1', 'pickup', null);
  await placeOrder({ guestId: g, accountId: null, idempotencyKey: 'report-order-01', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  await db.query(`update vouchers set expires_at = now() - interval '1 day' where id = $1`, [await voucherIdOf('RPT-OLD01')]);
  await revokeVoucher(await voucherIdOf('RPT-GONE1'), 'owner', 'printed in error');
  const row = (await r.campaignReport()).find((x) => x.id === cm.id)!;
  assert.equal(row.issued, 4);
  assert.equal(row.redeemed, 1);
  assert.equal(row.redemptions, 1);
  assert.equal(row.discountMinor, 500);
  assert.equal(row.available, 1);
  assert.equal(row.expired, 1);
  assert.equal(row.revoked, 1);
  assert.equal(row.fundedBy, 'Platform');
  assert.equal(row.redemptionRate, 25);
});

test('the records agree with each other, and a broken record is reported, not hidden', async () => {
  await campaign('Agree', 'restaurant', ['AGR-USED01']);
  const g = await guest();
  await applyCartCode(g, null, 'AGR-USED01', 'pickup', null);
  await placeOrder({ guestId: g, accountId: null, idempotencyKey: 'agree-order-01', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  const clean = await r.reconciliation();
  assert.ok(clean.every((x) => x.count === 0), JSON.stringify(clean));
  const used = await voucherIdOf('AGR-USED01');
  await db.query(`update vouchers set status = 'available' where id = $1`, [used]);
  const broken = await r.reconciliation();
  assert.equal(broken.find((x) => x.name === 'record-without-redemption')!.count, 1);
  await db.query(`update vouchers set status = 'redeemed' where id = $1`, [used]);
  assert.ok((await r.reconciliation()).every((x) => x.count === 0));
});

test('a voucher can be revoked with a reason, and the revocation is in the audit trail', async () => {
  await campaign('Revoke me', 'restaurant', ['REV-0001']);
  const id = await voucherIdOf('REV-0001');
  await expectRule(revokeVoucher(id, 'owner', 'x'), 'bad_input');
  await revokeVoucher(id, 'owner', 'duplicate print');
  const trail = await auditTrail('voucher', id);
  assert.equal(trail.length, 1);
  assert.equal(trail[0].action, 'revoke');
  assert.equal((trail[0].detail as { reason: string }).reason, 'duplicate print');
  await expectRule(revokeVoucher(id, 'owner', 'again please'), 'already_revoked');
});

test('a used voucher cannot be revoked, and a voucher held by an open checkout cannot be either', async () => {
  await campaign('Protected', 'restaurant', ['PRO-USED1', 'PRO-HELD1']);
  const g = await guest();
  await applyCartCode(g, null, 'PRO-USED1', 'pickup', null);
  await placeOrder({ guestId: g, accountId: null, idempotencyKey: 'protected-order-1', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  await expectRule(revokeVoucher(await voucherIdOf('PRO-USED1'), 'owner', 'try it'), 'already_redeemed');
  const h = await guest();
  await applyCartCode(h, null, 'PRO-HELD1', 'pickup', null);
  const card = await placeOrder({ guestId: h, accountId: null, idempotencyKey: 'protected-card-1', channel: 'pickup', method: 'card', addressId: null, locale: 'en' });
  await expectRule(revokeVoucher(await voucherIdOf('PRO-HELD1'), 'owner', 'try it'), 'held_by_order');
  await setOrderStatus(card.id, 'cancelled');
  await revokeVoucher(await voucherIdOf('PRO-HELD1'), 'owner', 'after the checkout ended');
});

test('cancelling a campaign records who did it and why', async () => {
  const { cm } = await campaign('Cancelled', 'shared', []);
  await c.transitionCampaign(cm.id, 'cancel', 'owner', 'partner withdrew');
  const trail = await auditTrail('campaign', cm.id);
  const last = trail[trail.length - 1];
  assert.equal(last.action, 'cancel');
  assert.equal(last.actor, 'owner');
  assert.equal((last.detail as { reason: string }).reason, 'partner withdrew');
});

test('the funding report splits what was given by who paid for it', async () => {
  const { cm } = await campaign('Shared pay', 'shared', ['SHR-USED1']);
  const g = await guest();
  await applyCartCode(g, null, 'SHR-USED1', 'pickup', null);
  await placeOrder({ guestId: g, accountId: null, idempotencyKey: 'shared-order-01', channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  const funding = await r.fundingReport();
  const shared = funding.find((f) => f.fundedBy === 'Shared');
  assert.ok(shared && shared.discountMinor >= 500, 'the shared campaign\'s discount is counted under Shared');
  void cm;
});

test('partner use is reported: codes requested, validations and refused requests', async () => {
  const { cm } = await campaign('Partner use', 'restaurant', []);
  const created = await createPartnerClient({ name: 'Report Partner', scopes: ['vouchers:validate', 'campaigns:read'], campaignIds: [cm.id], dailyIssueLimit: 100, requestsPerMinute: 100 });
  await runPartnerCall('POST', 'http://api.test/v1/partner/vouchers/validate', created.apiKey, async () => ({ status: 200, body: { valid: false } }));
  await runPartnerCall('POST', 'http://api.test/v1/partner/vouchers/validate', 'bad-key', async () => ({ status: 200, body: {} }));
  const row = (await r.partnerReport()).find((p) => p.name === 'Report Partner')!;
  assert.equal(row.validations, 1);
  assert.equal(row.refused, 0, 'a bad key is not logged against a partner');
  assert.equal(row.requests, 1);
  await rotatePartnerKey(created.client.id, 'owner');
  const trail = await auditTrail('partner', created.client.id);
  assert.deepEqual(trail.map((t) => t.action), ['create', 'rotate_key']);
  assert.equal(trail[1].actor, 'owner');
});

test('a batch that stopped is listed, with the reason', async () => {
  const { pool } = await campaign('Stopped batch', 'restaurant', []);
  const { rows } = await db.query(
    `insert into voucher_batches (pool_id, requested_quantity, generated_quantity, status, idempotency_key, error_details)
     values ($1, 50, 10, 'failed', 'stopped-batch-01', 'The campaign stopped before the batch finished.') returning id`,
    [pool.id],
  );
  const failed = await r.failedBatches();
  const hit = failed.find((f) => f.id === rows[0].id)!;
  assert.equal(hit.generated, 10);
  assert.match(hit.reason, /campaign stopped/);
});

test('the CSV for finance has a header and one row per campaign', async () => {
  await campaign('Finance row', 'restaurant', []);
  const csv = await r.campaignsCsv();
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'campaign,status,funded_by,issued,available,redeemed,expired,revoked,redemptions,discount_minor,redemption_rate_percent');
  assert.ok(lines.some((l) => l.startsWith('Finance row,')));
});

test('the promotion report brings the parts together, and says when everything reconciles', async () => {
  const full = await r.promotionsReport();
  assert.ok(full.summary.issued >= 1);
  assert.equal(typeof full.reconciled, 'boolean');
  assert.ok(Array.isArray(full.campaigns) && Array.isArray(full.partners) && Array.isArray(full.issuance));
});
