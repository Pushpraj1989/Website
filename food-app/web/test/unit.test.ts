import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { formatMoney } from '../lib/money.ts';
import { computeQuote, totalIsConsistent, type PricingSettings } from '../lib/pricing.ts';
import { verifyStripeSignature } from '../lib/stripe-signature.ts';
import { canTransition } from '../lib/status.ts';
import { STRINGS } from '../lib/i18n.ts';

const AED: PricingSettings = {
  currency: 'AED',
  taxLabel: 'VAT',
  taxBasisPoints: 500,
  deliveryFeeMinor: 1000,
  serviceFeeMinor: 0,
  pricesIncludeTax: true,
};

test('money uses the decimal places from the currency table', () => {
  assert.equal(formatMoney(1250, 'AED', 'en'), 'AED 12.50');
  assert.equal(formatMoney(12345, 'OMR', 'en'), 'OMR 12.345');
  assert.equal(formatMoney(5, 'AED', 'en'), 'AED 0.05');
  assert.equal(formatMoney(-1250, 'AED', 'en'), '-AED 12.50');
  assert.equal(formatMoney(123456789, 'AED', 'ar'), 'AED 1,234,567.89');
});

test('money refuses fractional amounts and unknown currencies', () => {
  assert.throws(() => formatMoney(12.5, 'AED', 'en'), /integer/);
  assert.throws(() => formatMoney(100, 'XYZ', 'en'), /Unknown currency/);
});

test('quote totals add up and tax is rounded once at the total', () => {
  const quote = computeQuote(
    [{ itemId: 'a', name: 'A', unitMinor: 4500, qty: 1 }],
    'delivery',
    AED,
  );
  assert.equal(quote.subtotalMinor, 4500);
  assert.equal(quote.deliveryFeeMinor, 1000);
  assert.equal(quote.totalMinor, 5500);
  // 5500 * 500 / 10500 = 261.9..., rounds half up to 262
  assert.equal(quote.taxIncludedMinor, 262);
  assert.ok(totalIsConsistent(quote));
});

test('pickup has no delivery fee and an empty cart has no fees', () => {
  const pickup = computeQuote([{ itemId: 'a', name: 'A', unitMinor: 1000, qty: 2 }], 'pickup', AED);
  assert.equal(pickup.deliveryFeeMinor, 0);
  assert.equal(pickup.totalMinor, 2000);
  const empty = computeQuote([], 'delivery', AED);
  assert.equal(empty.deliveryFeeMinor, 0);
  assert.equal(empty.totalMinor, 0);
});

const SECRET = 'whsec_test_secret';

function signed(body: string, secret: string, t: number) {
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

test('stripe signature: accepts a fresh correct signature', () => {
  const now = 1_800_000_000;
  const body = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(body, signed(body, SECRET, now), SECRET, now), true);
});

test('stripe signature: rejects wrong secret, tampered body, old timestamp and missing header', () => {
  const now = 1_800_000_000;
  const body = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(body, signed(body, 'whsec_other', now), SECRET, now), false);
  assert.equal(verifyStripeSignature('{"id":"evt_2"}', signed(body, SECRET, now), SECRET, now), false);
  assert.equal(verifyStripeSignature(body, signed(body, SECRET, now - 3600), SECRET, now), false);
  assert.equal(verifyStripeSignature(body, null, SECRET, now), false);
  assert.equal(verifyStripeSignature(body, signed(body, SECRET, now), '', now), false);
});

test('order status: only the listed transitions are allowed', () => {
  assert.equal(canTransition('placed', 'accepted'), true);
  assert.equal(canTransition('awaiting_payment', 'placed'), true);
  assert.equal(canTransition('delivered', 'accepted'), false);
  assert.equal(canTransition('placed', 'delivered'), false);
});

test('every customer and staff sentence exists in both languages', () => {
  const keys = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix.slice(0, -1)];
  const en = keys(STRINGS.en).sort();
  const ar = keys(STRINGS.ar).sort();
  assert.deepEqual(ar, en);
});
