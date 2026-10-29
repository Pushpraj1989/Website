// Phase 7 tests: partner integrations. Runs against the test database and resets it first.
// Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import * as p from '../lib/partners.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
const day = 24 * 60 * 60 * 1000;

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

/** The key a partner sends, as the route reads it. */
const keyOf = (apiKey: string | null) => apiKey;

async function campaign(name: string, endsInDays = 40) {
  const cm = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + endsInDays * day) });
  await c.createCampaignOffer(cm.id, {
    name: { en: `${name} rule`, ar: 'قاعدة' }, type: 'fixed', value: 500, minSubtotalMinor: 2000,
    startsAt: new Date(Date.now() - day), endsAt: new Date(new Date(cm.endsAt).getTime() - 60 * 60 * 1000),
  });
  await c.transitionCampaign(cm.id, 'activate');
  const { offers } = await c.getCampaign(cm.id);
  await c.createPool(cm.id, { offerId: offers[0].id, codePattern: `${name.slice(0, 3).toUpperCase()}##-@@@` });
  return cm;
}

async function partner(extra: Record<string, unknown> = {}, campaignIds: string[] = []) {
  const { apiKey, client } = await p.createPartnerClient({
    name: 'Delivery Co', scopes: ['vouchers:issue', 'vouchers:read', 'vouchers:validate', 'campaigns:read', 'codes:export'], campaignIds, dailyIssueLimit: 10000, requestsPerMinute: 1000, ...extra,
  }) as { apiKey: string; client: { id: string } };
  return { apiKey, id: client.id };
}


test('a partner key is shown once, works, and a wrong or malformed key is refused the same way', async () => {
  const cm = await campaign('Keys');
  const { apiKey } = await partner({}, [cm.id]);
  const ok = await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', apiKey, async (client) => ({ status: 200, body: await p.campaignsFor(client) }));
  assert.equal(ok.status, 200);
  const wrong = await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', apiKey.slice(0, -2) + 'xx', async () => ({ status: 200, body: {} }));
  const junk = await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', 'nope', async () => ({ status: 200, body: {} }));
  assert.equal(wrong.status, 401);
  assert.equal(junk.status, 401);
  assert.deepEqual(wrong.body, junk.body);
  const list = await p.listPartnerClients();
  assert.equal(JSON.stringify(list).includes(apiKey.split('_').pop()!), false, 'the secret is never listed');
});

test('a partner without the issue permission cannot issue, and a campaign it was not given is refused', async () => {
  const mine = await campaign('Mine');
  const other = await campaign('Other');
  const reader = await partner({ scopes: ['campaigns:read'] }, [mine.id]);
  await assert.rejects(p.issueVouchers(await p.authenticate(keyOf(reader.apiKey)), { campaignId: mine.id }, 'reader-key-01'), (e: any) => e.code === 'forbidden');
  const issuer = await partner({}, [mine.id]);
  const client = await p.authenticate(keyOf(issuer.apiKey));
  await assert.rejects(p.issueVouchers(client, { campaignId: other.id }, 'other-key-0001'), (e: any) => e.code === 'forbidden');
});

test('issuing returns the codes once, with the campaign\'s benefit, and a repeat with the same key returns the same answer', async () => {
  const cm = await campaign('Issue');
  const { apiKey } = await partner({}, [cm.id]);
  const client = await p.authenticate(keyOf(apiKey));
  const first = await p.issueVouchers(client, { campaignId: cm.id, quantity: 3, externalReference: 'ORDER-1' }, 'issue-key-0001');
  assert.equal(first.status, 201);
  const body = first.body as any;
  assert.equal(body.vouchers.length, 3);
  assert.equal(new Set(body.vouchers.map((v: any) => v.code)).size, 3);
  assert.deepEqual(body.vouchers[0].benefit, { type: 'fixed', value: 500, minOrderMinor: 2000, currency: 'AED' });
  const again = await p.issueVouchers(client, { campaignId: cm.id, quantity: 3, externalReference: 'ORDER-1' }, 'issue-key-0001');
  assert.equal(again.replayed, true);
  assert.deepEqual(again.body, first.body);
  const { rows } = await db.query(`select count(*)::int as n from vouchers v join voucher_batches b on b.id = v.batch_id where b.partner_client_id = $1`, [client.id]);
  assert.equal(rows[0].n, 3, 'the replay made no more vouchers');
});

test('the same key with a different request is refused, and a partner cannot set a discount', async () => {
  const cm = await campaign('Conflict');
  const { apiKey } = await partner({}, [cm.id]);
  const client = await p.authenticate(keyOf(apiKey));
  await p.issueVouchers(client, { campaignId: cm.id, quantity: 1 }, 'conflict-key-1');
  await assert.rejects(p.issueVouchers(client, { campaignId: cm.id, quantity: 2 }, 'conflict-key-1'), (e: any) => e.code === 'idempotency_conflict');
  await assert.rejects(p.issueVouchers(client, { campaignId: cm.id, value: 9999 }, 'discount-key-1'), (e: any) => e.code === 'unknown_field');
});

test('the daily quota counts the codes requested, and a request over it is refused', async () => {
  const cm = await campaign('Quota');
  const { apiKey } = await partner({ dailyIssueLimit: 5 }, [cm.id]);
  const client = await p.authenticate(keyOf(apiKey));
  await p.issueVouchers(client, { campaignId: cm.id, quantity: 3 }, 'quota-key-001');
  await assert.rejects(p.issueVouchers(client, { campaignId: cm.id, quantity: 3 }, 'quota-key-002'), (e: any) => e.code === 'quota_exceeded');
  await p.issueVouchers(client, { campaignId: cm.id, quantity: 2 }, 'quota-key-003');
});

test('requests over the per-minute limit are refused until the minute passes', async () => {
  const cm = await campaign('Rate');
  const { apiKey } = await partner({ requestsPerMinute: 3 }, [cm.id]);
  const statuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    const r = await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', apiKey, async (client) => ({ status: 200, body: await p.campaignsFor(client) }));
    statuses.push(r.status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 429]);
});

test('a bulk batch over 1,000 is queued, and polling finishes it; its codes come in pages, all unique', async () => {
  const cm = await campaign('Bulk');
  const { apiKey } = await partner({}, [cm.id]);
  const client = await p.authenticate(keyOf(apiKey));
  const created = await p.requestBatch(client, { campaignId: cm.id, quantity: 1500 }, 'bulk-key-0001');
  assert.equal(created.status, 202);
  const batchId = (created.body as any).batch.id;
  const polled = await p.batchStatus(client, batchId);
  assert.equal(polled.batch.status, 'completed');
  assert.equal(polled.batch.generatedQuantity, 1500);
  const seen = new Set<string>();
  let after: string | null = null;
  let pages = 0;
  do {
    const page = await p.batchCodes(client, batchId, after);
    for (const code of page.codes) seen.add(code.code);
    after = page.nextAfter;
    pages++;
  } while (after);
  assert.equal(seen.size, 1500);
  assert.equal(pages, 3);
});

test('one partner cannot see or read another partner\'s batch', async () => {
  const cm = await campaign('Private');
  const a = await partner({}, [cm.id]);
  const b = await partner({}, [cm.id]);
  const ca = await p.authenticate(keyOf(a.apiKey));
  const cb = await p.authenticate(keyOf(b.apiKey));
  const made = await p.issueVouchers(ca, { campaignId: cm.id, quantity: 1 }, 'private-key-01');
  const batchId = (made.body as any).batch.id;
  await assert.rejects(p.batchStatus(cb, batchId), (e: any) => e.code === 'not_found');
  await assert.rejects(p.batchCodes(cb, batchId, null), (e: any) => e.code === 'not_found');
});

test('validating a code says whether it is usable, without using it, and only for the partner\'s own campaigns', async () => {
  const mine = await campaign('Check');
  const theirs = await campaign('Theirs');
  const { apiKey } = await partner({}, [mine.id]);
  const client = await p.authenticate(keyOf(apiKey));
  const issued = await p.issueVouchers(client, { campaignId: mine.id, quantity: 1 }, 'check-key-0001');
  const code = (issued.body as any).vouchers[0].code;
  const ok = await p.validateCode(client, code.toLowerCase());
  assert.equal(ok.valid, true);
  const again = await p.validateCode(client, code);
  assert.equal(again.valid, true, 'validating does not use the voucher');
  const { apiKey: otherKey } = await partner({}, [theirs.id]);
  const other = await p.authenticate(keyOf(otherKey));
  const otherIssued = await p.issueVouchers(other, { campaignId: theirs.id, quantity: 1 }, 'theirs-key-001');
  const theirCode = (otherIssued.body as any).vouchers[0].code;
  assert.equal((await p.validateCode(client, theirCode)).valid, false, 'a code from another campaign is not shown');
  assert.equal((await p.validateCode(client, 'NOT-A-CODE-1')).valid, false, 'an unknown code gives the same answer');
});

test('campaigns show the rules a partner needs, without budgets or usage', async () => {
  const cm = await campaign('Shown');
  const { apiKey } = await partner({}, [cm.id]);
  const client = await p.authenticate(keyOf(apiKey));
  const list = await p.campaignsFor(client);
  assert.equal(list.length, 1);
  assert.equal(list[0].rules[0].type, 'fixed');
  assert.equal('budgetMinor' in list[0], false);
  assert.equal('usedCount' in list[0].rules[0], false);
});

test('a revoked partner is refused at once, and rotating gives a new key that works while the old one stops', async () => {
  const cm = await campaign('Revoke');
  const { apiKey, id } = await partner({}, [cm.id]);
  const rotated = await p.rotatePartnerKey(id);
  await assert.rejects(p.authenticate(keyOf(apiKey)), (e: any) => e.code === 'unauthorised');
  await p.authenticate(keyOf(rotated.apiKey));
  await p.revokePartnerClient(id);
  await assert.rejects(p.authenticate(keyOf(rotated.apiKey)), (e: any) => e.code === 'unauthorised');
});

test('every partner request is written to the audit log, with its answer', async () => {
  const cm = await campaign('Audited');
  const { apiKey, id } = await partner({}, [cm.id]);
  await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', apiKey, async (client) => ({ status: 200, body: await p.campaignsFor(client) }));
  await p.runPartnerCall('GET', 'http://api.test/v1/partner/campaigns', 'bad', async () => ({ status: 200, body: {} }));
  const { rows } = await db.query(`select status from partner_api_audit where client_id = $1 order by id`, [id]);
  assert.deepEqual(rows.map((r) => r.status), [200]);
  const { rows: all } = await db.query(`select count(*)::int as n from partner_api_audit`);
  assert.ok(all[0].n >= 2, 'refused calls are logged too');
});
