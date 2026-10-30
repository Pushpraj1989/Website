// Phase 2 tests: campaigns, rules, pools, manual codes and bulk batches, run against the real test database.
// The file resets the database first, so counts are exact. Run: DATABASE_URL=... node --test test/campaigns.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import { decryptSecret } from '../lib/crypto.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
const hour = 60 * 60 * 1000;
const day = 24 * hour;

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

async function runningCampaign(name: string, extra: Record<string, unknown> = {}) {
  const now = Date.now();
  const campaign = await c.createCampaign({ name, startsAt: new Date(now - hour), endsAt: new Date(now + 30 * day), ...extra });
  // The rule must sit inside the campaign's dates, so it ends an hour before the campaign does.
  await c.createCampaignOffer(campaign.id, {
    name: { en: `${name} rule`, ar: 'قاعدة' }, type: 'percent', value: 1000,
    startsAt: new Date(now - hour), endsAt: new Date(new Date(campaign.endsAt).getTime() - hour),
  });
  await c.transitionCampaign(campaign.id, 'activate');
  return campaign;
}

async function pool(campaignId: string, extra: Record<string, unknown> = {}) {
  const { offers } = await c.getCampaign(campaignId);
  return c.createPool(campaignId, { offerId: offers[0].id, codePattern: 'FOOD##@@', ...extra });
}

test('a pattern makes codes of its shape, and only from its alphabets', () => {
  for (let i = 0; i < 200; i++) {
    const code = c.generateCode('FOOD##@@*');
    assert.match(code, /^FOOD\d\d[A-Z][A-Z][A-Z0-9]$/);
  }
  assert.equal(c.patternCombinations('AB##'), 100n);
});

test('a typed code is cleaned up and must be 4 to 30 letters, digits or dashes', () => {
  assert.equal(c.normaliseCode('  food 2-x '), 'FOOD2-X');
  assert.throws(() => c.normaliseCode('ab'), /4 to 30/);
  assert.throws(() => c.normaliseCode('bad code!'), /4 to 30/);
});

test('a campaign cannot start without a rule, and its rule switches on and off with it', async () => {
  const now = Date.now();
  const campaign = await c.createCampaign({ name: 'Lifecycle', startsAt: new Date(now - hour), endsAt: new Date(now + 10 * day) });
  assert.equal(campaign.status, 'draft');
  await expectRule(c.transitionCampaign(campaign.id, 'activate'), 'no_rules');
  await c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 500, startsAt: new Date(now - hour), endsAt: new Date(now + 9 * day) });
  const active = await c.transitionCampaign(campaign.id, 'activate');
  assert.equal(active.campaign.status, 'active');
  const paused = await c.transitionCampaign(campaign.id, 'pause');
  assert.equal(paused.campaign.status, 'paused');
  const { rows: off } = await db.query(`select active from offers where campaign_id = $1`, [campaign.id]);
  assert.equal(off[0].active, false, 'pausing switches the rule off');
  await c.transitionCampaign(campaign.id, 'resume');
  const cancelled = await c.transitionCampaign(campaign.id, 'cancel');
  assert.equal(cancelled.campaign.status, 'cancelled');
  await expectRule(c.transitionCampaign(campaign.id, 'resume'), 'bad_transition');
});

test('a future campaign is scheduled, and a draft can be edited but a running one cannot', async () => {
  const now = Date.now();
  const campaign = await c.createCampaign({ name: 'Later', startsAt: new Date(now + 2 * day), endsAt: new Date(now + 9 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'fixed', value: 500, startsAt: new Date(now + 2 * day), endsAt: new Date(now + 8 * day) });
  const scheduled = await c.transitionCampaign(campaign.id, 'activate');
  assert.equal(scheduled.campaign.status, 'scheduled');
  await expectRule(c.updateCampaign(campaign.id, { name: 'Renamed' }), 'not_editable');
});

test('a rule must fall inside the campaign dates, and a rule code is unique', async () => {
  const now = Date.now();
  const campaign = await c.createCampaign({ name: 'Window', startsAt: new Date(now - hour), endsAt: new Date(now + 5 * day) });
  await expectRule(
    c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 100, startsAt: new Date(now - hour), endsAt: new Date(now + 6 * day) }),
    'bad_input',
  );
  await c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 100, code: 'SPRING10', startsAt: new Date(now - hour), endsAt: new Date(now + 4 * day) });
  const other = await c.createCampaign({ name: 'Other', startsAt: new Date(now - hour), endsAt: new Date(now + 5 * day) });
  await expectRule(
    c.createCampaignOffer(other.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 100, code: 'spring10', startsAt: new Date(now - hour), endsAt: new Date(now + 4 * day) }),
    'duplicate',
  );
});

test('a pool needs a valid pattern and a rule from its own campaign', async () => {
  const a = await runningCampaign('Pool A');
  const b = await runningCampaign('Pool B');
  const { offers: offersB } = await c.getCampaign(b.id);
  await expectRule(c.createPool(a.id, { offerId: offersB[0].id, codePattern: 'FOOD##' }), 'bad_input');
  await expectRule(c.createPool(a.id, { offerId: (await c.getCampaign(a.id)).offers[0].id, codePattern: 'bad pattern!' }), 'bad_input');
});

test('a manual code is unique, stays inside the campaign, and respects the pool limit', async () => {
  const now = Date.now();
  const campaign = await runningCampaign('Manual', { endsAt: new Date(now + 10 * day) });
  const p = await pool(campaign.id, { quantityLimit: 1 });
  const later = new Date(now + 20 * day);
  await expectRule(c.addManualCode(p.id, { code: 'ALPHA-1', expiresAt: later }), 'bad_input');
  const added = await c.addManualCode(p.id, { code: 'alpha-1', expiresAt: new Date(now + 5 * day) });
  assert.equal(added.codeHint, 'HA-1'.slice(-4));
  await expectRule(c.addManualCode(p.id, { code: 'ALPHA-2', expiresAt: new Date(now + 5 * day) }), 'pool_full');
});

test('a batch makes exactly the codes asked for, each unique, stored as keyed hashes and encrypted copies', async () => {
  const campaign = await runningCampaign('Bulk');
  const p = await pool(campaign.id);
  const batch = await c.createBatch(p.id, { quantity: 500, expiresAt: new Date(Date.now() + 10 * day) }, 'bulk-key-0001');
  assert.equal(batch.status, 'completed');
  assert.equal(batch.generatedQuantity, 500);
  const { rows } = await db.query(`select code_hash, code_ciphertext from vouchers where pool_id = $1`, [p.id]);
  assert.equal(rows.length, 500);
  assert.equal(new Set(rows.map((r) => r.code_hash)).size, 500, 'every hash is unique');
  const first = rows[0];
  const code = decryptSecret(first.code_ciphertext);
  assert.match(code, /^FOOD\d\d[A-Z][A-Z]$/);
  assert.equal(first.code_hash, createHmac('sha256', process.env.VOUCHER_CODE_SECRET ?? 'dev-only-voucher-secret').update(code).digest('hex'));
  const { rows: ledger } = await db.query(`select count(*)::int as n from voucher_ledger l join vouchers v on v.id = l.voucher_id where v.pool_id = $1 and l.event = 'issued'`, [p.id]);
  assert.equal(ledger[0].n, 500);
  const after = await c.getPool(p.id);
  assert.equal(after.pool.issuedCount, 500);
});

test('the same idempotency key returns the same batch and creates no more codes', async () => {
  const campaign = await runningCampaign('Replay');
  const p = await pool(campaign.id);
  const first = await c.createBatch(p.id, { quantity: 40, expiresAt: new Date(Date.now() + 10 * day) }, 'replay-key-01');
  const again = await c.createBatch(p.id, { quantity: 40, expiresAt: new Date(Date.now() + 10 * day) }, 'replay-key-01');
  assert.equal(again.id, first.id);
  const { rows } = await db.query(`select count(*)::int as n from vouchers where pool_id = $1`, [p.id]);
  assert.equal(rows[0].n, 40);
  const other = await pool(campaign.id, { codePattern: 'OTHER###' });
  await expectRule(c.createBatch(other.id, { quantity: 5, expiresAt: new Date(Date.now() + 10 * day) }, 'replay-key-01'), 'idempotency_conflict');
});

test('a batch that does not fit the pool is refused whole, with nothing partly made', async () => {
  const campaign = await runningCampaign('Limit');
  const p = await pool(campaign.id, { quantityLimit: 30 });
  await expectRule(c.createBatch(p.id, { quantity: 31, expiresAt: new Date(Date.now() + 10 * day) }, 'limit-key-001'), 'pool_full');
  const { rows } = await db.query(`select count(*)::int as n from vouchers where pool_id = $1`, [p.id]);
  assert.equal(rows[0].n, 0);
});

test('a pattern with too few codes is refused, and a request above the table cap is refused', async () => {
  const campaign = await runningCampaign('Caps');
  const p = await pool(campaign.id, { codePattern: 'ONLY#' });
  await expectRule(c.createBatch(p.id, { quantity: 10001, expiresAt: new Date(Date.now() + 10 * day) }, 'cap-key-0001'), 'bad_input');
  await expectRule(c.createBatch(p.id, { quantity: 100, expiresAt: new Date(Date.now() + 10 * day) }, 'small-key-01'), 'pattern_too_small');
});

test('two batches racing on one pool never issue more than its limit', async () => {
  const campaign = await runningCampaign('Race');
  const p = await pool(campaign.id, { quantityLimit: 600 });
  const expiresAt = new Date(Date.now() + 10 * day);
  const results = await Promise.allSettled([
    c.createBatch(p.id, { quantity: 400, expiresAt }, 'race-key-0001'),
    c.createBatch(p.id, { quantity: 400, expiresAt }, 'race-key-0002'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one batch fits');
  const { rows } = await db.query(`select issued_count, (select count(*) from vouchers where pool_id = $1)::int as n from voucher_pools where id = $1`, [p.id]);
  assert.equal(rows[0].n, 400);
  assert.equal(rows[0].issued_count, 400);
});

test('a batch cannot outlive its campaign', async () => {
  const now = Date.now();
  const campaign = await runningCampaign('Ends soon', { endsAt: new Date(now + 2 * day) });
  const p = await pool(campaign.id);
  await expectRule(c.createBatch(p.id, { quantity: 5, expiresAt: new Date(now + 3 * day) }, 'late-key-0001'), 'bad_input');
});

test('a large batch is queued, finishes in chunks, and every code is unique', async () => {
  const campaign = await runningCampaign('Large');
  const p = await pool(campaign.id, { codePattern: 'BIG####@@' });
  const queued = await c.createBatch(p.id, { quantity: 1300, expiresAt: new Date(Date.now() + 10 * day) }, 'large-key-0001');
  assert.equal(queued.status, 'queued');
  assert.equal(queued.requestedQuantity, 1300);
  const mid = await c.runBatch(queued.id, 1);
  assert.equal(mid.status, 'running');
  assert.equal(mid.generatedQuantity, 500);
  const done = await c.runBatch(queued.id, 5);
  assert.equal(done.status, 'completed');
  const { rows } = await db.query(`select count(*)::int as n, count(distinct code_hash)::int as d from vouchers where batch_id = $1`, [queued.id]);
  assert.equal(rows[0].n, 1300);
  assert.equal(rows[0].d, 1300);
  const pool2 = await c.getPool(p.id);
  assert.equal(pool2.pool.issuedCount, 1300, 'reserved once, not twice');
});

test('a queued batch fails and keeps its codes if the campaign stops before it finishes', async () => {
  const campaign = await runningCampaign('Stopping');
  const p = await pool(campaign.id, { codePattern: 'STOP####@@' });
  const queued = await c.createBatch(p.id, { quantity: 1100, expiresAt: new Date(Date.now() + 10 * day) }, 'stop-key-00001');
  await c.runBatch(queued.id, 1);
  await c.transitionCampaign(campaign.id, 'cancel');
  await expectRule(c.runBatch(queued.id, 1), 'batch_failed');
  const { rows } = await db.query(`select status, generated_quantity from voucher_batches where id = $1`, [queued.id]);
  assert.equal(rows[0].status, 'failed');
  assert.equal(rows[0].generated_quantity, 500);
});

test('a rule can limit how often one customer uses it, never above the uses in total', async () => {
  const now = Date.now();
  const campaign = await c.createCampaign({ name: 'Per customer', startsAt: new Date(now - hour), endsAt: new Date(now + 9 * day) });
  const rule = await c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 500, usageLimit: 50, perCustomerLimit: 2, startsAt: new Date(now - hour), endsAt: new Date(now + 9 * day) });
  assert.equal(rule.perCustomerLimit, 2);
  await expectRule(c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 500, usageLimit: 1, perCustomerLimit: 3, startsAt: new Date(now - hour), endsAt: new Date(now + 9 * day) }), 'bad_input');
  await expectRule(c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 500, perCustomerLimit: 0, startsAt: new Date(now - hour), endsAt: new Date(now + 9 * day) }), 'bad_input');
});
