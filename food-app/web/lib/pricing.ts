import { minorDigitsOf } from './money.ts';

// Restaurant pricing inputs. Values here are placeholders until the client confirms them.
export type PricingSettings = {
  currency: string;
  taxLabel: string;
  taxBasisPoints: number; // 500 = 5%
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  pricesIncludeTax: true;
};

export type PricedLine = { itemId: string; name: string; unitMinor: number; qty: number };

/** delivery: own riders inside the areas; pickup; shipping: by courier anywhere (retail mode). */
export type Channel = 'delivery' | 'pickup' | 'shipping';

export type Quote = {
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
  tipMinor: number;
  totalMinor: number;
  taxLabel: string;
  taxBasisPoints: number;
  taxIncludedMinor: number;
};

/**
 * Server-side totals. Menu prices include tax (the common UAE display), so the tax shown is the part of the
 * total that tax takes out. It is rounded once, here, at the total, half up.
 */
export function computeQuote(lines: PricedLine[], channel: Channel, settings: PricingSettings, discountMinor = 0): Quote {
  minorDigitsOf(settings.currency); // fails fast if the currency is not in the table
  const subtotalMinor = lines.reduce((sum, line) => sum + line.unitMinor * line.qty, 0);
  const deliveryFeeMinor = (channel === 'delivery' || channel === 'shipping') && subtotalMinor > 0 ? settings.deliveryFeeMinor : 0;
  const serviceFeeMinor = subtotalMinor > 0 ? settings.serviceFeeMinor : 0;
  const tipMinor = 0;
  if (discountMinor < 0 || discountMinor > subtotalMinor + deliveryFeeMinor) throw new Error('A discount cannot be negative or larger than the order.');
  const totalMinor = subtotalMinor - discountMinor + deliveryFeeMinor + serviceFeeMinor + tipMinor;
  const taxIncludedMinor = Math.round((totalMinor * settings.taxBasisPoints) / (10000 + settings.taxBasisPoints));
  return {
    currency: settings.currency,
    subtotalMinor,
    deliveryFeeMinor,
    serviceFeeMinor,
    discountMinor,
    tipMinor,
    totalMinor,
    taxLabel: settings.taxLabel,
    taxBasisPoints: settings.taxBasisPoints,
    taxIncludedMinor,
  };
}

/** Returns the integer the table check in schema.sql enforces: total = subtotal - discount + fees + tip. */
export function totalIsConsistent(q: Quote): boolean {
  return q.totalMinor === q.subtotalMinor - q.discountMinor + q.deliveryFeeMinor + q.serviceFeeMinor + q.tipMinor;
}
