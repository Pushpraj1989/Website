// Exit test over HTTP against a real `next start` server (see README). Resets the fake store first.
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:3100';
const ADMIN_PASSWORD = 'slice-test-password-1';
const WEBHOOK_SECRET = 'whsec_slice_test_secret';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
const ITEM = '00000000-0000-4000-8000-000000000101';
const ITEM2 = '00000000-0000-4000-8000-000000000201';
const ZONE = '00000000-0000-4000-8000-000000000501';


// Fresh schema and seed for every run. The fake store is gone; the test database is the real one.
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
    // No address chosen yet, so the zone fee (1000) is not in the cart total. The order adds it.
    assert.equal(r.json.quote.totalMinor, 10800);
    assert.equal(r.json.quote.currency, 'AED');
  });

  check('a bad quantity is refused', async () => {
    const r = await guest.put('/v1/cart', { items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 99, note: '' }] });
    assert.equal(r.status, 400);
  });

  // Saved addresses. The seeded zone is a box around central Dubai; a point inside it gets that zone.
  let addressId;
  let secondAddressId;
  const addressBody = (extra) => ({ label: 'Home', line1: '12 Example Street, Dubai', line2: 'Flat 4', notes: '', ...extra });
  check('a delivery address is saved from coordinates inside a zone and becomes the default', async () => {
    const r = await guest.post('/v1/addresses', addressBody({ lat: 25.1, lng: 55.3 }));
    assert.equal(r.status, 201);
    assert.equal(r.json.address.isDefault, true);
    assert.equal(r.json.address.zone.id, ZONE, 'the point is matched to the zone that covers it');
    addressId = r.json.address.id;
    const list = await guest.get('/v1/addresses');
    assert.equal(list.json.addresses.length, 1);
  });

  check('a point outside every zone is refused with a plain message', async () => {
    const r = await guest.post('/v1/addresses', addressBody({ lat: 10, lng: 10 }));
    assert.equal(r.status, 422);
    assert.equal(r.json.error.code, 'outside_zone');
  });

  check('an address without coordinates needs a zone the customer chooses', async () => {
    const none = await guest.post('/v1/addresses', addressBody({}));
    assert.equal(none.json.error.code, 'zone_required');
    const unknown = await guest.post('/v1/addresses', addressBody({ zoneId: '00000000-0000-4000-8000-00000000ffff' }));
    assert.equal(unknown.json.error.code, 'zone_missing');
    const ok = await guest.post('/v1/addresses', addressBody({ label: 'Work', zoneId: ZONE }));
    assert.equal(ok.status, 201);
    assert.equal(ok.json.address.isDefault, false, 'a second address is not the default unless asked');
    secondAddressId = ok.json.address.id;
  });

  check('a short street line and bad coordinates are refused', async () => {
    assert.equal((await guest.post('/v1/addresses', addressBody({ line1: 'ab', lat: 25.1, lng: 55.3 }))).json.error.code, 'bad_input');
    assert.equal((await guest.post('/v1/addresses', addressBody({ lat: 25.1 }))).json.error.code, 'bad_input', 'latitude without longitude');
    assert.equal((await guest.post('/v1/addresses', addressBody({ lat: 95, lng: 55.3 }))).json.error.code, 'bad_input');
  });

  check('making another address the default moves the default; the old one is no longer default', async () => {
    const r = await guest.call('PATCH', `/v1/addresses/${secondAddressId}`, addressBody({ label: 'Work', zoneId: ZONE, isDefault: true }));
    assert.equal(r.status, 200);
    const list = await guest.get('/v1/addresses');
    assert.equal(list.json.addresses.filter((a) => a.isDefault).length, 1);
    assert.equal(list.json.addresses.find((a) => a.id === secondAddressId).isDefault, true);
    await guest.call('PATCH', `/v1/addresses/${addressId}`, addressBody({ lat: 25.1, lng: 55.3, isDefault: true }));
  });

  check('another browser cannot change or delete a guest address', async () => {
    assert.equal((await stranger.call('PATCH', `/v1/addresses/${addressId}`, addressBody({ zoneId: ZONE }))).status, 404);
    assert.equal((await stranger.call('DELETE', `/v1/addresses/${addressId}`)).status, 404);
    assert.equal((await stranger.get('/v1/addresses')).json.addresses.length, 0);
  });

  check('the quote charges the zone fee for a chosen address and reports the zone minimum', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: ITEM, qty: 1, note: '' }] });
    const without = await guest.post('/v1/checkout/quote', { channel: 'delivery' });
    assert.equal(without.json.quote.deliveryFeeMinor, 0, 'no address chosen, no fee yet');
    assert.equal(without.json.delivery, null);
    const withAddress = await guest.post('/v1/checkout/quote', { channel: 'delivery', addressId });
    assert.equal(withAddress.json.quote.deliveryFeeMinor, 1000);
    assert.equal(withAddress.json.delivery.zoneId, ZONE);
    assert.equal(withAddress.json.delivery.deliverable, true);
  });

  check('the public zone list shows only active zones with their fee and minimum', async () => {
    const r = await fetch(`${BASE}/v1/delivery-zones`);
    const body = await r.json();
    assert.equal(r.status, 200);
    assert.ok(body.zones.some((z) => z.id === ZONE && z.feeMinor === 1000));
  });

  check('an order to an address that is not the customer\'s is refused', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: ITEM, qty: 1, note: '' }] });
    await stranger.put('/v1/cart', { channel: 'delivery', items: [{ itemId: ITEM, qty: 1, note: '' }] });
    const other = await stranger.post('/v1/orders', { channel: 'delivery', method: 'cod', addressId, idempotencyKey: 'key-foreign-02' });
    assert.equal(other.status, 422);
    assert.equal(other.json.error.code, 'address_missing');
  });

  check('deleting the default address promotes the newest remaining one', async () => {
    const del = await guest.call('DELETE', `/v1/addresses/${addressId}`);
    assert.equal(del.status, 204);
    const list = await guest.get('/v1/addresses');
    assert.equal(list.json.addresses.length, 1);
    assert.equal(list.json.addresses[0].isDefault, true);
    secondAddressId = list.json.addresses[0].id;
  });

  check('an order keeps its own copy of the address after the saved address is deleted', async () => {
    const pgClient = new pg.Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
    try {
      await pgClient.query('update delivery_zones set min_order_minor = 0 where id = $1', [ZONE]);
    } finally {
      await pgClient.end();
    }
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: ITEM, qty: 1, note: '' }] });
    const placed = await guest.post('/v1/orders', { channel: 'delivery', method: 'cod', addressId: secondAddressId, idempotencyKey: 'key-copy-0001' });
    assert.equal(placed.status, 201);
    assert.equal(placed.json.order.address, '12 Example Street, Dubai');
    await guest.call('DELETE', `/v1/addresses/${secondAddressId}`);
    const later = await guest.get(`/v1/orders/${placed.json.order.id}`);
    assert.equal(later.json.order.address, '12 Example Street, Dubai', 'the order still shows the address it was sent to');
    const list = await guest.get('/v1/addresses');
    assert.equal(list.json.addresses.length, 0, 'the copy is not listed as a saved address');
  });

  check('a zone minimum is enforced: a smaller order is refused with a plain message', async () => {
    const pgClient = new pg.Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
    try {
      await pgClient.query('update delivery_zones set min_order_minor = 999999 where id = $1', [ZONE]);
    } finally {
      await pgClient.end();
    }
    const a = await guest.post('/v1/addresses', addressBody({ zoneId: ZONE }));
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: ITEM, qty: 1, note: '' }] });
    const r = await guest.post('/v1/orders', { channel: 'delivery', method: 'cod', addressId: a.json.address.id, idempotencyKey: 'key-min-0001' });
    assert.equal(r.status, 422);
    assert.equal(r.json.error.code, 'below_minimum');
    const quote = await guest.post('/v1/checkout/quote', { channel: 'delivery', addressId: a.json.address.id });
    assert.equal(quote.json.delivery.deliverable, false);
    const pgReset = new pg.Client({ connectionString: DATABASE_URL });
    await pgReset.connect();
    try {
      await pgReset.query('update delivery_zones set min_order_minor = 0 where id = $1', [ZONE]);
    } finally {
      await pgReset.end();
    }
  });

  check('an address cannot be added past the limit of ten', async () => {
    for (let i = 0; i < 10; i++) {
      const ok = await stranger.post('/v1/addresses', addressBody({ label: `Spot ${i}`, zoneId: ZONE }));
      assert.equal(ok.status, 201);
    }
    const r = await stranger.post('/v1/addresses', addressBody({ label: 'Extra', zoneId: ZONE }));
    assert.equal(r.status, 422);
    assert.equal(r.json.error.code, 'address_limit');
  });

  check('cash on delivery without an address is refused', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000101', qty: 1, note: '' }, { itemId: '00000000-0000-4000-8000-000000000201', qty: 2, note: 'no onions' }] });
    const r = await guest.post('/v1/orders', { channel: 'delivery', method: 'cod', idempotencyKey: 'key-cod-0001' });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, 'address_missing');
  });

  let codOrderId;
  check('cash on delivery order is placed once; a repeat with the same key returns the same order', async () => {
    addressId = (await guest.post('/v1/addresses', addressBody({ lat: 25.1, lng: 55.3 }))).json.address.id;
    const body = { channel: 'delivery', method: 'cod', addressId, idempotencyKey: 'key-cod-0002' };
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
    const r = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', addressId, idempotencyKey: 'key-card-0001' });
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
    const placed = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', addressId, idempotencyKey: 'key-card-0002' });
    const event = { id: 'evt_bad', type: 'payment_intent.succeeded', data: { object: { id: 'pi_bad', amount: 500, currency: 'aed', metadata: { order_id: placed.json.order.id } } } };
    const r = await fetch(`${BASE}/v1/webhooks/payments/stripe`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=00', 'content-type': 'application/json' }, body: JSON.stringify(event) });
    assert.equal(r.status, 400);
    const order = await guest.get(`/v1/orders/${placed.json.order.id}`);
    assert.equal(order.json.order.status, 'awaiting_payment');
  });

  check('a webhook with the wrong amount does not confirm the order', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [{ itemId: '00000000-0000-4000-8000-000000000302', qty: 1, note: '' }] });
    const placed = await guest.post('/v1/orders', { channel: 'delivery', method: 'card', addressId, idempotencyKey: 'key-card-0003' });
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

  // Delivery areas drawn by staff. The area is north of the seeded central one, so the points do not overlap.
  const TEST_AREA = [[55.0, 26.0], [55.1, 26.0], [55.1, 26.1], [55.0, 26.1]];
  let areaId;
  check('delivery areas are refused to a visitor who is not signed in as staff', async () => {
    const r = await stranger.post('/v1/admin/zones', { nameEn: 'X', nameAr: 'س', feeMinor: 0, minOrderMinor: 0, polygon: TEST_AREA });
    assert.equal(r.status, 401);
  });

  check('staff draw an area with a fee and minimum; the public list and the address match show it', async () => {
    const created = await staff.post('/v1/admin/zones', { nameEn: 'Test marina', nameAr: 'مارينا تجريبية', feeMinor: 1500, minOrderMinor: 2000, polygon: TEST_AREA });
    assert.equal(created.status, 201);
    areaId = created.json.id;
    const zones = await fetch(`${BASE}/v1/delivery-zones`).then((r) => r.json());
    const mine = zones.zones.find((z) => z.id === areaId);
    assert.equal(mine.feeMinor, 1500);
    assert.equal(mine.minOrderMinor, 2000);
    const address = await guest.post('/v1/addresses', { label: 'Home', line1: '1 Marina Walk', lat: 26.05, lng: 55.05 });
    assert.equal(address.status, 201);
    assert.equal(address.json.address.zone.id, areaId);
  });

  check('an outline that crosses itself is refused with a plain message', async () => {
    const bowtie = [[55.0, 26.0], [55.1, 26.1], [55.1, 26.0], [55.0, 26.1]];
    const r = await staff.post('/v1/admin/zones', { nameEn: 'Bad', nameAr: 'سيئ', feeMinor: 0, minOrderMinor: 0, polygon: bowtie });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, 'bad_input');
  });

  check('a deactivated area stops matching new addresses', async () => {
    const r = await staff.call('PATCH', `/v1/admin/zones/${areaId}`, { nameEn: 'Test marina', nameAr: 'مارينا تجريبية', feeMinor: 1500, minOrderMinor: 2000, active: false, polygon: TEST_AREA });
    assert.equal(r.status, 200);
    const address = await guest.post('/v1/addresses', { label: 'Office', line1: '2 Marina Walk', lat: 26.05, lng: 55.05 });
    assert.equal(address.status, 422);
    assert.equal(address.json.error.code, 'outside_zone');
  });

  // History, shortcuts and reordering. The guest has placed orders above; a stranger has none.
  const ITEM_B = '00000000-0000-4000-8000-000000000201';
  check('order history lists only the customer\'s own orders, with their dishes', async () => {
    const mine = await guest.get('/v1/orders');
    assert.equal(mine.status, 200);
    assert.ok(mine.json.orders.length >= 2);
    assert.ok(mine.json.orders.every((o) => o.items.length > 0 && o.items[0].name.en));
    assert.equal((await stranger.get('/v1/orders')).json.orders.length, 0);
  });

  check('the home shortcuts show the last order and the dishes ordered most', async () => {
    const home = await guest.get('/v1/customer/home');
    assert.equal(home.status, 200);
    assert.ok(home.json.lastOrder, 'there is a last order');
    assert.ok(home.json.frequent.length >= 1);
    assert.ok(home.json.frequent.every((d) => d.timesOrdered >= 1 && d.name.en));
    assert.equal((await stranger.get('/v1/customer/home')).json.lastOrder, null);
  });

  check('a dish can be saved as a favourite and removed again; an unknown dish is refused', async () => {
    const on = await guest.call('PUT', `/v1/favourites/${ITEM_B}`);
    assert.equal(on.status, 204);
    assert.ok((await guest.get('/v1/customer/home')).json.favourites.some((d) => d.id === ITEM_B));
    assert.equal((await guest.call('DELETE', `/v1/favourites/${ITEM_B}`)).status, 204);
    assert.equal((await guest.get('/v1/customer/home')).json.favourites.length, 0);
    const bogus = await guest.call('PUT', '/v1/favourites/00000000-0000-4000-8000-00000000ffff');
    assert.equal(bogus.status, 404);
  });

  check('reordering puts a past order back in the cart', async () => {
    await guest.put('/v1/cart', { channel: 'delivery', items: [] });
    const r = await guest.post(`/v1/orders/${codOrderId}/reorder`);
    assert.equal(r.status, 200);
    assert.equal(r.json.skipped.length, 0);
    assert.ok(r.json.added.length >= 2);
    const cart = await guest.get('/v1/cart');
    assert.ok(cart.json.lines.length >= 2);
  });

  check('a sold-out dish is left out of a reorder and named back to the customer', async () => {
    const pgClient = new pg.Client({ connectionString: DATABASE_URL });
    await pgClient.connect();
    try {
      await pgClient.query('update menu_items set available = false where id = $1', [ITEM_B]);
      await guest.put('/v1/cart', { channel: 'delivery', items: [] });
      const r = await guest.post(`/v1/orders/${codOrderId}/reorder`);
      assert.equal(r.status, 200);
      assert.equal(r.json.skipped.length, 1);
    } finally {
      await pgClient.query('update menu_items set available = true where id = $1', [ITEM_B]);
      await pgClient.end();
    }
  });

  check('another customer cannot reorder a guest order', async () => {
    const r = await stranger.post(`/v1/orders/${codOrderId}/reorder`);
    assert.equal(r.status, 404);
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
