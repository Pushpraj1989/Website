// Offers and vouchers in the cart and at checkout (Phase 6). The discount is always worked out on the server from the
// current cart. The rules are the `offers` rules: which items they cover, the minimum spend, the kind of discount, who
// may use it, and how often. One code applies to an order at a time.
import type { PoolClient } from 'pg';
import { pool } from './db.ts';
import { codeHash, normaliseCode } from './campaigns.ts';
import { RuleError } from './orders.ts';

export type CartLineFacts = { itemId: string; categoryId: string; unitMinor: number; qty: number };

export type OfferRules = {
  id: string;
  type: string;
  value: number;
  appliesTo: 'order' | 'category' | 'item';
  appliesToIds: string[];
  audience: 'guest' | 'member' | 'any';
  minSubtotalMinor: number;
  usageLimit: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  maxDiscountMinor: number | null;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  campaignStatus: string | null;
};

export type Outcome =
  | { applies: true; discountMinor: number; freeDeliveryMinor: number; label: string }
  | { applies: false; reason: string };

/** The kinds of offer that can be applied to a cart today. Others are shown as not available yet. */
export const SUPPORTED_TYPES = ['percent', 'fixed', 'free_delivery'];

/** Works out the discount for a cart. Pure: the caller passes in the facts it has read. */
export function outcomeFor(
  offer: OfferRules,
  lines: CartLineFacts[],
  subtotalMinor: number,
  deliveryFeeMinor: number,
  channel: 'delivery' | 'pickup',
  now: Date,
  eligibility: { account: boolean; memberOfPlan: boolean; usedByCustomer: number },
): Outcome {
  if (!offer.active) return { applies: false, reason: 'This offer is not running.' };
  if (offer.campaignStatus && !['active', 'scheduled'].includes(offer.campaignStatus)) return { applies: false, reason: 'This offer is not running.' };
  if (now < offer.startsAt) return { applies: false, reason: 'This offer has not started yet.' };
  if (now > offer.endsAt) return { applies: false, reason: 'This offer has ended.' };
  if (!SUPPORTED_TYPES.includes(offer.type)) return { applies: false, reason: 'This kind of offer is not available yet.' };
  if (offer.audience === 'guest' && eligibility.account) return { applies: false, reason: 'This offer is for guests only.' };
  if (offer.audience === 'member' && !eligibility.memberOfPlan) return { applies: false, reason: 'This offer is for members.' };
  if (offer.usageLimit !== null && offer.usedCount >= offer.usageLimit) return { applies: false, reason: 'This offer has been used up.' };
  if (offer.perCustomerLimit !== null && eligibility.usedByCustomer >= offer.perCustomerLimit) {
    return { applies: false, reason: 'You have used this offer as many times as it allows.' };
  }
  if (subtotalMinor < offer.minSubtotalMinor) {
    return { applies: false, reason: `Add ${((offer.minSubtotalMinor - subtotalMinor) / 100).toFixed(2)} AED more to use this offer.` };
  }
  if (offer.type === 'free_delivery') {
    if (channel !== 'delivery') return { applies: false, reason: 'This offer is for delivery orders.' };
    if (deliveryFeeMinor <= 0) return { applies: false, reason: 'Choose a delivery address with a delivery fee to use this offer.' };
    return { applies: true, discountMinor: deliveryFeeMinor, freeDeliveryMinor: deliveryFeeMinor, label: 'Free delivery' };
  }
  const eligibleLines = lines.filter((l) =>
    offer.appliesTo === 'order' ? true : offer.appliesTo === 'item' ? offer.appliesToIds.includes(l.itemId) : offer.appliesToIds.includes(l.categoryId),
  );
  const eligibleMinor = eligibleLines.reduce((sum, l) => sum + l.unitMinor * l.qty, 0);
  if (eligibleMinor === 0) return { applies: false, reason: 'This offer does not apply to the items in your cart.' };
  let amount: number;
  let label: string;
  if (offer.type === 'percent') {
    amount = Math.round((eligibleMinor * offer.value) / 10000);
    if (offer.maxDiscountMinor !== null) amount = Math.min(amount, offer.maxDiscountMinor);
    label = `${Number((offer.value / 100).toFixed(2))}% off`;
  } else {
    amount = Math.min(offer.value, eligibleMinor);
    label = `${(offer.value / 100).toFixed(2)} AED off`;
  }
  amount = Math.min(amount, eligibleMinor);
  if (amount <= 0) return { applies: false, reason: 'This offer gives no discount on your cart.' };
  return { applies: true, discountMinor: amount, freeDeliveryMinor: 0, label };
}

const OFFER_SQL = `
  select o.id, o.offer_type, o.value_int, o.applies_to, o.applies_to_ids, o.audience, o.min_subtotal_minor,
         o.usage_limit, o.used_count, o.per_customer_limit, o.max_discount_minor, o.starts_at, o.ends_at, o.active,
         cm.status as campaign_status
  from offers o left join campaigns cm on cm.id = o.campaign_id
  where o.id = $1`;

export async function offerRules(c: { query: PoolClient['query'] } = pool, offerId: string): Promise<OfferRules | null> {
  const { rows } = await c.query(OFFER_SQL, [offerId]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    type: r.offer_type,
    value: Number(r.value_int),
    appliesTo: r.applies_to,
    appliesToIds: (r.applies_to_ids ?? []) as string[],
    audience: r.audience,
    minSubtotalMinor: Number(r.min_subtotal_minor),
    usageLimit: r.usage_limit,
    usedCount: r.used_count,
    perCustomerLimit: r.per_customer_limit,
    maxDiscountMinor: r.max_discount_minor,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    active: r.active,
    campaignStatus: r.campaign_status,
  };
}

/** The customer's usage of an offer so far: by their account when signed in, otherwise by the guest session. */
export async function usageByCustomer(c: { query: PoolClient['query'] }, offerId: string, accountId: string | null, guestId: string): Promise<number> {
  const { rows } = await c.query(
    `select count(*)::int as n from offer_redemptions where offer_id = $1 and (($2::uuid is not null and customer_id = $2) or guest_key = $3)`,
    [offerId, accountId, guestId],
  );
  return rows[0].n;
}

/** Whether the guest session has an active membership. Memberships are kept per guest session today. */
export async function hasActiveMembership(c: { query: PoolClient['query'] }, guestId: string): Promise<boolean> {
  const { rows } = await c.query(`select 1 from memberships where guest_session_id = $1 and status = 'active' limit 1`, [guestId]);
  return rows.length > 0;
}

export type Applied = { kind: 'voucher'; voucherId: string; offerId: string } | { kind: 'offer'; offerId: string } | null;

/**
 * Turns a typed code into what the cart will hold. A voucher is checked the way the wallet checks it: it must be
 * usable, not expired, and not bound to someone else. A shared offer code must be running. Either way the answer for
 * "not found" and for "not yours" is the same, so codes cannot be probed.
 */
export async function resolveCode(c: PoolClient, raw: unknown, accountId: string | null): Promise<{ applied: NonNullable<Applied>; offerId: string }> {
  const code = normaliseCode(raw);
  const v = await c.query(
    `select v.id, v.offer_id, v.status, v.expires_at, v.assigned_customer_id from vouchers v where v.code_hash = $1`,
    [codeHash(code)],
  );
  const voucher = v.rows[0];
  if (voucher && !(voucher.assigned_customer_id && voucher.assigned_customer_id !== accountId)) {
    if (voucher.status === 'redeemed') throw new RuleError('This voucher has already been used.', 'used', 409);
    if (voucher.status === 'revoked') throw new RuleError('This voucher is no longer valid.', 'unavailable', 409);
    if (voucher.status === 'expired' || new Date(voucher.expires_at) <= new Date()) throw new RuleError('This voucher has expired.', 'expired', 409);
    return { applied: { kind: 'voucher', voucherId: voucher.id, offerId: voucher.offer_id }, offerId: voucher.offer_id };
  }
  const o = await c.query(`select id from offers where upper(code) = $1`, [code]);
  if (o.rows[0]) return { applied: { kind: 'offer', offerId: o.rows[0].id }, offerId: o.rows[0].id };
  throw new RuleError('That code is not valid. Check it and try again.', 'not_valid', 422);
}
