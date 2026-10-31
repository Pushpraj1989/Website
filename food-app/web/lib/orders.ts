// Business rules for the slice. Route handlers call these; they never touch SQL directly.
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import * as data from './data.ts';
import type { CartLine, OrderRow } from './data.ts';
import { pool, withTx } from './db.ts';
import { computeQuote, type Channel, type PricedLine, type Quote } from './pricing.ts';
import { canTransition, ORDER_STATUSES, type OrderStatus } from './status.ts';
import { paymentIntentFor } from './payments/stripe.ts';
import { applyCode, cartOffer, finalizeOrderOffer, releaseOrderOffer, removeCode, reserveForOrder, CARD_PAYMENT_MINUTES, type Held } from './offers-checkout.ts';
import type { CartLineFacts } from './discounts.ts';
import { activeRate, shippingFee, type ShippingRate } from './shipping.ts';

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

/**
 * What one cart line is: its price, the name it is sold under and its variant. A product sold in versions needs one
 * of its active variants; its name then carries the variant ("T-shirt · M / Black"). Prices come from the database.
 */
export function resolveLine(item: data.MenuItem | undefined, line: CartLine) {
  if (!item) throw new RuleError('An item in the cart is no longer on the menu.', 'item_missing');
  if (item.variants.length) {
    const variant = item.variants.find((v) => v.id === line.variantId);
    if (!variant) throw new RuleError(`Choose an option for ${item.name.en}.`, 'variant_required');
    if (variant.soldOut || item.soldOut) throw new RuleError(`${item.name.en} (${variant.name.en}) is sold out.`, 'sold_out');
    return {
      unitMinor: variant.priceMinor,
      name: { en: `${item.name.en} · ${variant.name.en}`, ar: `${item.name.ar} · ${variant.name.ar}` },
      variantId: variant.id,
    };
  }
  if (line.variantId) throw new RuleError('That option is no longer available.', 'item_missing');
  if (item.soldOut) throw new RuleError(`${item.name.en} is sold out.`, 'sold_out');
  return { unitMinor: item.priceMinor, name: item.name, variantId: null };
}

/** Prices the cart from the database. Prices never come from the request. */
export async function pricedLines(cart: CartLine[]): Promise<PricedLine[]> {
  const items = await data.getItems(cart.map((l) => l.itemId));
  return cart.map((line) => {
    const r = resolveLine(items.get(line.itemId), line);
    return { itemId: line.itemId, name: r.name.en, unitMinor: r.unitMinor, qty: line.qty };
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

/** Offers and vouchers treat a courier order as a delivery: a free-delivery code covers the shipping fee. */
const offerChannel = (channel: Channel): 'delivery' | 'pickup' => (channel === 'pickup' ? 'pickup' : 'delivery');

/** A courier order's address: one of the customer's, with a street, city and country. */
async function shippingAddress(c: PoolClient | typeof pool, guestId: string, addressId: string | null) {
  if (!addressId || !UUID.test(addressId)) throw new RuleError('Add the address to ship to.', 'address_missing', 400);
  const address = await data.findSavedAddress(c, guestId, addressId);
  if (!address) throw new RuleError('That address is not on your account.', 'address_missing', 422);
  if (!address.city || !address.country) throw new RuleError('Add the city and country to this address to ship to it.', 'address_incomplete', 422);
  return address;
}

/** Prices the cart. With an address, the delivery fee and the zone minimum come from that address's zone. */
export async function quoteFor(guestId: string, channel: Channel, addressId: string | null = null, accountId: string | null = null, shippingRateId: string | null = null): Promise<{ quote: Quote; delivery: DeliveryQuote; offer: OfferView | null; shipping?: { rateId: string; feeMinor: number } | null }> {
  const cartLines = await data.getCart(guestId);
  const lines = await pricedLines(cartLines);
  if (channel === 'shipping') return quoteShipping(guestId, cartLines, lines, addressId, accountId, shippingRateId);
  let zone: data.Zone | null = null;
  let delivery: DeliveryQuote = null;
  if (channel === 'delivery' && addressId && UUID.test(addressId)) {
    const address = await data.findSavedAddress(pool, guestId, addressId);
    if (address?.zone && address.zone.active) {
      zone = { id: address.zone.id, name: address.zone.name, feeMinor: address.zone.feeMinor, minOrderMinor: address.zone.minOrderMinor };
    }
  }
  const { settings } = await settingsFor(channel, zone);
  const plain = computeQuote(lines, channel, settings);
  // The cart's code, checked against this cart now. It only takes effect when it still applies.
  const held = await cartOffer(pool, guestId, accountId, await linesFacts(cartLines), plain.subtotalMinor, plain.deliveryFeeMinor, offerChannel(channel));
  const discount = held && held.outcome.applies ? held.outcome.discountMinor : 0;
  const quote = discount ? computeQuote(lines, channel, settings, discount) : plain;
  if (zone) delivery = { zoneId: zone.id, zoneName: zone.name, minOrderMinor: zone.minOrderMinor, deliverable: quote.subtotalMinor >= zone.minOrderMinor };
  return { quote, delivery, offer: held ? offerView(held) : null };
}

/** The quote for a courier order: the chosen rate's fee (free above its amount). Without a rate yet, no fee. */
async function quoteShipping(guestId: string, cartLines: CartLine[], lines: PricedLine[], addressId: string | null, accountId: string | null, rateId: string | null) {
  const rate = rateId ? await activeRate(pool, rateId) : null;
  if (addressId) await shippingAddress(pool, guestId, addressId);
  const restaurant = await data.getRestaurant();
  const subtotal = lines.reduce((n, l) => n + l.unitMinor * l.qty, 0);
  const settings = {
    currency: restaurant.currency,
    taxLabel: restaurant.taxLabel,
    taxBasisPoints: restaurant.taxBasisPoints,
    deliveryFeeMinor: rate ? shippingFee(rate, subtotal) : 0,
    serviceFeeMinor: restaurant.serviceFeeMinor,
    pricesIncludeTax: true as const,
  };
  const plain = computeQuote(lines, 'shipping', settings);
  const held = await cartOffer(pool, guestId, accountId, await linesFacts(cartLines), plain.subtotalMinor, plain.deliveryFeeMinor, 'delivery');
  const discount = held && held.outcome.applies ? held.outcome.discountMinor : 0;
  const quote = discount ? computeQuote(lines, 'shipping', settings, discount) : plain;
  return { quote, delivery: null, offer: held ? offerView(held) : null, shipping: rate ? { rateId: rate.id, feeMinor: settings.deliveryFeeMinor } : null };
}

export type OfferView = { applied: boolean; label: string | null; reason: string | null; discountMinor: number; kind: 'voucher' | 'offer' };

export function offerView(held: Held): OfferView {
  const label = held.outcome.applies ? held.outcome.label : null;
  return {
    applied: held.outcome.applies,
    label,
    reason: held.outcome.applies ? null : held.reason ?? null,
    discountMinor: held.outcome.applies ? held.outcome.discountMinor : 0,
    kind: held.applied?.kind ?? 'offer',
  };
}

/** The cart lines with each item's category, which the offer rules need. */
async function linesFacts(cart: CartLine[]): Promise<CartLineFacts[]> {
  const items = await data.getItems(cart.map((l) => l.itemId));
  return cart.map((l) => {
    const item = items.get(l.itemId)!;
    return { itemId: l.itemId, categoryId: item.categoryId, unitMinor: resolveLine(item, l).unitMinor, qty: l.qty };
  });
}

export function validateAddress(raw: unknown): data.AddressFields & { zoneId: string; forShipping: boolean; city: string; country: string } {
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
  // A courier (shipping) address names its city and country instead of a delivery area.
  const forShipping = body.forShipping === true;
  const city = text('city', 80);
  const country = text('country', 80);
  if (forShipping && city.length < 2) throw new RuleError('Enter the city.', 'bad_input', 400);
  if (forShipping && country.length < 2) throw new RuleError('Enter the country.', 'bad_input', 400);
  return {
    forShipping,
    city,
    country,
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
    // A shipping address goes by courier, so it needs no delivery area.
    const zone = f.forShipping ? null : await resolveZone(c, f);
    // The first address is the default. Making one the default moves the default away from the others.
    const isDefault = f.isDefault || count === 0;
    if (isDefault) await data.clearDefaultAddress(c, guestId);
    const id = await data.insertSavedAddress(c, guestId, { ...f, zoneId: zone?.id ?? '', isDefault });
    return (await data.findSavedAddress(c, guestId, id))!;
  });
}

export async function updateAddress(guestId: string, id: string, raw: unknown): Promise<data.SavedAddress> {
  if (!UUID.test(id)) throw new RuleError('Address not found.', 'not_found', 404);
  const f = validateAddress(raw);
  return withTx(async (c: PoolClient) => {
    const existing = await data.findSavedAddress(c, guestId, id);
    if (!existing) throw new RuleError('Address not found.', 'not_found', 404);
    const zone = f.forShipping ? null : await resolveZone(c, f);
    // The default stays the default until another address is made the default.
    const isDefault = existing.isDefault || f.isDefault;
    if (!existing.isDefault && f.isDefault) await data.clearDefaultAddress(c, guestId);
    await data.updateSavedAddress(c, guestId, id, { ...f, zoneId: zone?.id ?? '', isDefault });
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
      if (line.variantId !== undefined && line.variantId !== null && (typeof line.variantId !== 'string' || !UUID.test(line.variantId))) {
        throw new RuleError('That option is not valid.', 'bad_input', 400);
      }
      return line.variantId ? { itemId: line.itemId, variantId: line.variantId, qty, note } : { itemId: line.itemId, qty, note };
    })
    .filter((line) => line.qty > 0);
}

export async function placeOrder(input: {
  guestId: string;
  accountId?: string | null;
  idempotencyKey: string;
  channel: Channel;
  method: 'card' | 'cod' | 'pay_on_arrival';
  addressId: string | null;
  locale: 'en' | 'ar';
  /** Courier orders (channel 'shipping'): the chosen shipping option. */
  shippingRateId?: string | null;
}): Promise<OrderRow> {
  // A repeat with the same key returns the same order (idempotency from the architecture).
  const existing = await data.findOrderByKey(input.guestId, input.idempotencyKey);
  if (existing) return existing;
  await cancelStaleCardOrders();

  const orderId = await withTx(async (c: PoolClient) => {
    // Lock the cart's items for the length of the transaction, then re-check availability and price here.
    const cart = await c.query('select items from carts where guest_session_id = $1 for update', [input.guestId]);
    // A request with the same key may have placed the order (and emptied the cart) while this one waited for the
    // lock. That is the same order, not an empty cart.
    const placed = await data.findOrderByKey(input.guestId, input.idempotencyKey);
    if (placed) return placed.id;
    const lines = (cart.rows[0]?.items ?? []) as CartLine[];
    if (lines.length === 0) throw new RuleError('Your cart is empty.', 'empty_cart');
    const ids = lines.map((l) => l.itemId);
    // Lock the products and their variants, so two orders cannot both take the last one in stock.
    await c.query('select id from menu_items where id = any($1::uuid[]) order by id for update', [ids]);
    await c.query('select id from product_variants where item_id = any($1::uuid[]) order by id for update', [ids]);
    const current = await data.getItems(ids);
    const priced = lines.map((line) => {
      const r = resolveLine(current.get(line.itemId), line);
      return { itemId: line.itemId, variantId: r.variantId, name: r.name, unitMinor: r.unitMinor, qty: line.qty, note: line.note };
    });
    await takeStock(c, priced, current);

    const restaurant = await data.getRestaurant(c);
    const methodOk =
      (input.method === 'card' && restaurant.payments.card) ||
      (input.method === 'cod' && restaurant.payments.cod && (input.channel === 'delivery' || input.channel === 'shipping')) ||
      (input.method === 'pay_on_arrival' && restaurant.payments.payOnArrival && input.channel === 'pickup');
    if (!methodOk) throw new RuleError('That payment method is not available for this order.', 'method_unavailable');
    const zone = input.channel === 'delivery' ? await zoneForOrder(c, input.guestId, input.addressId) : null;
    // A courier order: a full address and a shipping option; the fee is the option's (free above its amount).
    let rate: ShippingRate | null = null;
    if (input.channel === 'shipping') {
      await shippingAddress(c, input.guestId, input.addressId);
      rate = await activeRate(c, input.shippingRateId);
    }
    const subtotalNow = priced.reduce((n, p) => n + p.unitMinor * p.qty, 0);

    const settings = {
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      deliveryFeeMinor: rate ? shippingFee(rate, subtotalNow) : zone?.feeMinor ?? 0,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      pricesIncludeTax: true as const,
    };
    const pricedPlain = priced.map((p) => ({ itemId: p.itemId, name: p.name.en, unitMinor: p.unitMinor, qty: p.qty }));
    const plain = computeQuote(pricedPlain, input.channel, settings);
    if (zone && plain.subtotalMinor < zone.minOrderMinor) {
      throw new RuleError('This area needs a larger order before delivery.', 'below_minimum');
    }
    // The cart's code is checked again here, under the cart lock, so the price is the one the customer was shown.
    const categories = await data.getItems(lines.map((l) => l.itemId));
    const facts: CartLineFacts[] = priced.map((p) => ({ itemId: p.itemId, categoryId: categories.get(p.itemId)!.categoryId, unitMinor: p.unitMinor, qty: p.qty }));
    const held = await cartOffer(c, input.guestId, input.accountId ?? null, facts, plain.subtotalMinor, plain.deliveryFeeMinor, offerChannel(input.channel));
    if (held && !held.outcome.applies) {
      throw new RuleError(`Your code no longer applies: ${held.reason ?? 'please remove it'}`, 'offer_not_applicable', 409);
    }
    const quote = held && held.outcome.applies ? computeQuote(pricedPlain, input.channel, settings, held.outcome.discountMinor) : plain;
    // Cash is collected by the driver or at the counter, so the restaurant caps how much one cash order may come to.
    if (input.method !== 'card' && restaurant.cashLimitMinor !== null && quote.totalMinor > restaurant.cashLimitMinor) {
      throw new RuleError(`Orders paid in cash can be up to ${restaurant.currency} ${(restaurant.cashLimitMinor / 100).toFixed(2)}. Remove something to continue.`, 'over_cash_limit');
    }
    const status: OrderStatus = input.method === 'card' ? 'awaiting_payment' : 'placed';
    const orderAddressId = zone || rate ? await data.copyAddressForOrder(c, input.guestId, input.addressId!) : null;
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
      shippingRate: rate ? { id: rate.id, name: rate.name.en } : null,
    });
    if (!id && orderAddressId) {
      // A concurrent request with the same key won. Drop the copy this attempt made, so nothing is left behind.
      await c.query('delete from addresses where id = $1', [orderAddressId]);
    }
    if (id) {
      if (held) await reserveForOrder(c, id, held, input.accountId ?? null, input.guestId);
      // Cash and pay-on-arrival orders are confirmed by being placed. Card orders wait for the payment.
      if (id && input.method !== 'card') await finalizeOrderOffer(c, id);
      await c.query('update carts set items = $2, applied_voucher_id = null, applied_offer_id = null, updated_at = now() where guest_session_id = $1', [input.guestId, '[]']);
    }
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
  const moved = await withTx(async (c) => {
    const done = await data.transitionOrder(c, id, from, to, actor, extra);
    // A cancelled or rejected order gives back what it held: the voucher is released or made usable again, and the
    // stock it took goes back on the shelf.
    if (done && (to === 'cancelled' || to === 'rejected')) {
      await releaseOrderOffer(c, id);
      await returnStock(c, id);
    }
    return done;
  });
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
    await finalizeOrderOffer(c, order.id);
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
    lines: order.lines.map((l) => ({ lineId: l.id, name: l.name, qty: l.qty, note: l.note, unitMinor: l.unitMinor })),
    quote: {
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      serviceFeeMinor: order.serviceFeeMinor,
      discountMinor: order.discountMinor,
      totalMinor: order.totalMinor,
      taxLabel: order.taxLabel,
      taxIncludedMinor: order.vatMinor,
    },
    address: order.address,
    shipping: order.shipping,
    history: order.history,
  };
}

/** Cancels card orders that were not paid in time, and gives back what they held. Run at the start of each checkout. */
export async function cancelStaleCardOrders(): Promise<number> {
  const { rows } = await pool.query(
    `select id from orders where status = 'awaiting_payment' and placed_at < now() - ($1 || ' minutes')::interval limit 50`,
    [String(CARD_PAYMENT_MINUTES)],
  );
  let cancelled = 0;
  for (const row of rows) {
    try {
      await moveOrder(row.id, 'cancelled', { kind: 'system' });
      cancelled++;
    } catch {
      // Another request moved it first, which is fine.
    }
  }
  return cancelled;
}

/** Puts a code on the cart. Refused with the reason when it cannot apply to the cart as it is now. */
/** The address a delivery cart is priced for: the one chosen, else the customer's default. The cart has not chosen yet. */
export async function cartAddressId(guestId: string, channel: Channel, addressId: string | null): Promise<string | null> {
  if (channel !== 'delivery' || addressId) return addressId;
  const saved = await data.listSavedAddresses(guestId);
  return saved.find((a) => a.isDefault)?.id ?? null;
}

export async function applyCartCode(guestId: string, accountId: string | null, raw: unknown, channel: Channel, addressId: string | null) {
  const cart = await data.getCart(guestId);
  if (cart.length === 0) throw new RuleError('Add something to your cart first.', 'empty_cart');
  await pricedLines(cart);
  const facts = await linesFacts(cart);
  const { quote } = await quoteFor(guestId, channel, await cartAddressId(guestId, channel, addressId), accountId);
  return withTx(async (c) => {
    await c.query('select 1 from carts where guest_session_id = $1 for update', [guestId]);
    return applyCode(c, guestId, accountId, raw, facts, quote.subtotalMinor, quote.deliveryFeeMinor, offerChannel(channel));
  });
}

/** Takes the code off the cart. */
export async function removeCartCode(guestId: string) {
  await withTx((c) => removeCode(c, guestId));
}

/**
 * Takes counted stock for an order, under the locks placeOrder holds. Products and variants whose stock is not counted
 * (null) are left alone. Refused with how many are left when there are not enough.
 */
async function takeStock(c: PoolClient, lines: { itemId: string; variantId: string | null; qty: number }[], items: Map<string, data.MenuItem>) {
  const want = new Map<string, { qty: number; variant: boolean; label: string; left: number | null }>();
  for (const l of lines) {
    const item = items.get(l.itemId)!;
    const variant = l.variantId ? item.variants.find((v) => v.id === l.variantId)! : null;
    const key = l.variantId ?? l.itemId;
    const entry = want.get(key) ?? { qty: 0, variant: Boolean(variant), label: variant ? `${item.name.en} (${variant.name.en})` : item.name.en, left: variant ? variant.stock : item.stock };
    entry.qty += l.qty;
    want.set(key, entry);
  }
  for (const [id, w] of want) {
    if (w.left === null) continue;
    if (w.left < w.qty) {
      throw new RuleError(w.left === 0 ? `${w.label} is sold out.` : `Only ${w.left} left of ${w.label}. Lower the quantity to continue.`, 'out_of_stock');
    }
    await c.query(w.variant ? 'update product_variants set stock = stock - $2 where id = $1' : 'update menu_items set stock = stock - $2 where id = $1', [id, w.qty]);
  }
}

/** Puts back the counted stock a cancelled or rejected order took. Runs once, with the order's move to that status. */
async function returnStock(c: PoolClient, orderId: string) {
  await c.query(
    `update product_variants v set stock = v.stock + l.qty from
       (select variant_id, sum(qty)::int as qty from order_lines where order_id = $1 and variant_id is not null group by variant_id) l
     where v.id = l.variant_id and v.stock is not null`,
    [orderId],
  );
  await c.query(
    `update menu_items i set stock = i.stock + l.qty from
       (select menu_item_id, sum(qty)::int as qty from order_lines where order_id = $1 and variant_id is null group by menu_item_id) l
     where i.id = l.menu_item_id and i.stock is not null`,
    [orderId],
  );
}
