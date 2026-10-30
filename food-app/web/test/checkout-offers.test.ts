// Phase 6 tests: offers and vouchers in the cart and at checkout. Runs against the test database and resets it first.
// Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import * as c from '../lib/campaigns.ts';
import * as data from '../lib/data.ts';
import { createAccount } from '../lib/accounts.ts';
import { saveVoucher } from '../lib/wallet.ts';
import { applyCartCode, cancelStaleCardOrders, placeOrder, quoteFor, removeCartCode, RuleError } from '../lib/orders.ts';
import { confirmCardPayment, hashToken } from '../lib/orders.ts';
import { setOrderStatus } from '../lib/orders.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const SALAD = '00000000-0000-4000-8000-000000000101'; // 18.00 AED
const LEMONADE = '00000000-0000-4000-8000-000000000301'; // 12.00 AED
const WATER = '00000000-0000-4000-8000-000000000302'; // 5.00 AED
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
const day = 24 * 60 * 60 * 1000;
let seq = 0;

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

async function guest(lines: { itemId: string; qty: number }[]) {
  const token = randomBytes(16).toString('hex');
  const id = await data.createGuestSession(hashToken(token));
  await data.setCart(id, lines.map((l) => ({ itemId: l.itemId, qty: l.qty, note: '' })));
  return id;
}

async function account(name: string) {
  seq++;
  return createAccount(name, `+9716${String(1000000 + seq)}`);
}

/** An active campaign with one rule. Options set the rule's terms and an optional shared code. */
async function campaignWith(name: string, rule: Record<string, unknown>) {
  const campaign = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  const offer = await c.createCampaignOffer(campaign.id, {
    name: { en: name, ar: name }, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day), ...rule,
  });
  await c.transitionCampaign(campaign.id, 'activate');
  return offer;
}

async function voucherFor(offerId: string, code: string, extra: Record<string, unknown> = {}) {
  const campaign = await c.createCampaign({ name: `Voucher ${code}`, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  const pool = await c.createPool(campaign.id, { offerId: await linkOffer(campaign.id, offerId), codePattern: 'VCH##-@@@' });
  await c.transitionCampaign(campaign.id, 'activate');
  await c.addManualCode(pool.id, { code, expiresAt: new Date(Date.now() + 20 * day) });
  if (extra.assignedTo) await db.query(`update vouchers set assigned_customer_id = $2 where pool_id = $1`, [pool.id, extra.assignedTo]);
  const { rows: v } = await db.query(`select id from vouchers where pool_id = $1`, [pool.id]);
  return v[0].id as string;
}

/** A voucher's rule must belong to the campaign that issues it, so the rule is copied onto that campaign. */
async function linkOffer(campaignId: string, offerId: string) {
  const { rows } = await db.query(
    `insert into offers (restaurant_id, campaign_id, name_en, name_ar, offer_type, value_int, applies_to, audience, min_subtotal_minor, starts_at, ends_at, active)
     select restaurant_id, $1, name_en, name_ar, offer_type, value_int, applies_to, audience, min_subtotal_minor, starts_at, ends_at, true from offers where id = $2 returning id`,
    [campaignId, offerId],
  );
  await db.query(`update offers set active = true where id = $1`, [rows[0].id]);
  return rows[0].id as string;
}

const place = (guestId: string, opts: Partial<{ accountId: string | null; method: 'card' | 'cod' | 'pay_on_arrival'; channel: 'delivery' | 'pickup'; key: string }> = {}) =>
  placeOrder({
    guestId,
    accountId: opts.accountId ?? null,
    idempotencyKey: opts.key ?? `key-${randomBytes(6).toString('hex')}`,
    channel: opts.channel ?? 'pickup',
    method: opts.method ?? 'pay_on_arrival',
    addressId: null,
    locale: 'en',
  });

test('a shared code takes its discount off the quote, and the total still adds up', async () => {
  await campaignWith('Ten off code', { type: 'percent', value: 1000, code: 'SAVE10AED' });
  const g = await guest([{ itemId: SALAD, qty: 2 }]);
  await applyCartCode(g, null, 'save10aed', 'pickup', null);
  const { quote, offer } = await quoteFor(g, 'pickup', null, null);
  assert.equal(quote.subtotalMinor, 3600);
  assert.equal(quote.discountMinor, 360);
  assert.equal(quote.totalMinor, 3600 - 360);
  assert.equal(offer?.applied, true);
  assert.equal(offer?.label, '10% off');
});

test('a voucher is redeemed once: placed as a cash order it cannot be used again', async () => {
  const offer = await campaignWith('Voucher once', { type: 'fixed', value: 500 });
  const code = 'ONCE-0001';
  await voucherFor(offer.id, code);
  const g1 = await guest([{ itemId: LEMONADE, qty: 1 }]);
  await applyCartCode(g1, null, code, 'pickup', null);
  const order = await place(g1);
  assert.equal(order.discountMinor, 500);
  const g2 = await guest([{ itemId: LEMONADE, qty: 1 }]);
  await expectRule(applyCartCode(g2, null, code, 'pickup', null), 'used');
});

test('a card order holds the voucher until payment is confirmed; another checkout waits, then the payment redeems it', async () => {
  const offer = await campaignWith('Held card', { type: 'fixed', value: 300 });
  const code = 'HOLD-0001';
  const voucherId = await voucherFor(offer.id, code);
  const g1 = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g1, null, code, 'pickup', null);
  const card = await place(g1, { method: 'card', key: 'card-held-0001' });
  const { rows: held } = await db.query(`select status from vouchers where id = $1`, [voucherId]);
  assert.equal(held[0].status, 'available', 'held, not yet redeemed');
  const g2 = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g2, null, code, 'pickup', null);
  await expectRule(place(g2, { method: 'card', key: 'card-held-0002' }), 'voucher_busy');
  const paid = await confirmCardPayment('pi_test_held_1', card.id, card.totalMinor, 'AED');
  assert.equal(paid, 'paid');
  const { rows: redeemed } = await db.query(`select status from vouchers where id = $1`, [voucherId]);
  assert.equal(redeemed[0].status, 'redeemed');
});

test('cancelling a card order before payment releases the voucher, and it can be used again', async () => {
  const offer = await campaignWith('Released', { type: 'fixed', value: 300 });
  const code = 'RELS-0001';
  const voucherId = await voucherFor(offer.id, code);
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g, null, code, 'pickup', null);
  const card = await place(g, { method: 'card', key: 'card-release-1' });
  await setOrderStatus(card.id, 'cancelled');
  const { rows } = await db.query(`select status from vouchers where id = $1`, [voucherId]);
  assert.equal(rows[0].status, 'available');
  const g2 = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g2, null, code, 'pickup', null);
  const again = await place(g2, { key: 'after-release-1' });
  assert.equal(again.discountMinor, 300);
});

test('cancelling a placed order gives its voucher back and removes the redemption', async () => {
  const offer = await campaignWith('Reversed', { type: 'fixed', value: 400 });
  const code = 'REVS-0001';
  const voucherId = await voucherFor(offer.id, code);
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g, null, code, 'pickup', null);
  const order = await place(g, { key: 'reversed-order-1' });
  await setOrderStatus(order.id, 'cancelled');
  const { rows } = await db.query(`select status from vouchers where id = $1`, [voucherId]);
  assert.equal(rows[0].status, 'available');
  const { rows: r } = await db.query(`select count(*)::int as n from offer_redemptions where voucher_id = $1`, [voucherId]);
  assert.equal(r[0].n, 0);
  const { rows: l } = await db.query(`select count(*)::int as n from voucher_ledger where voucher_id = $1 and event = 'reversed'`, [voucherId]);
  assert.equal(l[0].n, 1);
});

test('a shared code with one use left can be taken by only one of two checkouts', async () => {
  await campaignWith('Last one', { type: 'fixed', value: 200, code: 'LASTONE1', usageLimit: 1 });
  const g1 = await guest([{ itemId: WATER, qty: 1 }]);
  const g2 = await guest([{ itemId: WATER, qty: 1 }]);
  await applyCartCode(g1, null, 'LASTONE1', 'pickup', null);
  await applyCartCode(g2, null, 'LASTONE1', 'pickup', null);
  const results = await Promise.allSettled([place(g1, { key: 'race-a-000001' }), place(g2, { key: 'race-b-000001' })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one order gets the offer');
  const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
  // The second checkout is refused under the cart lock, either by the cart's check or by the counter; both say the offer is used up.
  const refusal = rejected.reason as RuleError;
  assert.ok(['offer_used_up', 'offer_not_applicable'].includes(refusal.code), refusal.code);
  assert.match(refusal.message, /used up/);
});

test('a minimum spend is explained when it is not met, and the code applies once it is', async () => {
  await campaignWith('Spend 30', { type: 'fixed', value: 500, code: 'SPEND30', minSubtotalMinor: 3000 });
  const g = await guest([{ itemId: WATER, qty: 1 }]);
  await expectRule(applyCartCode(g, null, 'SPEND30', 'pickup', null), 'offer_not_applicable');
  await data.setCart(g, [{ itemId: SALAD, qty: 2, note: '' }]);
  await applyCartCode(g, null, 'SPEND30', 'pickup', null);
  const { quote } = await quoteFor(g, 'pickup', null, null);
  assert.equal(quote.discountMinor, 500);
});

test('a free delivery offer does not apply to a pickup', async () => {
  await campaignWith('Free delivery', { type: 'free_delivery', value: 0, code: 'FREEDEL1' });
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await expectRule(applyCartCode(g, null, 'FREEDEL1', 'pickup', null), 'offer_not_applicable');
});

test('free delivery applies on the cart, before checkout, at the default delivery address', async () => {
  const g = await guest([{ itemId: SALAD, qty: 2 }]);
  // No address yet: the fee is unknown, and the answer says what to do.
  await expectRule(applyCartCode(g, null, 'FREEDEL1', 'delivery', null), 'offer_not_applicable');
  await db.query(
    `insert into addresses (guest_session_id, label, line_1, line_2, notes, zone_id, is_default, saved)
     values ($1, 'Home', '12 Example Street', '', '', '00000000-0000-4000-8000-000000000501', true, true)`,
    [g],
  );
  const applied = await applyCartCode(g, null, 'FREEDEL1', 'delivery', null);
  assert.equal(applied.applies, true);
  const address = (await data.listSavedAddresses(g))[0];
  const { quote } = await quoteFor(g, 'delivery', address.id, null);
  assert.ok(quote.deliveryFeeMinor > 0);
  assert.equal(quote.discountMinor, quote.deliveryFeeMinor);
});

test('when the cart changes so a code no longer applies, the quote says so and checkout refuses', async () => {
  await campaignWith('Shrinks', { type: 'fixed', value: 500, code: 'SHRINK01', minSubtotalMinor: 2000 });
  const g = await guest([{ itemId: SALAD, qty: 2 }]);
  await applyCartCode(g, null, 'SHRINK01', 'pickup', null);
  await data.setCart(g, [{ itemId: WATER, qty: 1, note: '' }]);
  const { quote, offer } = await quoteFor(g, 'pickup', null, null);
  assert.equal(quote.discountMinor, 0);
  assert.equal(offer?.applied, false);
  assert.match(offer?.reason ?? '', /Add .* AED more/);
  await expectRule(place(g, { key: 'shrunk-cart-01' }), 'offer_not_applicable');
});

test('a voucher bound to another customer cannot be applied, and the answer does not reveal it', async () => {
  const owner = await account('Owner');
  const other = await account('Other');
  const offer = await campaignWith('Bound', { type: 'fixed', value: 200 });
  await voucherFor(offer.id, 'BIND-0001', { assignedTo: owner.id });
  const g = await guest([{ itemId: WATER, qty: 1 }]);
  await expectRule(applyCartCode(g, other.id, 'BIND-0001', 'pickup', null), 'not_valid');
  await applyCartCode(g, owner.id, 'BIND-0001', 'pickup', null);
  const { quote } = await quoteFor(g, 'pickup', null, owner.id);
  assert.equal(quote.discountMinor, 200);
});

test('an offer type that is not supported yet is refused at the cart', async () => {
  await campaignWith('Free item', { type: 'item_free', value: 0, code: 'ITEMFREE' });
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await expectRule(applyCartCode(g, null, 'ITEMFREE', 'pickup', null), 'offer_not_applicable');
});

test('removing the code takes the discount off the cart', async () => {
  await campaignWith('Removable', { type: 'fixed', value: 100, code: 'REMOVE01' });
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g, null, 'REMOVE01', 'pickup', null);
  await removeCartCode(g);
  const { quote, offer } = await quoteFor(g, 'pickup', null, null);
  assert.equal(quote.discountMinor, 0);
  assert.equal(offer, null);
});

test('an unpaid card order is cancelled after its time and gives back its hold', async () => {
  const offer = await campaignWith('Timed out', { type: 'fixed', value: 250 });
  const code = 'TIME-0001';
  const voucherId = await voucherFor(offer.id, code);
  const g = await guest([{ itemId: SALAD, qty: 1 }]);
  await applyCartCode(g, null, code, 'pickup', null);
  const card = await place(g, { method: 'card', key: 'timed-out-card-1' });
  await db.query(`update orders set placed_at = now() - interval '2 hours' where id = $1`, [card.id]);
  assert.equal(await cancelStaleCardOrders(), 1);
  const { rows } = await db.query(`select status from orders where id = $1`, [card.id]);
  assert.equal(rows[0].status, 'cancelled');
  const { rows: v } = await db.query(`select status from vouchers where id = $1`, [voucherId]);
  assert.equal(v[0].status, 'available');
});

test('a wallet voucher saved by a customer can be applied at checkout by that customer', async () => {
  const me = await account('Walletuser');
  const offer = await campaignWith('From wallet', { type: 'fixed', value: 150 });
  await voucherFor(offer.id, 'WALT-0001');
  await saveVoucher(me.id, 'WALT-0001');
  const g = await guest([{ itemId: WATER, qty: 1 }]);
  await applyCartCode(g, me.id, 'WALT-0001', 'pickup', null);
  const order = await place(g, { accountId: me.id, key: 'wallet-order-01' });
  assert.equal(order.discountMinor, 150);
});
