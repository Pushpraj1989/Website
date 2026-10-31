// Retail mode, phase 3: returns. Who can ask and when, how much, deciding, refunds and putting stock back.
// Runs against the test database and resets it first. Run: node --test test/returns.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import * as data from '../lib/data.ts';
import { createProduct, saveVariants } from '../lib/catalog.ts';
import { updateSettings } from '../lib/restaurant-settings.ts';
import { acceptOrder, hashToken, placeOrder, setOrderStatus, validateCart } from '../lib/orders.ts';
import { adminReturns, decideReturn, markRefunded, requestReturn, returnWindow } from '../lib/returns.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const MAINS = '00000000-0000-4000-8000-000000000020';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
let key = 0;

before(async () => {
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

/** A collected pickup order of two T-shirts in size M (stock counted), and its guest. */
async function collectedOrder() {
  const { id } = await createProduct({ categoryId: MAINS, nameEn: 'Linen shirt', nameAr: 'قميص كتان', priceMinor: 9000 });
  const [m] = await saveVariants(id, [{ name: { en: 'M', ar: 'وسط' }, priceMinor: 9000, stock: 10 }]);
  const guest = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(guest, validateCart([{ itemId: id, variantId: m.id, qty: 2, note: '' }]));
  const order = await placeOrder({ guestId: guest, idempotencyKey: `ret-${++key}-${Date.now()}`, channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  return { order, guest, variantId: m.id, lineId: order.lines[0].id };
}
async function finish(orderId: string) {
  await acceptOrder(orderId, 20);
  await setOrderStatus(orderId, 'preparing');
  await setOrderStatus(orderId, 'ready');
  await setOrderStatus(orderId, 'collected');
}
const stock = async (variantId: string) => (await db.query('select stock from product_variants where id = $1', [variantId])).rows[0].stock;

test('who can ask: shops only, after delivery, within the window', async () => {
  const { order, guest, lineId } = await collectedOrder();
  const ask = () => requestReturn(guest, order.id, { reason: 'Too small', lines: [{ lineId, qty: 1 }] });
  await expectRule(ask(), 'no_returns', /does not take returns/);
  await updateSettings({ businessType: 'shop', returnDays: 14 }, 'test');
  await expectRule(ask(), 'not_delivered');
  await finish(order.id);
  assert.equal((await returnWindow(db, order.id)).open, true);
  await updateSettings({ returnDays: 0 }, 'test');
  await expectRule(ask(), 'no_returns');
  await updateSettings({ returnDays: 14 }, 'test');
  // Only the order's own customer can ask.
  const stranger = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await expectRule(requestReturn(stranger, order.id, { reason: 'Too small', lines: [{ lineId, qty: 1 }] }), 'not_found');
  // After the window, no more.
  await db.query(`update order_status_events set at = now() - interval '15 days' where order_id = $1 and status = 'collected'`, [order.id]);
  await expectRule(ask(), 'window_closed');
});

test('how much: never more than was bought, one open request at a time', async () => {
  await updateSettings({ businessType: 'shop', returnDays: 14 }, 'test');
  const { order, guest, lineId } = await collectedOrder();
  await finish(order.id);
  await expectRule(requestReturn(guest, order.id, { reason: 'Too small', lines: [{ lineId, qty: 3 }] }), 'bad_qty', /up to 2/);
  await expectRule(requestReturn(guest, order.id, { reason: '', lines: [{ lineId, qty: 1 }] }), 'bad_input');
  await expectRule(requestReturn(guest, order.id, { reason: 'Too small', lines: [{ lineId: '00000000-0000-4000-8000-00000000ffff', qty: 1 }] }), 'bad_input');
  const first = await requestReturn(guest, order.id, { reason: 'Too small', lines: [{ lineId, qty: 1 }] });
  assert.equal(first.status, 'requested');
  assert.equal(first.itemsMinor, 9000);
  await expectRule(requestReturn(guest, order.id, { reason: 'And the other', lines: [{ lineId, qty: 1 }] }), 'return_open');
  assert.ok((await adminReturns()).some((r) => r.id === first.id && r.orderNumber === order.number));
});

test('deciding: reject needs a note; approve refunds the items, puts stock back, and is paid back by hand for cash orders', async () => {
  await updateSettings({ businessType: 'shop', returnDays: 14 }, 'test');
  const { order, guest, lineId, variantId } = await collectedOrder();
  await finish(order.id);
  assert.equal(await stock(variantId), 8);
  const asked = await requestReturn(guest, order.id, { reason: 'Wrong colour', lines: [{ lineId, qty: 1 }] });
  await expectRule(decideReturn(asked.id, { decision: 'reject' }, 'test'), 'bad_input', /note/);
  await expectRule(decideReturn(asked.id, { decision: 'approve', refundMinor: 999999 }, 'test'), 'bad_input', /from 0 to/);
  const approved = await decideReturn(asked.id, { decision: 'approve', restock: true }, 'test');
  assert.equal(approved.status, 'approved', 'a cash order waits for staff to pay back');
  assert.equal(approved.refundMinor, 9000);
  assert.equal(approved.refundMethod, 'manual');
  assert.equal(await stock(variantId), 9, 'the returned shirt is back in stock');
  await expectRule(decideReturn(asked.id, { decision: 'reject', note: 'No' }, 'test'), 'already_decided');
  assert.equal((await markRefunded(asked.id, 'test')).status, 'refunded');
  await expectRule(markRefunded(asked.id, 'test'), 'bad_transition');
  // The second shirt can still be returned; a third cannot.
  const second = await requestReturn(guest, order.id, { reason: 'Changed my mind', lines: [{ lineId, qty: 1 }] });
  const rejected = await decideReturn(second.id, { decision: 'reject', note: 'Worn items cannot be returned.' }, 'test');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.staffNote, 'Worn items cannot be returned.');
  assert.equal(await stock(variantId), 9, 'a rejected return puts nothing back');
  await requestReturn(guest, order.id, { reason: 'Asking again', lines: [{ lineId, qty: 1 }] });
});
