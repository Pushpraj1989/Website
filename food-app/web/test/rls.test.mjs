// Row level security: a signed-in customer must see only their own rows, a guest's data is invisible to everyone
// without the API, and payments are unreadable from the client. Runs as a non-owner role, like Supabase's client.
// Usage: DATABASE_URL=... node test/rls.test.mjs   (after db/migrate.mjs --reset)
import pg from 'pg';
import assert from 'node:assert/strict';

const url = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
const owner = new pg.Client({ connectionString: url });
await owner.connect();

const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const ITEM = '00000000-0000-4000-8000-000000000101';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const STAFF = '33333333-3333-4333-8333-333333333333';
const ORDER_A = '44444444-4444-4444-8444-444444444441';
const ORDER_B = '44444444-4444-4444-8444-444444444442';
const ORDER_GUEST = '44444444-4444-4444-8444-444444444443';
const GUEST = '55555555-5555-4555-8555-555555555555';

await owner.query('begin');
try {
  // Fixtures: two customers, one staff member, one guest; each customer has an order and an address.
  await owner.query(`delete from payments where order_id in ($1,$2,$3)`, [ORDER_A, ORDER_B, ORDER_GUEST]);
  await owner.query(`delete from orders where id in ($1,$2,$3)`, [ORDER_A, ORDER_B, ORDER_GUEST]);
  await owner.query(`delete from addresses where customer_id in ($1,$2) or guest_session_id = $3`, [A, B, GUEST]);
  await owner.query(`delete from staff where id = $1`, [STAFF]);
  await owner.query(`delete from customers where id in ($1,$2)`, [A, B]);
  await owner.query(`delete from guest_sessions where id = $1`, [GUEST]);
  await owner.query(`delete from auth.users where id in ($1,$2,$3)`, [A, B, STAFF]);
  await owner.query(`insert into auth.users (id, email) values ($1,'a@example.test'),($2,'b@example.test'),($3,'s@example.test')`, [A, B, STAFF]);
  await owner.query(`insert into customers (id, name) values ($1,'Customer A'),($2,'Customer B')`, [A, B]);
  await owner.query(`insert into staff (id, email, name, role, active) values ($1,'s@example.test','Kitchen','kitchen',true)`, [STAFF]);
  await owner.query(`insert into guest_sessions (id, token_hash) values ($1, 'hash-of-guest-token')`, [GUEST]);
  for (const [id, customer, guest, number] of [[ORDER_A, A, null, 'T-A'], [ORDER_B, B, null, 'T-B'], [ORDER_GUEST, null, GUEST, 'T-G']]) {
    await owner.query(
      `insert into orders (id, number, restaurant_id, customer_id, guest_session_id, channel, status, locale, payment_method,
         subtotal_minor, total_minor, currency, idempotency_key, vat_minor)
       values ($1,$2,$3,$4,$5,'pickup','placed','en','pay_on_arrival',1000,1000,'AED',$6,0)`,
      [id, number, RESTAURANT, customer, guest, `key-${number}`],
    );
    await owner.query(
      `insert into order_lines (order_id, menu_item_id, name_en, name_ar, unit_price_minor, qty, line_total_minor)
       values ($1,$2,'Garden salad','سلطة',1000,1,1000)`,
      [id, ITEM],
    );
  }
  await owner.query(`insert into addresses (customer_id, line_1) values ($1,'A street')`, [A]);
  await owner.query(`insert into addresses (customer_id, line_1) values ($1,'B street')`, [B]);
  await owner.query(`insert into payments (order_id, provider, provider_ref, amount_minor, currency, status) values ($1,'stripe','pi_test_a',1000,'AED','captured')`, [ORDER_A]);

  // The client role: no bypass, no ownership, reads only what the policies allow.
  await owner.query(`
    do $$ begin if not exists (select 1 from pg_roles where rolname = 'app_client') then create role app_client nologin; end if; end $$;
    grant usage on schema public to app_client;
    grant select, insert, update, delete on all tables in schema public to app_client;
    grant usage on schema auth to app_client;
    grant execute on function auth.uid() to app_client;
  `);
  await owner.query('commit');
} catch (error) {
  await owner.query('rollback');
  throw error;
}

/** Runs queries as a client that presents a JWT subject, the way Supabase does per request. */
async function asClient(sub, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role app_client');
    if (sub) await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } finally {
    await client.end();
  }
}

const results = [];
const check = (name, fn) => results.push({ name, fn });

check('a customer sees only their own orders', async () => {
  const ids = await asClient(A, (c) => c.query('select id from orders order by number').then((r) => r.rows.map((x) => x.id)));
  assert.deepEqual(ids, [ORDER_A]);
});

check("a customer cannot read another customer's order lines or addresses", async () => {
  const lines = await asClient(A, (c) => c.query('select order_id from order_lines').then((r) => r.rows.map((x) => x.order_id)));
  assert.deepEqual(lines, [ORDER_A]);
  const addresses = await asClient(A, (c) => c.query('select line_1 from addresses').then((r) => r.rows.map((x) => x.line_1)));
  assert.deepEqual(addresses, ['A street']);
});

check("a customer cannot update another customer's profile", async () => {
  const changed = await asClient(A, (c) => c.query('update customers set name = $1 where id = $2', ['hacked', B]));
  assert.equal(changed.rowCount, 0);
  const name = await owner.query('select name from customers where id = $1', [B]);
  assert.equal(name.rows[0].name, 'Customer B');
});

check('a customer cannot insert an order for someone else', async () => {
  await assert.rejects(
    asClient(A, (c) =>
      c.query(
        `insert into orders (number, restaurant_id, customer_id, channel, status, locale, payment_method, subtotal_minor, total_minor, currency, idempotency_key)
         values ('X-1',$1,$2,'pickup','placed','en','pay_on_arrival',1000,1000,'AED','key-x-1')`,
        [RESTAURANT, B],
      ),
    ),
    /row-level security|violates/,
  );
});

check('an anonymous client sees no orders, customers, addresses or payments', async () => {
  for (const table of ['orders', 'order_lines', 'customers', 'addresses', 'payments', 'payment_events', 'refunds', 'audit_log']) {
    const rows = await asClient(null, (c) => c.query(`select count(*)::int as n from ${table}`).then((r) => r.rows[0].n));
    assert.equal(rows, 0, `${table} visible to anonymous`);
  }
});

check('payments and payment events are unreadable by any customer', async () => {
  for (const table of ['payments', 'payment_events', 'refunds']) {
    const n = await asClient(A, (c) => c.query(`select count(*)::int as n from ${table}`).then((r) => r.rows[0].n));
    assert.equal(n, 0, `${table} visible to a customer`);
  }
});

check('a staff member reads every order, but not payments', async () => {
  const ids = await asClient(STAFF, (c) => c.query('select id from orders').then((r) => r.rows.map((x) => x.id)));
  const total = await owner.query('select count(*)::int as n from orders');
  assert.equal(ids.length, total.rows[0].n, 'staff sees every order');
  const payments = await asClient(STAFF, (c) => c.query('select count(*)::int as n from payments').then((r) => r.rows[0].n));
  assert.equal(payments, 0);
});

check('a guest order is invisible to a signed-in customer', async () => {
  const ids = await asClient(A, (c) => c.query('select id from orders where guest_session_id is not null').then((r) => r.rows));
  assert.equal(ids.length, 0);
});

let failures = 0;
for (const { name, fn } of results) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n     ${error.message}`);
  }
}
console.log(`\n${results.length - failures} of ${results.length} access checks passed`);
await owner.end();
process.exitCode = failures ? 1 : 0;
