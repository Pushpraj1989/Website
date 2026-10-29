// Business rules for the slice. Route handlers call these; they never touch SQL directly.
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import * as data from './data.ts';
import type { CartLine, OrderRow } from './data.ts';
import { withTx } from './db.ts';
import { computeQuote, type Channel, type PricedLine, type Quote } from './pricing.ts';
import { canTransition, ORDER_STATUSES, type OrderStatus } from './status.ts';
import { paymentIntentFor } from './payments/stripe.ts';

export class RuleError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 422,
  ) {
    super(message);
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Prices the cart from the database. Prices never come from the request. */
export async function pricedLines(cart: CartLine[]): Promise<PricedLine[]> {
  const items = await data.getItems(cart.map((l) => l.itemId));
  return cart.map((line) => {
    const item = items.get(line.itemId);
    if (!item) throw new RuleError('An item in the cart is no longer on the menu.', 'item_missing');
    if (item.soldOut) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out');
    return { itemId: item.id, name: item.name.en, unitMinor: item.priceMinor, qty: line.qty };
  });
}

async function settingsFor(channel: Channel) {
  const restaurant = await data.getRestaurant();
  return {
    restaurant,
    settings: {
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      deliveryFeeMinor: channel === 'delivery' ? await data.deliveryFeeMinor() : 0,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      pricesIncludeTax: true as const,
    },
  };
}

export async function quoteFor(guestId: string, channel: Channel): Promise<Quote> {
  const lines = await pricedLines(await data.getCart(guestId));
  const { settings } = await settingsFor(channel);
  return computeQuote(lines, channel, settings);
}

export function validateCart(cart: unknown): CartLine[] {
  if (!Array.isArray(cart)) throw new RuleError('Cart must be a list.', 'bad_input', 400);
  return cart
    .map((raw) => {
      const line = raw as Partial<CartLine>;
      const qty = Number(line.qty);
      if (typeof line.itemId !== 'string' || !Number.isInteger(qty) || qty < 0 || qty > 20) {
        throw new RuleError('Each line needs an item and a quantity from 0 to 20.', 'bad_input', 400);
      }
      const note = typeof line.note === 'string' ? line.note.trim().slice(0, 200) : '';
      return { itemId: line.itemId, qty, note };
    })
    .filter((line) => line.qty > 0);
}

export async function placeOrder(input: {
  guestId: string;
  idempotencyKey: string;
  channel: Channel;
  method: 'card' | 'cod' | 'pay_on_arrival';
  address: string | null;
  locale: 'en' | 'ar';
}): Promise<OrderRow> {
  // A repeat with the same key returns the same order (idempotency from the architecture).
  const existing = await data.findOrderByKey(input.guestId, input.idempotencyKey);
  if (existing) return existing;

  const orderId = await withTx(async (c: PoolClient) => {
    // Lock the cart's items for the length of the transaction, then re-check availability and price here.
    const cart = await c.query('select items from carts where guest_session_id = $1 for update', [input.guestId]);
    const lines = (cart.rows[0]?.items ?? []) as CartLine[];
    if (lines.length === 0) throw new RuleError('Your cart is empty.', 'empty_cart');
    const ids = lines.map((l) => l.itemId);
    const items = await c.query(
      `select id, name_en, name_ar, base_price_minor, available from menu_items where id = any($1::uuid[]) for update`,
      [ids],
    );
    const byId = new Map<string, { name: { en: string; ar: string }; price: number; available: boolean }>(
      items.rows.map((r) => [r.id, { name: { en: r.name_en, ar: r.name_ar }, price: r.base_price_minor, available: r.available }]),
    );
    const priced = lines.map((line) => {
      const item = byId.get(line.itemId);
      if (!item) throw new RuleError('An item in the cart is no longer on the menu.', 'item_missing');
      if (!item.available) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out');
      return { itemId: line.itemId, name: item.name, unitMinor: item.price, qty: line.qty, note: line.note };
    });

    const restaurant = await data.getRestaurant(c);
    const methodOk =
      (input.method === 'card' && restaurant.payments.card) ||
      (input.method === 'cod' && restaurant.payments.cod && input.channel === 'delivery') ||
      (input.method === 'pay_on_arrival' && restaurant.payments.payOnArrival && input.channel === 'pickup');
    if (!methodOk) throw new RuleError('That payment method is not available for this order.', 'method_unavailable');
    if (input.channel === 'delivery' && !input.address?.trim()) {
      throw new RuleError('A delivery address is needed.', 'address_missing', 400);
    }

    const settings = {
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      deliveryFeeMinor: input.channel === 'delivery' ? await data.deliveryFeeMinor(c) : 0,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      pricesIncludeTax: true as const,
    };
    const quote = computeQuote(priced.map((p) => ({ itemId: p.itemId, name: p.name.en, unitMinor: p.unitMinor, qty: p.qty })), input.channel, settings);
    const status: OrderStatus = input.method === 'card' ? 'awaiting_payment' : 'placed';
    const id = await data.insertOrder(c, {
      guestId: input.guestId,
      idempotencyKey: input.idempotencyKey,
      channel: input.channel,
      method: input.method,
      status,
      address: input.channel === 'delivery' ? input.address!.trim().slice(0, 300) : null,
      locale: input.locale,
      quote: { ...quote, taxIncludedMinor: quote.taxIncludedMinor },
      lines: priced,
    });
    if (id) await c.query('update carts set items = $2, updated_at = now() where guest_session_id = $1', [input.guestId, '[]']);
    return id;
  });
  if (!orderId) {
    // A concurrent request with the same key committed first. Return that order.
    return (await data.findOrderByKey(input.guestId, input.idempotencyKey))!;
  }
  return (await data.getOrder(orderId))!;
}

export async function ownedOrder(id: string, guestId: string): Promise<OrderRow | null> {
  const order = await data.getOrder(id);
  return order && order.guestSessionId === guestId ? order : null;
}

export async function cardIntentFor(order: OrderRow) {
  if (order.method !== 'card') throw new RuleError('This order is not paid by card.', 'not_card', 409);
  if (order.status !== 'awaiting_payment') throw new RuleError('This order is not waiting for payment.', 'not_awaiting', 409);
  const intent = await paymentIntentFor({
    id: order.id,
    paymentIntentId: order.paymentIntentId,
    totalMinor: order.totalMinor,
    currency: order.currency,
  });
  if (intent.created) {
    await withTx((c) => data.attachPaymentIntent(c, order.id, intent.id, order.totalMinor, order.currency));
  }
  return intent;
}

/** Moves an order to `to` if the state machine allows it from its current state, in one conditional update. */
async function moveOrder(id: string, to: OrderStatus, actor: { kind: 'staff' | 'gateway' | 'system' }, extra: { etaMinutes?: number } = {}) {
  const from = ORDER_STATUSES.filter((s) => canTransition(s, to));
  const moved = await withTx((c) => data.transitionOrder(c, id, from, to, actor, extra));
  if (!moved) {
    const current = await data.getOrder(id);
    if (!current) throw new RuleError('Order not found.', 'not_found', 404);
    throw new RuleError(`An order cannot move from ${current.status} to ${to}.`, 'bad_transition', 409);
  }
  return (await data.getOrder(id))!;
}

export async function acceptOrder(id: string, etaMinutes: number): Promise<OrderRow> {
  if (!Number.isInteger(etaMinutes) || etaMinutes < 5 || etaMinutes > 180) {
    throw new RuleError('The time estimate must be between 5 and 180 minutes.', 'bad_input', 400);
  }
  return moveOrder(id, 'accepted', { kind: 'staff' }, { etaMinutes });
}

export async function setOrderStatus(id: string, to: OrderStatus): Promise<OrderRow> {
  return moveOrder(id, to, { kind: 'staff' });
}

/**
 * Confirms a card payment from a verified Stripe event. Refuses an amount or currency that does not match
 * the order. A repeat is a no-op, because the transition only applies to awaiting_payment orders.
 */
export async function confirmCardPayment(
  intentId: string,
  orderId: string | null,
  amountMinor: number,
  currency: string,
): Promise<'paid' | 'duplicate' | 'mismatch' | 'unknown'> {
  const order = orderId ? await data.getOrder(orderId) : await data.findOrderByPaymentIntent(intentId);
  if (!order) return 'unknown';
  if (order.status !== 'awaiting_payment') return 'duplicate';
  if (amountMinor !== order.totalMinor || currency.toUpperCase() !== order.currency) return 'mismatch';
  return withTx(async (c) => {
    const moved = await data.transitionOrder(c, order.id, ['awaiting_payment'], 'placed', { kind: 'gateway' });
    if (!moved) return 'duplicate';
    await data.markPaymentCaptured(c, intentId, order.id);
    return 'paid';
  });
}

export function customerView(order: OrderRow) {
  return {
    id: order.id,
    number: order.number,
    channel: order.channel,
    method: order.method,
    status: order.status,
    etaMinutes: order.etaMinutes,
    lines: order.lines.map((l) => ({ name: l.name, qty: l.qty, note: l.note, unitMinor: l.unitMinor })),
    quote: {
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      serviceFeeMinor: order.serviceFeeMinor,
      totalMinor: order.totalMinor,
      taxLabel: order.taxLabel,
      taxIncludedMinor: order.vatMinor,
    },
    address: order.address,
    history: order.history,
  };
}
