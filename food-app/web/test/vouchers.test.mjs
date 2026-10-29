// Database tests for the voucher schema (db/vouchers.sql). Each test runs in a transaction that is rolled back, so the
// shared test database keeps none of the rows. Run: DATABASE_URL=... node --test test/vouchers.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const HASH = (n) => n.toString(16).padStart(64, '0');

async function inTransaction(fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await fn(client);
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

// Expects a statement to fail with the given constraint or message, without ending the surrounding transaction.
async function expectFailure(client, sql, params, pattern) {
  await client.query('savepoint probe');
  try {
    await client.query(sql, params);
    assert.fail(`expected failure: ${pattern}`);
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err;
    assert.match(err.message, pattern);
  } finally {
    await client.query('rollback to savepoint probe');
  }
}

async function fixtures(client) {
  const account = await client.query(`insert into accounts (name, phone) values ('Test', '+9715' || lpad((floor(random()*1e7))::text, 7, '0')) returning id`);
  const offer = await client.query(
    `insert into offers (restaurant_id, name_en, name_ar, offer_type, value_int, starts_at, ends_at)
     values ($1, 'Test offer', 'عرض', 'percent', 1000, now(), now() + interval '30 days') returning id`,
    [RESTAURANT],
  );
  const campaign = await client.query(
    `insert into campaigns (restaurant_id, name, starts_at, ends_at) values ($1, 'Test campaign', now(), now() + interval '30 days') returning id`,
    [RESTAURANT],
  );
  const pool = await client.query(
    `insert into voucher_pools (campaign_id, offer_id, code_pattern, quantity_limit) values ($1, $2, 'FOOD@@@###', 3) returning id`,
    [campaign.rows[0].id, offer.rows[0].id],
  );
  return { customerId: account.rows[0].id, offerId: offer.rows[0].id, campaignId: campaign.rows[0].id, poolId: pool.rows[0].id };
}

async function issueVoucher(client, f, n) {
  const { rows } = await client.query(
    `insert into vouchers (pool_id, offer_id, code_hash, expires_at) values ($1, $2, $3, now() + interval '60 days') returning id`,
    [f.poolId, f.offerId, HASH(n)],
  );
  return rows[0].id;
}

test('a campaign must end after it starts and its budget cannot be negative', async () => {
  await inTransaction(async (client) => {
    await expectFailure(client, `insert into campaigns (restaurant_id, name, starts_at, ends_at) values ($1, 'x', now(), now() - interval '1 day')`, [RESTAURANT], /campaigns_check/);
    await expectFailure(client, `insert into campaigns (restaurant_id, name, starts_at, ends_at, budget_minor) values ($1, 'x', now(), now() + interval '1 day', -5)`, [RESTAURANT], /campaigns_budget_minor_check/);
  });
});

test('a voucher code can exist only once, however it was generated', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    await issueVoucher(client, f, 1);
    await expectFailure(client, `insert into vouchers (pool_id, offer_id, code_hash, expires_at) values ($1, $2, $3, now() + interval '1 day')`, [f.poolId, f.offerId, HASH(1)], /vouchers_code_hash_key/);
  });
});

test('a pool cannot issue more vouchers than its limit', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    await expectFailure(client, `update voucher_pools set issued_count = 4 where id = $1`, [f.poolId], /voucher_pools_check/);
  });
});

test('a batch cannot ask for more than the cap or report more than it asked for', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    await expectFailure(client, `insert into voucher_batches (pool_id, requested_quantity, idempotency_key) values ($1, 10001, 'batch-over-cap-1')`, [f.poolId], /requested_quantity_check|voucher_batches_requested_quantity_check/);
    await expectFailure(client, `insert into voucher_batches (pool_id, requested_quantity, generated_quantity, idempotency_key) values ($1, 5, 6, 'batch-too-many-1')`, [f.poolId], /voucher_batches_check/);
  });
});

test('a batch is idempotent: the same key cannot create a second batch', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    await client.query(`insert into voucher_batches (pool_id, requested_quantity, idempotency_key) values ($1, 2, 'same-request-key')`, [f.poolId]);
    await expectFailure(client, `insert into voucher_batches (pool_id, requested_quantity, idempotency_key) values ($1, 2, 'same-request-key')`, [f.poolId], /voucher_batches_idempotency_key_key/);
  });
});

test('saving a voucher to the wallet is one row per customer and voucher, and removing keeps the row', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 2);
    await client.query(`insert into voucher_wallet (customer_id, voucher_id) values ($1, $2)`, [f.customerId, v]);
    await expectFailure(client, `insert into voucher_wallet (customer_id, voucher_id) values ($1, $2)`, [f.customerId, v], /voucher_wallet_pkey/);
    await client.query(`update voucher_wallet set removed_at = now() where customer_id = $1 and voucher_id = $2`, [f.customerId, v]);
    const { rows } = await client.query(`select count(*)::int as n from voucher_wallet where customer_id = $1`, [f.customerId]);
    assert.equal(rows[0].n, 1, 'the removed entry is kept for history');
  });
});

test('a voucher can be held by one checkout at a time', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 3);
    await client.query(`insert into voucher_reservations (voucher_id, customer_id, expires_at) values ($1, $2, now() + interval '10 minutes')`, [v, f.customerId]);
    await expectFailure(client, `insert into voucher_reservations (voucher_id, customer_id, expires_at) values ($1, $2, now() + interval '10 minutes')`, [v, f.customerId], /voucher_reservations_one_hold/);
  });
});

test('a consumed reservation must name the order it was used for', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 4);
    await expectFailure(client, `insert into voucher_reservations (voucher_id, status, expires_at) values ($1, 'consumed', now())`, [v], /voucher_reservations_check/);
  });
});

test('a voucher is redeemed at most once in the offer redemptions table', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 5);
    // Orders from the app are placed by a guest session today (see the note on customer identity in the report).
    const guest = await client.query(`insert into guest_sessions (token_hash) values ($1) returning id`, [HASH(900 + Math.floor(Math.random() * 90))]);
    const order = await client.query(
      `insert into orders (number, restaurant_id, guest_session_id, channel, locale, subtotal_minor, total_minor, currency, payment_method, idempotency_key)
       values ($1, $2, $3, 'pickup', 'en', 1000, 1000, 'AED', 'cod', $4) returning id`,
      [`T-${Date.now()}`, RESTAURANT, guest.rows[0].id, `key-${Date.now()}`],
    );
    const orderId = order.rows[0].id;
    await client.query(`insert into offer_redemptions (offer_id, order_id, guest_key, amount_minor, voucher_id) values ($1, $2, 'guest-key-1', 100, $3)`, [f.offerId, orderId, v]);
    await expectFailure(client, `insert into offer_redemptions (offer_id, order_id, guest_key, amount_minor, voucher_id) values ($1, $2, 'guest-key-2', 100, $3)`, [f.offerId, orderId, v], /offer_redemptions_one_per_voucher/);
  });
});

test('the voucher ledger is append-only', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 6);
    await client.query(`insert into voucher_ledger (voucher_id, event) values ($1, 'issued')`, [v]);
    await expectFailure(client, `update voucher_ledger set event = 'revoked' where voucher_id = $1`, [v], /append-only/);
    await expectFailure(client, `delete from voucher_ledger where voucher_id = $1`, [v], /append-only/);
  });
});

test('a voucher can only be revoked with a revocation time', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const v = await issueVoucher(client, f, 7);
    await expectFailure(client, `update vouchers set status = 'revoked' where id = $1`, [v], /vouchers_check/);
    await expectFailure(client, `update vouchers set revoked_at = now() where id = $1`, [v], /vouchers_check/);
    await client.query(`update vouchers set status = 'revoked', revoked_at = now() where id = $1`, [v]);
  });
});

test('existing offers keep working without a campaign', async () => {
  await inTransaction(async (client) => {
    const f = await fixtures(client);
    const { rows } = await client.query(`select campaign_id from offers where id = $1`, [f.offerId]);
    assert.equal(rows[0].campaign_id, null);
  });
});
