// Business rules for the slice. Route handlers call these; they never touch SQL directly.
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import * as data from './data.ts';
import type { CartLine, OrderRow } from './data.ts';
import { pool, withTx } from './db.ts';
import { computeQuote, type Channel, type PricedLine, type Quote } from './pricing.ts';
import { canTransition, ORDER_STATUSES, type OrderStatus } from './status.ts';
import { paymentIntentFor } from './payments/stripe.ts';

export class RuleError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
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

async function settingsFor(channel: Channel, zone: data.Zone | null) {
  const restaurant = await data.getRestaurant();
  return {
    restaurant,
    settings: {
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      deliveryFeeMinor: channel === 'delivery' ? zone?.feeMinor ?? 0 : 0,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      pricesIncludeTax: true as const,
    },
  };
}

export type DeliveryQuote = { zoneId: string; zoneName: data.Localised; minOrderMinor: number; deliverable: boolean } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SAVED_ADDRESSES = 10;

/** The zone of a saved address, or a rule error when the address is not the customer's or is outside every zone. */
async function zoneForOrder(c: PoolClient, guestId: string, addressId: string | null): Promise<data.Zone> {
  if (!addressId || !UUID.test(addressId)) throw new RuleError('Choose a delivery address.', 'address_missing', 400);
  const address = await data.findSavedAddress(c, guestId, addressId);
  if (!address) throw new RuleError('That address is not on your account.', 'address_missing', 422);
  if (!address.zone || !address.zone.active) throw new RuleError('We do not deliver to that address.', 'outside_zone');
  return { id: address.zone.id, name: address.zone.name, feeMinor: address.zone.feeMinor, minOrderMinor: address.zone.minOrderMinor };
}

/** Prices the cart. With an address, the delivery fee and the zone minimum come from that address's zone. */
export async function quoteFor(guestId: string, channel: Channel, addressId: string | null = null): Promise<{ quote: Quote; delivery: DeliveryQuote }> {
  const lines = await pricedLines(await data.getCart(guestId));
  let zone: data.Zone | null = null;
  let delivery: DeliveryQuote = null;
  if (channel === 'delivery' && addressId && UUID.test(addressId)) {
    const address = await data.findSavedAddress(pool, guestId, addressId);
    if (address?.zone && address.zone.active) {
      zone = { id: address.zone.id, name: address.zone.name, feeMinor: address.zone.feeMinor, minOrderMinor: address.zone.minOrderMinor };
    }
  }
  const { settings } = await settingsFor(channel, zone);
  const quote = computeQuote(lines, channel, settings);
  if (zone) delivery = { zoneId: zone.id, zoneName: zone.name, minOrderMinor: zone.minOrderMinor, deliverable: quote.subtotalMinor >= zone.minOrderMinor };
  return { quote, delivery };
}

export function validateAddress(raw: unknown): data.AddressFields & { zoneId: string } {
  const body = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string, max: number) => (typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, max) : '');
  const line1 = text('line1', 200);
  if (line1.length < 3) throw new RuleError('Enter the street, building and area.', 'bad_input', 400);
  const hasLat = body.lat !== undefined && body.lat !== null;
  const hasLng = body.lng !== undefined && body.lng !== null;
  if (hasLat !== hasLng) throw new RuleError('Send both latitude and longitude, or neither.', 'bad_input', 400);
  const lat = hasLat ? Number(body.lat) : null;
  const lng = hasLng ? Number(body.lng) : null;
  if (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) throw new RuleError('The latitude is not valid.', 'bad_input', 400);
  if (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180)) throw new RuleError('The longitude is not valid.', 'bad_input', 400);
  const zoneId = text('zoneId', 40);
  if (zoneId && !UUID.test(zoneId)) throw new RuleError('Choose one of the delivery areas.', 'bad_input', 400);
  return {
    label: text('label', 30) || 'Home',
    line1,
    line2: text('line2', 200),
    notes: text('notes', 200),
    zoneId,
    lat,
    lng,
    isDefault: body.isDefault === true,
  };
}

/** The zone an address belongs to: from its coordinates when it has them, otherwise the zone the customer picked. */
async function resolveZone(c: PoolClient, f: { zoneId: string; lat: number | null; lng: number | null }): Promise<data.Zone> {
  if (f.lat !== null && f.lng !== null) {
    const zone = await data.zoneAt(c, f.lat, f.lng);
    if (!zone) throw new RuleError('We do not deliver to this address yet.', 'outside_zone');
    return zone;
  }
  if (!f.zoneId) throw new RuleError('Choose a delivery area for this address.', 'zone_required', 422);
  const zone = await data.activeZone(c, f.zoneId);
  if (!zone) throw new RuleError('Choose one of the delivery areas.', 'zone_missing', 422);
  return zone;
}

export function listAddresses(guestId: string) {
  return data.listSavedAddresses(guestId);
}

export async function saveAddress(guestId: string, raw: unknown): Promise<data.SavedAddress> {
  const f = validateAddress(raw);
  return withTx(async (c: PoolClient) => {
    const count = await data.countSavedAddresses(c, guestId);
    if (count >= MAX_SAVED_ADDRESSES) throw new RuleError(`You can save up to ${MAX_SAVED_ADDRESSES} addresses. Delete one to add another.`, 'address_limit', 422);
    const zone = await resolveZone(c, f);
    // The first address is the default. Making one the default moves the default away from the others.
    const isDefault = f.isDefault || count === 0;
    if (isDefault) await data.clearDefaultAddress(c, guestId);
    const id = await data.insertSavedAddress(c, guestId, { ...f, zoneId: zone.id, isDefault });
    return (await data.findSavedAddress(c, guestId, id))!;
  });
}

export async function updateAddress(guestId: string, id: string, raw: unknown): Promise<data.SavedAddress> {
  if (!UUID.test(id)) throw new RuleError('Address not found.', 'not_found', 404);
  const f = validateAddress(raw);
  return withTx(async (c: PoolClient) => {
    const existing = await data.findSavedAddress(c, guestId, id);
    if (!existing) throw new RuleError('Address not found.', 'not_found', 404);
    const zone = await resolveZone(c, f);
    // The default stays the default until another address is made the default.
    const isDefault = existing.isDefault || f.isDefault;
    if (!existing.isDefault && f.isDefault) await data.clearDefaultAddress(c, guestId);
    await data.updateSavedAddress(c, guestId, id, { ...f, zoneId: zone.id, isDefault });
    return (await data.findSavedAddress(c, guestId, id))!;
  });
}

export async function removeAddress(guestId: string, id: string): Promise<void> {
  if (!UUID.test(id)) throw new RuleError('Address not found.', 'not_found', 404);
  await withTx(async (c: PoolClient) => {
    const { removed, wasDefault } = await data.deleteSavedAddress(c, guestId, id);
    if (!removed) throw new RuleError('Address not found.', 'not_found', 404);
    if (wasDefault) await data.promoteNewestAddress(c, guestId);
  });
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
  addressId: string | null;
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
    const zone = input.channel === 'delivery' ? await zoneForOrder(c, input.guestId, input.addressId) : null;

    const settings = {
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      deliveryFeeMinor: zone?.feeMinor ?? 0,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      pricesIncludeTax: true as const,
    };
    const quote = computeQuote(priced.map((p) => ({ itemId: p.itemId, name: p.name.en, unitMinor: p.unitMinor, qty: p.qty })), input.channel, settings);
    if (zone && quote.subtotalMinor < zone.minOrderMinor) {
      throw new RuleError('This area needs a larger order before delivery.', 'below_minimum');
    }
    const status: OrderStatus = input.method === 'card' ? 'awaiting_payment' : 'placed';
    const orderAddressId = zone ? await data.copyAddressForOrder(c, input.guestId, input.addressId!) : null;
    const id = await data.insertOrder(c, {
      guestId: input.guestId,
      idempotencyKey: input.idempotencyKey,
      channel: input.channel,
      method: input.method,
      status,
      addressId: orderAddressId,
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
