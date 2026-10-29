// Exit test over HTTP against a real `next start` server (see README). Resets the fake store first.
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:3100';
const ADMIN_PASSWORD = 'slice-test-password-1';
const WEBHOOK_SECRET = 'whsec_slice_test_secret';


// Fresh schema and seed for every run. The fake store is gone; the test database is the real one.
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
await new Promise((resolve, reject) => {
  const migrate = spawn(process.execPath, [`${ROOT}db/migrate.mjs`, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'inherit' });
  migrate.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('migrate failed'))));
});

// Spawn the Next binary directly and kill its process group, so no server outlives the test.
const server = spawn(process.execPath, [`${ROOT}node_modules/next/dist/bin/next`, 'start', '-p', '3100'], {
  cwd: ROOT,
  detached: true,
  env: {
    ...process.env,
    DATABASE_URL,
    NEXT_TELEMETRY_DISABLED: '1',
    ADMIN_PASSWORD,
    STRIPE_SECRET_KEY: 'sk_test_slice_placeholder',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_slice_placeholder',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', () => {});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/v1/menu`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

/** A tiny cookie jar: one per simulated browser. */
function browser() {
  const jar = {};
  return {
    async call(method, path, body, extraHeaders = {}) {
      const headers = { ...extraHeaders };
      const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookie) headers.cookie = cookie;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        redirect: 'manual',
      });
      for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(';');
        const [k, ...v] = pair.split('=');
        jar[k] = v.join('=');
      }
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: response.status, json, text };
    },
    get(path) { return this.call('GET', path); },
    put(path, body) { return this.call('PUT', path, body); },
    post(path, body) { return this.call('POST', path, body); },
    jar,
  };
}

function signedEvent(event, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return { body, headers: { 'stripe-signature': `t=${t},v1=${v1}` } };
}

const results = [];
function check(name, fn) { results.push({ name, fn }); }

try {
  await waitForServer();
  const guest = browser();
  const stranger = browser();
  const staff = browser();

  check('menu lists items and enabled payment methods', async () => {
    const menu = await guest.get('/v1/menu');
    assert.equal(menu.status, 200);
    assert.equal(menu.json.categories.length, 3);
    assert.equal(menu.json.payments.card, true);
    assert.equal(menu.json.payments.cod, true);
  });

  check('a sold-out item cannot be added to the cart', async () => {
    const r = await guest.put('/v1/cart', { items: [{ itemId: '00000000-0000-4000-8000-000000000203', qty: 1, note: '' }] });
    assert.equal(r.status, 422);
    assert.equal(r.json.error.code, 'sold_out');
  });

  check('cart stores items and prices come from the server, with a guest cookie set', async () => {
    const r = await guest.put('/v1/cart', {
      channel: 'delivery',
      items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 1, note: '' }, { itemId: '00000000-0000-4000-8000-000000000201', qty: 2, note: 'no onions' }],
    });
    assert.equal(r.status, 200);
    assert.ok(guest.jar.guest, 'guest cookie set');
    // 1800 + 2 * 4500 = 10800 subtotal, plus 1000 delivery = 11800 total
    assert.equal(r.json.quote.subtotalMinor, 10800);
    assert.equal(r.json.quote.totalMinor, 11800);
    assert.equal(r.json.quote.currency, 'AED');
  });

  check('a bad quantity is refused', async () => {
    const r = await guest.put('/v1/cart', { items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 99, note: '' }] });
    assert.equal(r.status, 400);
  });

  check('cash on delivery without an address is refused', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 1, note: '' }, { itemId: '00000000-0000-4000-8000-000000000201', qty: 2, note: 'no onions' }] });
    const r = await guest.post('/v1/orders', { channel: 'delivery', method: 'cod', address: '', idempotencyKey: 'key-cod-0001' });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, 'address_missing');
  });

  let codOrderId;
  check('cash on delivery order is placed once; a repeat with the same key returns the same order', async () => {
    const body = { channel: 'delivery', method: 'cod', address: '12 Example Street, Dubai', idempotencyKey: 'key-cod-0002' };
    const first = await guest.post('/v1/orders', body);
    assert.equal(first.status, 201);
    assert.equal(first.json.order.status, 'placed');
    assert.equal(first.json.order.quote.totalMinor, 11800);
    codOrderId = first.json.order.id;
    const again = await guest.post('/v1/orders', body);
    assert.equal(again.json.order.id, codOrderId);
    const cart = await guest.get('/v1/cart');
    assert.equal(cart.json.lines.length, 0, 'cart is cleared after placing');
  });

  let cardOrderId;
  check('card order waits for payment', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 1, note: '' }, { itemId: '00000000-0000-4000-8000-000000000201', qty: 2, note: 'no onions' }] });
    const r = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', address: '12 Example Street, Dubai', idempotencyKey: 'key-card-0001' });
    assert.equal(r.status, 201);
    assert.equal(r.json.order.status, 'awaiting_payment');
    cardOrderId = r.json.order.id;
  });

  check('a signed payment webhook confirms the card order once; a replay changes nothing', async () => {
    const event = {
      id: 'evt_slice_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_slice_1', amount: 11800, amount_received: 11800, currency: 'aed', metadata: { order_id: cardOrderId } } },
    };
    const signed1 = signedEvent(event);
    const r1 = await fetch(`${BASE}/v1/webhooks/payments/stripe`, { method: 'POST', headers: { ...signed1.headers, 'content-type': 'application/json' }, body: signed1.body });
    assert.equal(r1.status, 200);
    const order = await guest.get(`/v1/orders/${cardOrderId}`);
    assert.equal(order.json.order.status, 'placed');
    const signed2 = signedEvent(event);
    const r2 = await fetch(`${BASE}/v1/webhooks/payments/stripe`, { method: 'POST', headers: { ...signed2.headers, 'content-type': 'application/json' }, body: signed2.body });
    assert.equal(r2.status, 200);
    const again = await guest.get(`/v1/orders/${cardOrderId}`);
    assert.equal(again.json.order.status, 'placed');
    assert.equal(again.json.order.history.filter((h) => h.status === 'placed').length, 1);
  });

  check('a webhook with a bad signature is refused and changes nothing', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000302', qty: 1, note: '' }] });
    const placed = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', address: 'x', idempotencyKey: 'key-card-0002' });
    const event = { id: 'evt_bad', type: 'payment_intent.succeeded', data: { object: { id: 'pi_bad', amount: 500, currency: 'aed', metadata: { order_id: placed.json.order.id } } } };
    const r = await fetch(`${BASE}/v1/webhooks/payments/stripe`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00', 'content-type': 'application/json' }, body: JSON.stringify(event) });
    assert.equal(r.status, 400);
    const order = await guest.get(`/v1/orders/${placed.json.order.id}`);
    assert.equal(order.json.order.status, 'awaiting_payment');
  });

  check('a webhook with the wrong amount does not confirm the order', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000302', qty: 1, note: '' }] });
    const placed = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', address: 'x', idempotencyKey: 'key-card-0003' });
    const signed = signedEvent({ id: 'evt_amount', type: 'payment_intent.succeeded', data: { object: { id: 'pi_amt', amount: 1, currency: 'aed', metadata: { order_id: placed.json.order.id } } } });
    const r = await fetch(`${BASE}/v1/webhooks/payments/stripe`, { method: 'POST', headers: { ...signed.headers, 'content-type': 'application/json' }, body: signed.body });
    assert.equal(r.status, 200);
    const order = await guest.get(`/v1/orders/${placed.json.order.id}`);
    assert.equal(order.json.order.status, 'awaiting_payment', 'mismatched amount is not confirmed');
  });

  check('another browser cannot read a guest order', async () => {
    const r = await stranger.get(`/v1/orders/${codOrderId}`);
    assert.equal(r.status, 404);
  });

  check('staff routes refuse without a staff session, and a wrong password is refused', async () => {
    assert.equal((await staff.get('/v1/admin/orders')).status, 401);
    const wrong = await staff.post('/v1/admin/session', { password: 'not-the-password-at-all' });
    assert.equal(wrong.status, 401);
    assert.equal((await staff.get('/v1/admin/orders')).status, 401);
  });

  check('staff accept moves a placed order to accepted, visible to the customer', async () => {
    const right = await staff.post('/v1/admin/session', { password: ADMIN_PASSWORD });
    assert.equal(right.status, 200);
    assert.ok(staff.jar.staff, 'staff cookie set');
    const board = await staff.get('/v1/admin/orders');
    assert.equal(board.status, 200);
    assert.ok(board.json.orders.some((o) => o.id === codOrderId));
    const acc = await staff.post(`/v1/admin/orders/${codOrderId}/accept`, { etaMinutes: 25 });
    assert.equal(acc.status, 200);
    const customerView = await guest.get(`/v1/orders/${codOrderId}`);
    assert.equal(customerView.json.order.status, 'accepted');
    assert.equal(customerView.json.order.etaMinutes, 25);
  });

  check('the kitchen cannot skip steps', async () => {
    const r = await staff.post(`/v1/admin/orders/${codOrderId}/status`, { to: 'delivered' });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, 'bad_transition');
  });

  check('the order moves through preparing, ready and out for delivery to delivered', async () => {
    for (const to of ['preparing', 'ready', 'out_for_delivery', 'delivered']) {
      const r = await staff.post(`/v1/admin/orders/${codOrderId}/status`, { to });
      assert.equal(r.status, 200, `move to ${to}`);
    }
    const view = await guest.get(`/v1/orders/${codOrderId}`);
    assert.equal(view.json.order.status, 'delivered');
    assert.equal(view.json.order.history.at(-1).status, 'delivered');
  });

  check('a bad accept time is refused', async () => {
    const r = await staff.post(`/v1/admin/orders/${cardOrderId}/accept`, { etaMinutes: 1 });
    assert.equal(r.status, 400);
  });

  check('a JSON-only endpoint refuses form posts', async () => {
    const r = await fetch(`${BASE}/v1/cart`, { method: 'PUT', headers: { 'content-type': 'text/plain', cookie: `guest=${guest.jar.guest}` }, body: '{"items":[]}' });
    assert.equal(r.status, 415);
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
  console.log(`\n${results.length - failures} of ${results.length} checks passed`);
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
