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
  /** Average stars and how many orders were rated; null until the restaurant's minimum is reached. */
  rating?: { average: number; count: number } | null;
  /** Versions of the product (size, colour, shade...), each with its own price and stock. Empty for most dishes. */
  variants: Variant[];
  /** How many are left when the shop counts stock (products without variants); null when not counted. */
  stock: number | null;
};

export type Variant = { id: string; name: Localised; sku: string; priceMinor: number; stock: number | null; soldOut: boolean };

/** A cart line. variantId is set for products sold in versions. */
export type CartLine = { itemId: string; variantId?: string; qty: number; note: string };

/** The active variants of the given products, in their order, by product. */
export async function variantsFor(itemIds: string[], c: PoolClient | typeof pool = pool): Promise<Map<string, Variant[]>> {
  const map = new Map<string, Variant[]>();
  if (itemIds.length === 0) return map;
  const { rows } = await c.query(
    `select id, item_id, name_en, name_ar, sku, price_minor, stock from product_variants
     where item_id = any($1::uuid[]) and active order by position, created_at`,
    [itemIds],
  );
  for (const r of rows) {
    const list = map.get(r.item_id) ?? [];
    list.push({ id: r.id, name: { en: r.name_en, ar: r.name_ar }, sku: r.sku, priceMinor: r.price_minor, stock: r.stock, soldOut: r.stock !== null && r.stock <= 0 });
    map.set(r.item_id, list);
  }
  return map;
}

/**
 * A product as customers see it. With variants, its price is the lowest variant's ("from") and it is sold out when
 * every variant is; without, it is sold out when switched off or when its counted stock reaches zero.
 */
function shape(r: { available: boolean; base_price_minor: number; stock: number | null }, variants: Variant[]) {
  if (variants.length) {
    return { priceMinor: Math.min(...variants.map((v) => v.priceMinor)), soldOut: !r.available || variants.every((v) => v.soldOut) };
  }
  return { priceMinor: r.base_price_minor, soldOut: !r.available || (r.stock !== null && r.stock <= 0) };
}

export type OrderLineRow = {
  id: string;
  itemId: string | null;
  variantId: string | null;
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
  /** Courier shipping (retail mode): the rate chosen and, once shipped, the parcel's tracking. */
  shipping: { rate: string; carrier: string; trackingNumber: string; trackingUrl: string } | null;
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
  /** Shipping addresses (courier, retail mode) have a city and country instead of a delivery area. */
  city: string;
  country: string;
  forShipping: boolean;
};

const addressColumns = `a.id, a.label, a.line_1, a.line_2, a.notes, a.is_default, a.city, a.country, a.for_shipping,
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
    city: r.city,
    country: r.country,
    forShipping: r.for_shipping,
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
  city?: string;
  country?: string;
  forShipping?: boolean;
};

const locationSql = `case when $8::float8 is null then null
  else ST_SetSRID(ST_MakePoint($9::float8, $8::float8), 4326)::geography end`;

export async function insertSavedAddress(c: PoolClient, guestId: string, f: AddressFields): Promise<string> {
  const { rows } = await c.query(
    `insert into addresses (guest_session_id, label, line_1, line_2, notes, zone_id, is_default, saved, location, city, country, for_shipping)
     values ($1, $2, $3, $4, $5, $6, $7, true, ${locationSql}, $10, $11, $12) returning id`,
    [guestId, f.label, f.line1, f.line2, f.notes, f.zoneId || null, f.isDefault, f.lat, f.lng, f.city ?? '', f.country ?? '', f.forShipping ?? false],
  );
  return rows[0].id;
}

export async function updateSavedAddress(c: PoolClient, guestId: string, id: string, f: AddressFields): Promise<boolean> {
  const { rowCount } = await c.query(
    `update addresses set label = $3, line_1 = $4, line_2 = $5, notes = $6, zone_id = $7, is_default = $10,
       location = ${locationSql}, city = $11, country = $12, for_shipping = $13
     where id = $1 and guest_session_id = $2 and saved`,
    [id, guestId, f.label, f.line1, f.line2, f.notes, f.zoneId || null, f.lat, f.lng, f.isDefault, f.city ?? '', f.country ?? '', f.forShipping ?? false],
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
    `insert into addresses (guest_session_id, label, line_1, line_2, notes, zone_id, location, is_default, saved, city, country, for_shipping)
     select guest_session_id, label, line_1, line_2, notes, zone_id, location, false, false, city, country, for_shipping
     from addresses where id = $1 and guest_session_id = $2 and saved returning id`,
    [id, guestId],
  );
  return rows[0].id;
}

export async function getMenu() {
  const { rows } = await pool.query(
    `select c.id as category_id, c.name_en as cat_en, c.name_ar as cat_ar, c.illustration as cat_art,
            i.id, i.name_en, i.name_ar, i.description_en, i.description_ar, i.base_price_minor, i.available, i.stock,
            m.storage_key, rt.average, rt.count as rating_count, rest.rating_min_count
     from categories c
     join menu_items i on i.category_id = c.id
     join restaurant rest on rest.id = c.restaurant_id
     left join lateral (select m.storage_key from product_media pm join media m on m.id = pm.media_id
       where pm.menu_item_id = i.id and m.kind = 'image' order by pm.is_primary desc, pm.position limit 1) m on true
     -- A dish's rating: the average of the rated orders it was in (see lib/ratings.ts).
     left join lateral (select round(avg(r.stars)::numeric, 1)::float as average, count(distinct r.order_id)::int as count
       from order_ratings r join order_lines l on l.order_id = r.order_id where l.menu_item_id = i.id) rt on true
     where c.restaurant_id = $1 and c.active
     order by c.sort_order, i.sort_order`,
    [restaurantId],
  );
  const categories = new Map<string, { id: string; name: Localised; illustration: string; items: MenuItem[] }>();
  const variants = await variantsFor(rows.map((r) => r.id));
  for (const r of rows) {
    const vs = variants.get(r.id) ?? [];
    if (!categories.has(r.category_id)) {
      categories.set(r.category_id, { id: r.category_id, name: { en: r.cat_en, ar: r.cat_ar }, illustration: r.cat_art, items: [] });
    }
    categories.get(r.category_id)!.items.push({
      id: r.id,
      categoryId: r.category_id,
      name: { en: r.name_en, ar: r.name_ar },
      description: { en: r.description_en, ar: r.description_ar },
      ...shape(r, vs),
      imageUrl: r.storage_key ? `/media/${r.storage_key}` : null,
      rating: r.rating_count >= r.rating_min_count ? { average: Number(r.average), count: r.rating_count } : null,
      variants: vs,
      stock: vs.length ? null : r.stock,
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
    `select i.id, i.category_id, i.name_en, i.name_ar, i.description_en, i.description_ar, i.base_price_minor, i.available,
            i.stock, m.storage_key
     from menu_items i
     left join lateral (select m.storage_key from product_media pm join media m on m.id = pm.media_id
       where pm.menu_item_id = i.id and m.kind = 'image' order by pm.is_primary desc, pm.position limit 1) m on true
     where i.id = any($1::uuid[])`,
    [ids],
  );
  const variants = await variantsFor(rows.map((r) => r.id));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        categoryId: r.category_id,
        name: { en: r.name_en, ar: r.name_ar },
        description: { en: r.description_en, ar: r.description_ar },
        ...shape(r, variants.get(r.id) ?? []),
        variants: variants.get(r.id) ?? [],
        stock: (variants.get(r.id) ?? []).length ? null : r.stock,
        // The dish's cover picture, the same one the menu shows.
        imageUrl: r.storage_key ? `/media/${r.storage_key}` : null,
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
    `select o.*, p.provider_ref as payment_intent_id, r.tax_label,
       -- A shipping address is shown in full (street, city, country); a delivery address by its first line.
       case when a.for_shipping then concat_ws(', ', nullif(a.line_1, ''), nullif(a.line_2, ''), nullif(a.city, ''), nullif(a.country, ''))
            else a.line_1 end as address_text
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
    'select id, menu_item_id, variant_id, name_en, name_ar, unit_price_minor, qty, note from order_lines where order_id = $1 order by id',
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
    shipping: o.channel === 'shipping'
      ? { rate: o.shipping_rate_name, carrier: o.tracking_carrier, trackingNumber: o.tracking_number, trackingUrl: o.tracking_url }
      : null,
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
      id: l.id,
      itemId: l.menu_item_id,
      variantId: l.variant_id,
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
    lines: { itemId: string; variantId?: string | null; name: Localised; unitMinor: number; qty: number; note: string }[];
    shippingRate?: { id: string; name: string } | null;
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
  if (input.shippingRate) {
    await c.query('update orders set shipping_rate_id = $2, shipping_rate_name = $3 where id = $1', [id, input.shippingRate.id, input.shippingRate.name]);
  }
  for (const line of input.lines) {
    await c.query(
      `insert into order_lines (order_id, menu_item_id, name_en, name_ar, unit_price_minor, qty, line_total_minor, note, variant_id)
       values ($1, $2, $3, $4, $5::int, $6::int, $5::int * $6::int, $7, $8)`,
      [id, line.itemId, line.name.en, line.name.ar, line.unitMinor, line.qty, line.note, line.variantId ?? null],
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
