// Holding, finalising and releasing offers and vouchers around an order (Phase 6). The order is the unit: what it
// holds is recorded on the order, so confirming or releasing acts on exactly that.
//   Voucher: held at checkout (reservation), redeemed when the order is confirmed, back to available if released.
//   Shared offer code: its usage is counted at checkout, its redemption is recorded when the order is confirmed,
//   and the count is given back if the order is released.
// A card order is confirmed by the payment webhook; a cash or pay-on-arrival order is confirmed when it is placed.
import type { PoolClient } from 'pg';
import { codeHash } from './campaigns.ts';
import { outcomeFor, offerRules, resolveCode, usageByCustomer, hasActiveMembership, type Applied, type CartLineFacts, type Outcome } from './discounts.ts';
import { RuleError } from './orders.ts';

/** How long a card order may wait for payment before it is cancelled and its hold released. */
export const CARD_PAYMENT_MINUTES = 30;

export type Held = { applied: Applied; voucherId: string | null; offerId: string | null; outcome: Outcome; reason?: string };

/** What the cart holds, and whether it still applies to the cart as it is now. */
export async function cartOffer(
  c: { query: PoolClient['query'] },
  guestId: string,
  accountId: string | null,
  lines: CartLineFacts[],
  subtotalMinor: number,
  deliveryFeeMinor: number,
  channel: 'delivery' | 'pickup',
): Promise<Held | null> {
  const { rows } = await c.query(`select applied_voucher_id, applied_offer_id from carts where guest_session_id = $1`, [guestId]);
  const row = rows[0];
  if (!row || (!row.applied_voucher_id && !row.applied_offer_id)) return null;
  let applied: Applied;
  let voucherId: string | null = null;
  let offerId: string;
  let problem: string | undefined;
  if (row.applied_voucher_id) {
    const v = await c.query(`select id, offer_id, status, expires_at, assigned_customer_id from vouchers where id = $1`, [row.applied_voucher_id]);
    const voucher = v.rows[0];
    voucherId = row.applied_voucher_id;
    offerId = voucher?.offer_id ?? '';
    applied = { kind: 'voucher', voucherId: voucherId!, offerId };
    if (!voucher) problem = 'This voucher is no longer valid.';
    else if (voucher.assigned_customer_id && voucher.assigned_customer_id !== accountId) problem = 'This voucher is no longer valid.';
    else if (voucher.status === 'redeemed') problem = 'This voucher has already been used.';
    else if (voucher.status === 'revoked') problem = 'This voucher is no longer valid.';
    else if (voucher.status === 'expired' || new Date(voucher.expires_at) <= new Date()) problem = 'This voucher has expired.';
  } else {
    offerId = row.applied_offer_id;
    applied = { kind: 'offer', offerId };
  }
  const rules = await offerRules(c, offerId);
  if (!rules) return { applied, voucherId, offerId, outcome: { applies: false, reason: 'This offer is no longer available.' }, reason: 'This offer is no longer available.' };
  if (problem) return { applied, voucherId, offerId, outcome: { applies: false, reason: problem }, reason: problem };
  const outcome = outcomeFor(rules, lines, subtotalMinor, deliveryFeeMinor, channel, new Date(), {
    account: accountId !== null,
    memberOfPlan: await hasActiveMembership(c, guestId),
    usedByCustomer: await usageByCustomer(c, offerId, accountId, guestId),
  });
  return { applied, voucherId, offerId, outcome, reason: outcome.applies ? undefined : outcome.reason };
}

/** Applies a typed code to the cart. Refused with the reason when it cannot apply to the cart as it is now. */
export async function applyCode(c: PoolClient, guestId: string, accountId: string | null, raw: unknown, lines: CartLineFacts[], subtotalMinor: number, deliveryFeeMinor: number, channel: 'delivery' | 'pickup') {
  const { applied, offerId } = await resolveCode(c, raw, accountId);
  const rules = await offerRules(c, offerId);
  if (!rules) throw new RuleError('That code is not valid. Check it and try again.', 'not_valid', 422);
  const outcome = outcomeFor(rules, lines, subtotalMinor, deliveryFeeMinor, channel, new Date(), {
    account: accountId !== null,
    memberOfPlan: await hasActiveMembership(c, guestId),
    usedByCustomer: await usageByCustomer(c, offerId, accountId, guestId),
  });
  if (!outcome.applies) throw new RuleError(outcome.reason, 'offer_not_applicable', 422);
  if (applied.kind === 'voucher') {
    await c.query(`update carts set applied_voucher_id = $2, applied_offer_id = null, updated_at = now() where guest_session_id = $1`, [guestId, applied.voucherId]);
  } else {
    await c.query(`update carts set applied_offer_id = $2, applied_voucher_id = null, updated_at = now() where guest_session_id = $1`, [guestId, applied.offerId]);
  }
  return outcome;
}

export async function removeCode(c: { query: PoolClient['query'] }, guestId: string) {
  await c.query(`update carts set applied_voucher_id = null, applied_offer_id = null, updated_at = now() where guest_session_id = $1`, [guestId]);
}

/**
 * Takes the hold for an order that is being placed. Called inside the placing transaction, with the cart locked.
 * Throws when the voucher is gone or taken by another checkout, or the shared offer is used up or no longer applies.
 */
export async function reserveForOrder(c: PoolClient, orderId: string, held: Held, accountId: string | null, guestId: string) {
  if (!held.applied) return;
  if (held.applied.kind === 'voucher') {
    const v = await c.query(`select id, status from vouchers where id = $1 for update`, [held.voucherId]);
    if (!v.rows[0] || v.rows[0].status !== 'available') throw new RuleError('That voucher is no longer available. Remove it and try again.', 'voucher_unavailable', 409);
    try {
      await c.query(
        `insert into voucher_reservations (voucher_id, customer_id, order_id, status, expires_at) values ($1, $2, $3, 'held', now() + interval '${CARD_PAYMENT_MINUTES} minutes')`,
        [held.voucherId, accountId, orderId],
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new RuleError('That voucher is being used in another checkout. Try again in a moment.', 'voucher_busy', 409);
      throw err;
    }
  } else {
    const taken = await c.query(
      `update offers set used_count = used_count + 1 where id = $1 and (usage_limit is null or used_count < usage_limit) returning id`,
      [held.offerId],
    );
    if (!taken.rows[0]) throw new RuleError('This offer has been used up.', 'offer_used_up', 409);
    const rules = await offerRules(c, held.offerId!);
    if (rules?.perCustomerLimit !== null && rules && (await usageByCustomer(c, rules.id, accountId, guestId)) >= rules.perCustomerLimit) {
      throw new RuleError('You have used this offer as many times as it allows.', 'offer_limit', 409);
    }
  }
  await c.query(
    `update orders set applied_voucher_id = $2, applied_offer_id = $3, applied_account_id = $4, offer_reserved = true where id = $1`,
    [orderId, held.voucherId, held.offerId, accountId],
  );
}

/** Records the redemption. Called when the order is confirmed: at placement for cash orders, at payment for card. */
export async function finalizeOrderOffer(c: PoolClient, orderId: string) {
  const { rows } = await c.query(
    `select id, guest_session_id, applied_voucher_id, applied_offer_id, applied_account_id, discount_minor, offer_reserved, offer_finalised
     from orders where id = $1 for update`,
    [orderId],
  );
  const o = rows[0];
  if (!o || !o.offer_reserved || o.offer_finalised || !o.applied_offer_id) return;
  if (o.applied_voucher_id) {
    const redeemed = await c.query(`update vouchers set status = 'redeemed' where id = $1 and status = 'available' returning id`, [o.applied_voucher_id]);
    if (!redeemed.rows[0]) throw new RuleError('That voucher was used by another order first.', 'voucher_unavailable', 409);
    await c.query(`update voucher_reservations set status = 'consumed' where voucher_id = $1 and order_id = $2 and status = 'held'`, [o.applied_voucher_id, orderId]);
    await c.query(`insert into voucher_ledger (voucher_id, event, customer_id, order_id, amount_minor) values ($1,'redeemed',$2,$3,$4)`, [o.applied_voucher_id, o.applied_account_id, orderId, o.discount_minor]);
  }
  await c.query(
    `insert into offer_redemptions (offer_id, order_id, customer_id, guest_key, amount_minor, voucher_id) values ($1,$2,$3,$4,$5,$6)`,
    [o.applied_offer_id, orderId, o.applied_account_id, o.guest_session_id, o.discount_minor, o.applied_voucher_id],
  );
  await c.query(`update orders set offer_finalised = true where id = $1`, [orderId]);
}

/**
 * Gives back what an order held: a held voucher is released, a redeemed voucher is made available again, and a shared
 * offer's count is given back. Running it twice does nothing the second time.
 */
export async function releaseOrderOffer(c: PoolClient, orderId: string) {
  const { rows } = await c.query(`select applied_voucher_id, applied_offer_id, offer_reserved, offer_finalised from orders where id = $1 for update`, [orderId]);
  const o = rows[0];
  if (!o || !o.offer_reserved) return;
  if (o.offer_finalised) {
    await c.query(`delete from offer_redemptions where order_id = $1`, [orderId]);
    if (o.applied_voucher_id) {
      const back = await c.query(`update vouchers set status = 'available' where id = $1 and status = 'redeemed' returning id`, [o.applied_voucher_id]);
      if (back.rows[0]) {
        await c.query(`update voucher_reservations set status = 'released' where voucher_id = $1 and order_id = $2`, [o.applied_voucher_id, orderId]);
        await c.query(`insert into voucher_ledger (voucher_id, event, order_id) values ($1,'reversed',$2)`, [o.applied_voucher_id, orderId]);
      }
    }
    if (o.applied_offer_id && !o.applied_voucher_id) {
      await c.query(`update offers set used_count = greatest(used_count - 1, 0) where id = $1`, [o.applied_offer_id]);
    }
  } else {
    if (o.applied_voucher_id) {
      await c.query(`update voucher_reservations set status = 'released' where voucher_id = $1 and order_id = $2 and status = 'held'`, [o.applied_voucher_id, orderId]);
    } else if (o.applied_offer_id) {
      await c.query(`update offers set used_count = greatest(used_count - 1, 0) where id = $1`, [o.applied_offer_id]);
    }
  }
  await c.query(`update orders set offer_reserved = false, offer_finalised = false where id = $1`, [orderId]);
}
