// The sales dashboard: counts by status, sales without cancelled orders, the comparison periods, the months and the
// best sellers, all by the restaurant's own day. Runs against the test database.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import * as data from '../lib/data.ts';
import { placeOrder, hashToken, setOrderStatus, RuleError } from '../lib/orders.ts';
import { salesReport } from '../lib/sales.ts';
import { pool } from '../lib/db.ts';

const SALAD = '00000000-0000-4000-8000-000000000101';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: process.env, stdio: 'ignore' });
});

// An order of [qty] salads, placed at [at] (UTC), moved through [statuses].
async function order(at: string, qty: number, statuses: string[] = []) {
  const guest = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(guest, [{ itemId: SALAD, qty, note: '' }]);
  const placed = await placeOrder({ guestId: guest, accountId: null, idempotencyKey: `sales-${randomBytes(6).toString('hex')}`, channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
  for (const s of statuses) await setOrderStatus(placed.id, s as Parameters<typeof setOrderStatus>[1]);
  await pool.query('update orders set placed_at = $2 where id = $1', [placed.id, at]);
  return placed;
}

test('counts, sales, comparisons, months and best sellers', async () => {
  const { rows: [shop] } = await pool.query('select timezone from restaurant limit 1');
  assert.equal(shop.timezone, 'Asia/Dubai', 'the sample restaurant is in Dubai (UTC+4)');
  const done = ['accepted', 'preparing', 'ready', 'collected'];
  const one = await order('2026-03-10T08:00:00Z', 1, done);
  await order('2026-03-11T08:00:00Z', 2, done);
  await order('2026-03-12T08:00:00Z', 1, ['cancelled']);
  await order('2026-03-12T09:00:00Z', 1, ['accepted']);
  // 21:30 UTC on 14 March is 01:30 on 15 March in Dubai, so it belongs to the 15th.
  await order('2026-03-14T21:30:00Z', 1, done);
  await order('2026-02-28T08:00:00Z', 1, done); // the period before
  await order('2025-03-11T08:00:00Z', 3, done); // a year before
  const unitMinor = one.totalMinor;

  const r = await salesReport({ from: '2026-03-10', to: '2026-03-14' });
  assert.deepEqual(r.current, {
    received: 4, completed: 2, cancelled: 1, inProgress: 1,
    salesMinor: unitMinor * 4, discountMinor: 0, averageMinor: unitMinor * 4 / 3,
  });
  assert.equal(r.previousFrom, '2026-03-05');
  assert.equal(r.previousTo, '2026-03-09');
  assert.equal(r.previous.received, 0);
  assert.equal(r.lastYear.salesMinor, unitMinor * 3);
  assert.equal(r.byDay.length, 5);
  assert.deepEqual(r.byDay.map((d) => d.orders), [1, 1, 2, 0, 0]);
  assert.equal(r.byDay[2].salesMinor, unitMinor, 'the cancelled order is counted as received, not as sales');
  assert.equal(r.monthly.length, 24);
  assert.equal(r.monthly.at(-1)!.month, '2026-03');
  assert.equal(r.monthly.at(-1)!.orders, 4, 'March: four orders went ahead, including the one on the 15th');
  assert.equal(r.monthly.at(-2)!.orders, 1);
  assert.equal(r.monthly.at(-13)!.salesMinor, unitMinor * 3);
  assert.deepEqual(r.channels.map((c) => [c.key, c.orders]), [['pickup', 3]]);
  assert.equal(r.topItems[0].qty, 4);
  // 08:00 UTC is 12:00 in Dubai and 09:00 is 13:00; the order on the 15th (01:30) is outside these days.
  assert.equal(r.byHour.find((h) => h.hour === 12)!.orders, 2);
  assert.equal(r.byHour.find((h) => h.hour === 13)!.orders, 1);
  assert.equal(r.byHour.reduce((n, h) => n + h.orders, 0), 3);
  assert.equal(r.byWeekday.length, 7);
  assert.deepEqual(r.customers, { total: 3, new: 3, returning: 0, orderedMoreThanOnce: 0, returningSalesMinor: 0 });

  const fifteenth = await salesReport({ from: '2026-03-15', to: '2026-03-15' });
  assert.equal(fifteenth.current.completed, 1);
});

test('bad dates and ranges are refused', async () => {
  const refused = async (input: { from: unknown; to: unknown }, code: string) =>
    assert.rejects(salesReport(input), (e: unknown) => e instanceof RuleError && e.code === code);
  await refused({ from: '2026-13-01', to: '2026-12-31' }, 'bad_date');
  await refused({ from: 'yesterday', to: '2026-01-01' }, 'bad_date');
  await refused({ from: '2026-03-10', to: '2026-03-01' }, 'bad_range');
  await refused({ from: '2024-01-01', to: '2026-01-01' }, 'bad_range');
  await pool.end();
});
