// Data layer for the slice, on Postgres (replica/schema.sql). Screens and route handlers call these functions.
// Every write that must be all-or-nothing runs in withTx. State changes are conditional updates, so two requests
// cannot both move the same order.
import type { PoolClient } from 'pg';
import { pool, withTx } from './db.ts';
import type { OrderStatus } from './status.ts';
import type { Channel } from './pricing.ts';

export type Localised = { en: string; ar: string };

export type Restaurant = {
  id: string;
  name: Localised;
  currency: string;
  taxLabel: string;
  taxBasisPoints: number;
  serviceFeeMinor: number;
  payments: { card: boolean; cod: boolean; payOnArrival: boolean };
  /** The most a cash or pay-on-arrival order may come to, or null for no limit. */
  cashLimitMinor: number | null;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: Localised;
  description: Localised;
  priceMinor: number;
  soldOut: boolean;
  imageUrl: string | null;
};

export type CartLine = { itemId: string; qty: number; note: string };

export type OrderLineRow = {
  itemId: string | null;
  name: Localised;
  unitMinor: number;
  qty: number;
  note: string;
};

export type OrderRow = {
  id: string;
  number: string;
  guestSessionId: string | null;
  customerId: string | null;
  channel: Channel;
  method: 'card' | 'cod' | 'pay_on_arrival';
  status: OrderStatus;
  etaMinutes: number | null;
  address: string | null;
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  serviceFeeMinor: number;
  discountMinor: number;
  tipMinor: number;
  totalMinor: number;
  vatMinor: number;
  taxLabel: string;
  placedAt: string;
  lines: OrderLineRow[];
  history: { status: OrderStatus; at: string }[];
  paymentIntentId: string | null;
};

export const restaurantId = '00000000-0000-4000-8000-000000000001';

const restaurantSql = `
  select id, name_en, name_ar, currency_code, tax_label, tax_basis_points, service_fee_minor,
         accepts_card, accepts_cod, accepts_pay_on_arrival, cash_limit_minor
  from restaurant where id = $1`;

export async function getRestaurant(c: PoolClient | typeof pool = pool): Promise<Restaurant> {
  const { rows } = await c.query(restaurantSql, [restaurantId]);
  const r = rows[0];
  return {
    id: r.id,
    name: { en: r.name_en, ar: r.name_ar },
    currency: r.currency_code,
    taxLabel: r.tax_label,
    taxBasisPoints: r.tax_basis_points,
    serviceFeeMinor: r.service_fee_minor,
    payments: { card: r.accepts_card, cod: r.accepts_cod, payOnArrival: r.accepts_pay_on_arrival },
    // 0 means the restaurant has not set a limit.
    cashLimitMinor: Number(r.cash_limit_minor) > 0 ? Number(r.cash_limit_minor) : null,
  };
}

export type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string;
  notes: string;
  isDefault: boolean;
  lat: number | null;
  lng: number | null;
  zone: { id: string; name: Localised; feeMinor: number; minOrderMinor: number; active: boolean } | null;
};

const addressColumns = `a.id, a.label, a.line_1, a.line_2, a.notes, a.is_default,
  ST_Y(a.location::geometry) as lat, ST_X(a.location::geometry) as lng,
  z.id as zone_id, z.name_en as zone_en, z.name_ar as zone_ar, z.fee_minor, z.min_order_minor, z.active as zone_active`;

function toAddress(r: Record<string, any>): SavedAddress {
  return {
    id: r.id,
    label: r.label,
    line1: r.line_1,
    line2: r.line_2,
    notes: r.notes,
    isDefault: r.is_default,
    lat: r.lat,
    lng: r.lng,
    zone: r.zone_id
      ? { id: r.zone_id, name: { en: r.zone_en, ar: r.zone_ar }, feeMinor: r.fee_minor, minOrderMinor: r.min_order_minor, active: r.zone_active }
      : null,
  };
}

export type Zone = { id: string; name: Localised; feeMinor: number; minOrderMinor: number };

export async function listSavedAddresses(guestId: string): Promise<SavedAddress[]> {
  const { rows } = await pool.query(
    `select ${addressColumns} from addresses a left join delivery_zones z on z.id = a.zone_id
     where a.guest_session_id = $1 and a.saved order by a.is_default desc, a.created_at desc`,
    [guestId],
  );
  return rows.map(toAddress);
}

export async function findSavedAddress(c: PoolClient | typeof pool, guestId: string, id: string): Promise<SavedAddress | null> {
  const { rows } = await c.query(
    `select ${addressColumns} from addresses a left join delivery_zones z on z.id = a.zone_id
     where a.id = $1 and a.guest_session_id = $2 and a.saved`,
    [id, guestId],
  );
  return rows[0] ? toAddress(rows[0]) : null;
}

export async function countSavedAddresses(c: PoolClient | typeof pool, guestId: string): Promise<number> {
  const { rows } = await c.query('select count(*)::int as n from addresses where guest_session_id = $1 and saved', [guestId]);
  return rows[0].n;
}

export async function clearDefaultAddress(c: PoolClient, guestId: string): Promise<void> {
  await c.query('update addresses set is_default = false where guest_session_id = $1 and is_default', [guestId]);
}

export type AddressFields = {
  label: string;
  line1: string;
  line2: string;
  notes: string;
  zoneId: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
};

const locationSql = `case when $8::float8 is null then null
  else ST_SetSRID(ST_MakePoint($9::float8, $8::float8), 4326)::geography end`;

export async function insertSavedAddress(c: PoolClient, guestId: string, f: AddressFields): Promise<string> {
  const { rows } = await c.query(
    `insert into addresses (guest_session_id, label, line_1, line_2, notes, zone_id, is_default, saved, location)
     values ($1, $2, $3, $4, $5, $6, $7, true, ${locationSql}) returning id`,
    [guestId, f.label, f.line1, f.line2, f.notes, f.zoneId, f.isDefault, f.lat, f.lng],
  );
  return rows[0].id;
}

export async function updateSavedAddress(c: PoolClient, guestId: string, id: string, f: AddressFields): Promise<boolean> {
  const { rowCount } = await c.query(
    `update addresses set label = $3, line_1 = $4, line_2 = $5, notes = $6, zone_id = $7, is_default = $10,
       location = ${locationSql}
     where id = $1 and guest_session_id = $2 and saved`,
    [id, guestId, f.label, f.line1, f.line2, f.notes, f.zoneId, f.lat, f.lng, f.isDefault],
  );
  return (rowCount ?? 0) > 0;
}

/** Deletes a saved address and reports whether it was the default. Earlier orders keep their own copy. */
export async function deleteSavedAddress(c: PoolClient, guestId: string, id: string): Promise<{ removed: boolean; wasDefault: boolean }> {
  const { rows } = await c.query('delete from addresses where id = $1 and guest_session_id = $2 and saved returning is_default', [id, guestId]);
  return { removed: rows.length > 0, wasDefault: rows[0]?.is_default === true };
}

export async function promoteNewestAddress(c: PoolClient, guestId: string): Promise<void> {
  await c.query(
    `update addresses set is_default = true where id = (
       select id from addresses where guest_session_id = $1 and saved order by created_at desc limit 1)`,
    [guestId],
  );
}

function toZone(r: Record<string, any>): Zone {
  return { id: r.id, name: { en: r.name_en, ar: r.name_ar }, feeMinor: r.fee_minor, minOrderMinor: r.min_order_minor };
}

/** The active zone whose polygon contains the point, or null when the point is outside every zone. */
export async function zoneAt(c: PoolClient | typeof pool, lat: number, lng: number): Promise<Zone | null> {
  const { rows } = await c.query(
    `select id, name_en, name_ar, fee_minor, min_order_minor from delivery_zones
     where restaurant_id = $1 and active
       and ST_Covers(polygon, ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography)
     limit 1`,
    [restaurantId, lat, lng],
  );
  return rows[0] ? toZone(rows[0]) : null;
}

export async function activeZone(c: PoolClient | typeof pool, zoneId: string): Promise<Zone | null> {
  const { rows } = await c.query(
    'select id, name_en, name_ar, fee_minor, min_order_minor from delivery_zones where id = $1 and restaurant_id = $2 and active',
    [zoneId, restaurantId],
  );
  return rows[0] ? toZone(rows[0]) : null;
}

export async function listActiveZones(): Promise<(Zone & { centre: { lat: number; lng: number } })[]> {
  const { rows } = await pool.query(
    `select id, name_en, name_ar, fee_minor, min_order_minor,
       ST_Y(ST_Centroid(polygon::geometry)) as centre_lat, ST_X(ST_Centroid(polygon::geometry)) as centre_lng
     from delivery_zones where restaurant_id = $1 and active order by name_en`,
    [restaurantId],
  );
  return rows.map((r) => ({ ...toZone(r), centre: { lat: r.centre_lat, lng: r.centre_lng } }));
}

/** Copies a saved address for one order. The copy is not listed as a saved address. */
export async function copyAddressForOrder(c: PoolClient, guestId: string, id: string): Promise<string> {
  const { rows } = await c.query(
    `insert into addresses (guest_session_id, label, line_1, line_2, notes, zone_id, location, is_default, saved)
     select guest_session_id, label, line_1, line_2, notes, zone_id, location, false, false
     from addresses where id = $1 and guest_session_id = $2 and saved returning id`,
    [id, guestId],
  );
  return rows[0].id;
}

export async function getMenu() {
  const { rows } = await pool.query(
    `select c.id as category_id, c.name_en as cat_en, c.name_ar as cat_ar, c.illustration as cat_art,
            i.id, i.name_en, i.name_ar, i.description_en, i.description_ar, i.base_price_minor, i.available,
            m.storage_key
     from categories c
     join menu_items i on i.category_id = c.id
     left join lateral (select m.storage_key from product_media pm join media m on m.id = pm.media_id
       where pm.menu_item_id = i.id and pm.is_primary limit 1) m on true
     where c.restaurant_id = $1 and c.active
     order by c.sort_order, i.sort_order`,
    [restaurantId],
  );
  const categories = new Map<string, { id: string; name: Localised; illustration: string; items: MenuItem[] }>();
  for (const r of rows) {
    if (!categories.has(r.category_id)) {
      categories.set(r.category_id, { id: r.category_id, name: { en: r.cat_en, ar: r.cat_ar }, illustration: r.cat_art, items: [] });
    }
    categories.get(r.category_id)!.items.push({
      id: r.id,
      categoryId: r.category_id,
      name: { en: r.name_en, ar: r.name_ar },
      description: { en: r.description_en, ar: r.description_ar },
      priceMinor: r.base_price_minor,
      soldOut: !r.available,
      imageUrl: r.storage_key ? `/media/${r.storage_key}` : null,
    });
  }
  return [...categories.values()];
}

/** Offers that are switched on and inside their dates, for the customer's offers widget. */
export async function activeOffers() {
  const { rows } = await pool.query(
    `select id, name_en, name_ar, offer_type, value_int, code, ends_at from offers
     where restaurant_id = $1 and active and now() between starts_at and ends_at and audience in ('any','member','guest')
     order by priority, ends_at`,
    [restaurantId],
  );
  return rows.map((o) => ({
    id: o.id,
    name: { en: o.name_en, ar: o.name_ar },
    type: o.offer_type,
    value: o.value_int,
    code: o.code,
    endsAt: new Date(o.ends_at).toISOString(),
  }));
}

export async function getItems(ids: string[]): Promise<Map<string, MenuItem>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query(
    `select id, category_id, name_en, name_ar, description_en, description_ar, base_price_minor, available
     from menu_items where id = any($1::uuid[])`,
    [ids],
  );
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        categoryId: r.category_id,
        name: { en: r.name_en, ar: r.name_ar },
        description: { en: r.description_en, ar: r.description_ar },
        priceMinor: r.base_price_minor,
        soldOut: !r.available,
        imageUrl: null,
      } satisfies MenuItem,
    ]),
  );
}

export async function findGuestSession(tokenHash: string): Promise<string | null> {
  const { rows } = await pool.query('select id from guest_sessions where token_hash = $1', [tokenHash]);
  if (rows[0]) await pool.query('update guest_sessions set last_seen_at = now() where id = $1', [rows[0].id]);
  return rows[0]?.id ?? null;
}

export async function createGuestSession(tokenHash: string): Promise<string> {
  const { rows } = await pool.query('insert into guest_sessions (token_hash) values ($1) returning id', [tokenHash]);
  return rows[0].id;
}

export async function getCart(guestId: string): Promise<CartLine[]> {
  const { rows } = await pool.query('select items from carts where guest_session_id = $1', [guestId]);
  return rows[0]?.items ?? [];
}

export async function setCart(guestId: string, lines: CartLine[]) {
  await pool.query(
    `insert into carts (guest_session_id, items, updated_at) values ($1, $2, now())
     on conflict (guest_session_id) where guest_session_id is not null
     do update set items = excluded.items, updated_at = now()`,
    [guestId, JSON.stringify(lines)],
  );
}

async function loadOrder(c: PoolClient | typeof pool, where: string, value: string): Promise<OrderRow | null> {
  const { rows } = await c.query(
    `select o.*, p.provider_ref as payment_intent_id, a.line_1 as address_text, r.tax_label
     from orders o
     join restaurant r on r.id = o.restaurant_id
     left join payments p on p.order_id = o.id
     left join addresses a on a.id = o.address_id
     where ${where}`,
    [value],
  );
  const o = rows[0];
  if (!o) return null;
  const lines = await c.query(
    'select menu_item_id, name_en, name_ar, unit_price_minor, qty, note from order_lines where order_id = $1 order by id',
    [o.id],
  );
  const events = await c.query(
    'select status, at from order_status_events where order_id = $1 order by at, id',
    [o.id],
  );
  return {
    id: o.id,
    number: o.number,
    guestSessionId: o.guest_session_id,
    customerId: o.customer_id,
    channel: o.channel,
    method: o.payment_method,
    status: o.status,
    etaMinutes: o.eta_minutes,
    address: o.address_text,
    currency: o.currency,
    subtotalMinor: o.subtotal_minor,
    deliveryFeeMinor: o.delivery_fee_minor,
    serviceFeeMinor: o.service_fee_minor,
    discountMinor: o.discount_minor,
    tipMinor: o.tip_minor,
    totalMinor: o.total_minor,
    vatMinor: o.vat_minor,
    taxLabel: o.tax_label,
    placedAt: new Date(o.placed_at).toISOString(),
    lines: lines.rows.map((l) => ({
      itemId: l.menu_item_id,
      name: { en: l.name_en, ar: l.name_ar },
      unitMinor: l.unit_price_minor,
      qty: l.qty,
      note: l.note,
    })),
    history: events.rows.map((e) => ({ status: e.status, at: new Date(e.at).toISOString() })),
    paymentIntentId: o.payment_intent_id,
  };
}

export async function getOrder(id: string, c: PoolClient | typeof pool = pool): Promise<OrderRow | null> {
  return loadOrder(c, 'o.id = $1', id);
}

export async function listOrders(): Promise<OrderRow[]> {
  const { rows } = await pool.query(
    'select id from orders where restaurant_id = $1 order by placed_at desc limit 200',
    [restaurantId],
  );
  const orders = [];
  for (const r of rows) orders.push((await getOrder(r.id))!);
  return orders;
}

/** The order placed with this idempotency key by this guest, if any. */
export async function findOrderByKey(guestId: string, key: string): Promise<OrderRow | null> {
  const { rows } = await pool.query(
    'select id from orders where guest_session_id = $1 and idempotency_key = $2',
    [guestId, key],
  );
  return rows[0] ? getOrder(rows[0].id) : null;
}

export async function findOrderByPaymentIntent(intentId: string): Promise<OrderRow | null> {
  const { rows } = await pool.query('select order_id from payments where provider = $1 and provider_ref = $2', ['stripe', intentId]);
  return rows[0] ? getOrder(rows[0].order_id) : null;
}

export async function insertOrder(
  c: PoolClient,
  input: {
    guestId: string;
    idempotencyKey: string;
    channel: Channel;
    method: 'card' | 'cod' | 'pay_on_arrival';
    status: OrderStatus;
    addressId: string | null;
    locale: 'en' | 'ar';
    quote: { currency: string; subtotalMinor: number; deliveryFeeMinor: number; serviceFeeMinor: number; discountMinor: number; tipMinor: number; totalMinor: number; taxIncludedMinor: number };
    lines: { itemId: string; name: Localised; unitMinor: number; qty: number; note: string }[];
  },
): Promise<string | null> {
  const { rows } = await c.query(
    `insert into orders (number, restaurant_id, guest_session_id, channel, status, locale, payment_method, payment_status,
       address_id, currency, subtotal_minor, delivery_fee_minor, service_fee_minor, discount_minor, tip_minor,
       total_minor, vat_minor, idempotency_key)
     values (nextval('order_number_seq')::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     on conflict (guest_session_id, idempotency_key) do nothing
     returning id`,
    [
      restaurantId,
      input.guestId,
      input.channel,
      input.status,
      input.locale,
      input.method,
      input.method === 'card' ? 'pending' : 'not_required',
      input.addressId,
      input.quote.currency,
      input.quote.subtotalMinor,
      input.quote.deliveryFeeMinor,
      input.quote.serviceFeeMinor,
      input.quote.discountMinor,
      input.quote.tipMinor,
      input.quote.totalMinor,
      input.quote.taxIncludedMinor,
      input.idempotencyKey,
    ],
  );
  const id: string | undefined = rows[0]?.id;
  if (!id) return null;
  for (const line of input.lines) {
    await c.query(
      `insert into order_lines (order_id, menu_item_id, name_en, name_ar, unit_price_minor, qty, line_total_minor, note)
       values ($1, $2, $3, $4, $5::int, $6::int, $5::int * $6::int, $7)`,
      [id, line.itemId, line.name.en, line.name.ar, line.unitMinor, line.qty, line.note],
    );
  }
  await c.query(
    `insert into order_status_events (order_id, status, actor_kind) values ($1, $2, 'customer')`,
    [id, input.status],
  );
  return id;
}

/**
 * Moves an order from one of `from` to `to`. A single conditional update: if the order is not in one of
 * `from`, nothing changes and null is returned.
 */
export async function transitionOrder(
  c: PoolClient,
  id: string,
  from: OrderStatus[],
  to: OrderStatus,
  actor: { kind: 'staff' | 'gateway' | 'system'; id?: string },
  extra: { etaMinutes?: number } = {},
): Promise<boolean> {
  const { rowCount } = await c.query(
    `update orders set status = $2,
       eta_minutes = coalesce($4, eta_minutes),
       accepted_at = case when $2 = 'accepted' then now() else accepted_at end,
       delivered_at = case when $2 in ('delivered','collected') then now() else delivered_at end
     where id = $1 and status = any($3::text[])`,
    [id, to, from, extra.etaMinutes ?? null],
  );
  if (!rowCount) return false;
  await c.query(
    'insert into order_status_events (order_id, status, actor_kind, actor_id) values ($1, $2, $3, $4)',
    [id, to, actor.kind, actor.id ?? null],
  );
  return true;
}

export async function attachPaymentIntent(c: PoolClient, orderId: string, intentId: string, amountMinor: number, currency: string) {
  await c.query(
    `insert into payments (order_id, provider, provider_ref, amount_minor, currency, status)
     values ($1, 'stripe', $2, $3, $4, 'pending') on conflict (provider, provider_ref) do nothing`,
    [orderId, intentId, amountMinor, currency],
  );
}

/** Stores a Stripe event once. Returns false when it was already stored (a retry). */
export async function recordPaymentEvent(eventId: string, type: string, payload: unknown): Promise<boolean> {
  const { rowCount } = await pool.query(
    `insert into payment_events (provider, event_id, payload) values ('stripe', $1, $2)
     on conflict (provider, event_id) do nothing`,
    [eventId, JSON.stringify({ type, ...(payload as object) })],
  );
  return rowCount === 1;
}

export async function markPaymentEventProcessed(eventId: string) {
  await pool.query("update payment_events set processed_at = now() where provider = 'stripe' and event_id = $1", [eventId]);
}

export async function markPaymentCaptured(c: PoolClient, intentId: string, orderId: string) {
  await c.query("update payments set status = 'captured' where provider = 'stripe' and provider_ref = $1", [intentId]);
  await c.query("update orders set payment_status = 'captured' where id = $1", [orderId]);
}
