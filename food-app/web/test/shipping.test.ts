// Retail mode, phase 2: courier shipping. Rates, shipping addresses, the fee (free above an amount), placing a courier
// order, and handing it over with tracking. Runs against the test database and resets it first.
// Run: node --test test/shipping.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import * as data from '../lib/data.ts';
import { acceptOrder, customerView, hashToken, placeOrder, quoteFor, saveAddress, setOrderStatus } from '../lib/orders.ts';
import { listRates, markShipped, saveRates, shippingFee } from '../lib/shipping.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const SALAD = '00000000-0000-4000-8000-000000000101'; // 18.00
const CHICKEN = '00000000-0000-4000-8000-000000000201'; // 45.00
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
let key = 0;

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string, message?: RegExp) {
  try {
    await promise;
  } catch (err) {
    assert.equal((err as { code?: string }).code, code, (err as Error).message);
    if (message) assert.match((err as Error).message, message);
    return;
  }
  assert.fail(`expected a ${code} error`);
}

async function guest(lines: { itemId: string; qty: number }[]) {
  const id = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(id, lines.map((l) => ({ ...l, note: '' })));
  return id;
}

const shipTo = (g: string) => saveAddress(g, { forShipping: true, label: 'Home', line1: '12 Palm Street, Flat 4', city: 'Abu Dhabi', country: 'United Arab Emirates' });

async function rates() {
  return saveRates([
    { name: { en: 'Standard', ar: 'عادي' }, eta: { en: '2-4 days', ar: '2-4 أيام' }, priceMinor: 1500, freeOverMinor: 20000 },
    { name: { en: 'Express', ar: 'سريع' }, eta: { en: 'Next day', ar: 'اليوم التالي' }, priceMinor: 3500 },
    { name: { en: 'Old rate', ar: 'قديم' }, priceMinor: 999, active: false },
  ], 'test');
}

test('rates: saved in order, customers see only active ones, bad values refused', async () => {
  const saved = await rates();
  assert.deepEqual(saved.map((r) => r.name.en), ['Standard', 'Express', 'Old rate']);
  assert.deepEqual((await listRates()).map((r) => r.name.en), ['Standard', 'Express']);
  await expectRule(saveRates([{ name: { en: 'X', ar: 'X' }, priceMinor: -1 }], 'test'), 'bad_input');
  await expectRule(saveRates([{ name: { en: '', ar: 'X' }, priceMinor: 1 }], 'test'), 'bad_input');
  await expectRule(saveRates([{ name: { en: 'X', ar: 'X' }, priceMinor: 1, freeOverMinor: 0 }], 'test'), 'bad_input', /more than 0/);
  assert.equal(shippingFee(saved[0], 19999), 1500);
  assert.equal(shippingFee(saved[0], 20000), 0, 'free from the amount set');
});

test('addresses: a shipping address needs a city and country, and no delivery area', async () => {
  const g = await guest([]);
  const a = await shipTo(g);
  assert.equal(a.forShipping, true);
  assert.equal(a.zone, null);
  assert.equal(a.city, 'Abu Dhabi');
  await expectRule(saveAddress(g, { forShipping: true, line1: '12 Palm Street', city: '', country: 'UAE' }), 'bad_input', /city/);
  await expectRule(saveAddress(g, { forShipping: true, line1: '12 Palm Street', city: 'Dubai' }), 'bad_input', /country/);
});

test('quote: the chosen rate sets the fee; free above its amount; an inactive rate is refused', async () => {
  const [standard, express, old] = await rates();
  const small = await guest([{ itemId: SALAD, qty: 1 }]);
  const address = await shipTo(small);
  const q1 = await quoteFor(small, 'shipping', address.id, null, standard.id);
  assert.equal(q1.quote.deliveryFeeMinor, 1500);
  assert.equal(q1.quote.totalMinor, 1800 + 1500);
  assert.equal((await quoteFor(small, 'shipping', address.id, null, express.id)).quote.deliveryFeeMinor, 3500);
  const big = await guest([{ itemId: CHICKEN, qty: 5 }]);
  const bigAddress = await shipTo(big);
  assert.equal((await quoteFor(big, 'shipping', bigAddress.id, null, standard.id)).quote.deliveryFeeMinor, 0, 'AED 225 is over the AED 200 free-shipping amount');
  await expectRule(quoteFor(small, 'shipping', address.id, null, old.id), 'rate_missing');
});

test('placing: a courier order needs an address with city and country and a rate; cash on delivery is allowed', async () => {
  const [standard] = await rates();
  const g = await guest([{ itemId: SALAD, qty: 2 }]);
  await expectRule(placeOrder({ guestId: g, idempotencyKey: `ship-${++key}-x`, channel: 'shipping', method: 'cod', addressId: null, locale: 'en', shippingRateId: standard.id }), 'address_missing');
  const address = await shipTo(g);
  await expectRule(placeOrder({ guestId: g, idempotencyKey: `ship-${++key}-y`, channel: 'shipping', method: 'cod', addressId: address.id, locale: 'en' }), 'rate_required');
  const order = await placeOrder({ guestId: g, idempotencyKey: `ship-${++key}`, channel: 'shipping', method: 'cod', addressId: address.id, locale: 'en', shippingRateId: standard.id });
  assert.equal(order.channel, 'shipping');
  assert.equal(order.deliveryFeeMinor, 1500);
  assert.equal(order.totalMinor, 3600 + 1500);
  assert.equal(order.address, '12 Palm Street, Flat 4, Abu Dhabi, United Arab Emirates');
  assert.equal(customerView(order).shipping?.rate, 'Standard');
  // A delivery-area address without a city cannot be used for shipping.
  const plain = await guest([{ itemId: SALAD, qty: 1 }]);
  const local = await saveAddress(plain, { line1: 'Building 7', lat: 25.1, lng: 55.3 }).catch(() => null);
  if (local) await expectRule(placeOrder({ guestId: plain, idempotencyKey: `ship-${++key}-z`, channel: 'shipping', method: 'cod', addressId: local.id, locale: 'en', shippingRateId: standard.id }), 'address_incomplete');
});

test('shipping it: tracking recorded, status shipped then delivered; only courier orders can be shipped', async () => {
  const [standard] = await rates();
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  const address = await shipTo(g);
  const order = await placeOrder({ guestId: g, idempotencyKey: `ship-${++key}`, channel: 'shipping', method: 'cod', addressId: address.id, locale: 'en', shippingRateId: standard.id });
  await expectRule(markShipped(order.id, { carrier: 'Aramex', trackingNumber: 'AX123456' }, 'test'), 'bad_transition', /placed/);
  await acceptOrder(order.id, 30);
  await expectRule(markShipped(order.id, { carrier: 'Aramex', trackingNumber: 'AX1', trackingUrl: 'http://x.example' }, 'test'), 'bad_input');
  await markShipped(order.id, { carrier: 'Aramex', trackingNumber: 'AX123456', trackingUrl: 'https://track.example/AX123456' }, 'test');
  const shipped = (await data.getOrder(order.id))!;
  assert.equal(shipped.status, 'shipped');
  assert.deepEqual(shipped.shipping, { rate: 'Standard', carrier: 'Aramex', trackingNumber: 'AX123456', trackingUrl: 'https://track.example/AX123456' });
  assert.ok(shipped.history.some((h) => h.status === 'shipped'));
  await setOrderStatus(order.id, 'delivered');
  assert.equal((await data.getOrder(order.id))!.status, 'delivered');
  // A pickup order cannot be marked shipped.
  const p = await guest([{ itemId: SALAD, qty: 1 }]);
  const pickup = await placeOrder({ guestId: p, idempotencyKey: `ship-${++key}`, channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  await acceptOrder(pickup.id, 20);
  await expectRule(markShipped(pickup.id, { carrier: 'Aramex', trackingNumber: 'AX999' }, 'test'), 'not_shipping');
});
