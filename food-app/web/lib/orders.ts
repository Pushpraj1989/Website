// Business rules for the slice. Route handlers call these; they never touch the data layer directly.
import { createHash } from 'node:crypto';
import * as data from './data.ts';
import type { CartLine, OrderLine, OrderRecord } from './data.ts';
import { computeQuote, type Channel, type PricedLine, type Quote } from './pricing.ts';
import { RESTAURANT, ITEMS } from './seed.ts';
import { canTransition, type OrderStatus } from './status.ts';
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

export function menuItem(id: string) {
  return ITEMS.find((item) => item.id === id) ?? null;
}

/** Validates the cart against the menu. Prices come from the server, never from the request. */
export function pricedLines(cart: CartLine[]): PricedLine[] {
  return cart.map((line) => {
    const item = menuItem(line.itemId);
    if (!item) throw new RuleError('An item in the cart is no longer on the menu.', 'item_missing');
    if (item.soldOut) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out');
    return { itemId: item.id, name: item.name.en, unitMinor: item.priceMinor, qty: line.qty };
  });
}

export function quoteFor(ownerHash: string, channel: Channel): Quote {
  const lines = pricedLines(data.getCart(ownerHash));
  return computeQuote(lines, channel, RESTAURANT.pricing);
}

export function validateCart(cart: unknown): CartLine[] {
  if (!Array.isArray(cart)) throw new RuleError('Cart must be a list.', 'bad_input', 400);
  return cart.map((raw) => {
    const line = raw as Partial<CartLine>;
    const qty = Number(line.qty);
    if (typeof line.itemId !== 'string' || !Number.isInteger(qty) || qty < 0 || qty > 20) {
      throw new RuleError('Each line needs an item and a quantity from 0 to 20.', 'bad_input', 400);
    }
    const note = typeof line.note === 'string' ? line.note.trim().slice(0, 200) : '';
    return { itemId: line.itemId, qty, note };
  }).filter((line) => line.qty > 0);
}

export function placeOrder(input: {
  ownerHash: string;
  idempotencyKey: string;
  channel: Channel;
  method: 'card' | 'cod' | 'pay_on_arrival';
  address: string | null;
}): OrderRecord {
  // A repeat with the same key returns the same order (idempotency from the architecture).
  const existing = data.findOrderByKey(input.ownerHash, input.idempotencyKey);
  if (existing) return existing;

  const cart = data.getCart(input.ownerHash);
  const lines = pricedLines(cart);
  if (lines.length === 0) throw new RuleError('Your cart is empty.', 'empty_cart');

  const methodOk =
    (input.method === 'card' && RESTAURANT.payments.card) ||
    (input.method === 'cod' && RESTAURANT.payments.cod && input.channel === 'delivery') ||
    (input.method === 'pay_on_arrival' && RESTAURANT.payments.payOnArrival && input.channel === 'pickup');
  if (!methodOk) throw new RuleError('That payment method is not available for this order.', 'method_unavailable');
  if (input.channel === 'delivery' && !input.address?.trim()) {
    throw new RuleError('A delivery address is needed.', 'address_missing', 400);
  }

  const quote = computeQuote(lines, input.channel, RESTAURANT.pricing);
  const orderLines: OrderLine[] = cart.map((line) => {
    const item = menuItem(line.itemId)!;
    return { itemId: item.id, name: item.name, unitMinor: item.priceMinor, qty: line.qty, note: line.note };
  });
  const createdAt = new Date().toISOString();
  const status: OrderStatus = input.method === 'card' ? 'awaiting_payment' : 'placed';
  const order = data.insertOrder({
    ownerHash: input.ownerHash,
    idempotencyKey: input.idempotencyKey,
    channel: input.channel,
    method: input.method,
    status,
    address: input.channel === 'delivery' ? input.address!.trim().slice(0, 300) : null,
    lines: orderLines,
    quote,
    stripePaymentIntentId: null,
    etaMinutes: null,
    history: [{ status, at: createdAt }],
    createdAt,
  });
  data.clearCart(input.ownerHash);
  return order;
}

export function ownedOrder(id: string, ownerHash: string): OrderRecord | null {
  const order = data.getOrder(id);
  return order && order.ownerHash === ownerHash ? order : null;
}

export async function cardIntentFor(order: OrderRecord) {
  if (order.method !== 'card') throw new RuleError('This order is not paid by card.', 'not_card', 409);
  if (order.status !== 'awaiting_payment') throw new RuleError('This order is not waiting for payment.', 'not_awaiting', 409);
  const intent = await paymentIntentFor(order);
  if (!order.stripePaymentIntentId) data.updateOrder(order.id, { stripePaymentIntentId: intent.id });
  return intent;
}

function move(order: OrderRecord, to: OrderStatus, extra: Partial<OrderRecord> = {}): OrderRecord {
  if (!canTransition(order.status, to)) {
    throw new RuleError(`An order cannot move from ${order.status} to ${to}.`, 'bad_transition', 409);
  }
  const at = new Date().toISOString();
  return data.updateOrder(order.id, {
    ...extra,
    status: to,
    history: [...order.history, { status: to, at }],
  })!;
}

export function acceptOrder(id: string, etaMinutes: number): OrderRecord {
  const order = data.getOrder(id);
  if (!order) throw new RuleError('Order not found.', 'not_found', 404);
  if (!Number.isInteger(etaMinutes) || etaMinutes < 5 || etaMinutes > 180) {
    throw new RuleError('The time estimate must be between 5 and 180 minutes.', 'bad_input', 400);
  }
  return move(order, 'accepted', { etaMinutes });
}

export function setOrderStatus(id: string, to: OrderStatus): OrderRecord {
  const order = data.getOrder(id);
  if (!order) throw new RuleError('Order not found.', 'not_found', 404);
  return move(order, to);
}

/**
 * Confirms a card payment from a verified Stripe event. Never trusts the client. Refuses an amount or
 * currency that does not match the order, and treats a repeat as a no-op.
 */
export function confirmCardPayment(intentId: string, orderId: string | null, amountMinor: number, currency: string): 'paid' | 'duplicate' | 'mismatch' | 'unknown' {
  const order = orderId ? data.getOrder(orderId) : null;
  const byIntent = order ?? data.findOrderByPaymentIntent(intentId);
  if (!byIntent) return 'unknown';
  if (byIntent.status !== 'awaiting_payment') return 'duplicate';
  if (amountMinor !== byIntent.quote.totalMinor || currency.toUpperCase() !== byIntent.quote.currency) return 'mismatch';
  move(byIntent, 'placed', { stripePaymentIntentId: intentId });
  return 'paid';
}

export function customerView(order: OrderRecord) {
  return {
    id: order.id,
    number: order.number,
    channel: order.channel,
    method: order.method,
    status: order.status,
    etaMinutes: order.etaMinutes,
    lines: order.lines.map((l) => ({ name: l.name, qty: l.qty, note: l.note, unitMinor: l.unitMinor })),
    quote: order.quote,
    address: order.address,
    history: order.history,
  };
}
