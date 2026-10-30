// The customer's own history and shortcuts: past orders, the dishes they order most, their favourites and
// reordering. Every query is scoped to the guest session, so one customer never sees another's history.
import { pool } from './db.ts';
import { getCart, getItems, setCart, type CartLine, type MenuItem, type Localised } from './data.ts';
import { RuleError } from './orders.ts';

const MAX_CART_QTY = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderHistoryItem = {
  /** The stars the customer gave, or null when not rated. */
  ratingStars: number | null;
  id: string;
  number: string;
  status: string;
  channel: string;
  placedAt: string;
  totalMinor: number;
  currency: string;
  items: { name: Localised; qty: number }[];
};

export async function ordersFor(guestId: string, limit = 20): Promise<OrderHistoryItem[]> {
  const { rows } = await pool.query(
    `select o.id, o.number, o.status, o.channel, o.placed_at, o.total_minor, o.currency, r.stars as rating_stars
     from orders o left join order_ratings r on r.order_id = o.id
     where o.guest_session_id = $1 order by o.placed_at desc limit $2`,
    [guestId, Math.min(Math.max(limit, 1), 50)],
  );
  if (rows.length === 0) return [];
  const lines = await pool.query(
    'select order_id, name_en, name_ar, qty from order_lines where order_id = any($1::uuid[]) order by id',
    [rows.map((r) => r.id)],
  );
  const byOrder = new Map<string, OrderHistoryItem['items']>();
  for (const line of lines.rows) {
    const list = byOrder.get(line.order_id) ?? [];
    list.push({ name: { en: line.name_en, ar: line.name_ar }, qty: line.qty });
    byOrder.set(line.order_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    channel: r.channel,
    placedAt: r.placed_at.toISOString(),
    totalMinor: r.total_minor,
    currency: r.currency,
    items: byOrder.get(r.id) ?? [],
    ratingStars: r.rating_stars ?? null,
  }));
}

/** What the customer has saved: the discounts on their orders that went ahead (cancelled and rejected ones do not count). */
export async function savingsFor(guestId: string): Promise<{ savedMinor: number; currency: string | null }> {
  const { rows } = await pool.query(
    `select coalesce(sum(discount_minor), 0)::int as saved, max(currency) as currency
     from orders where guest_session_id = $1 and status not in ('cancelled','rejected','awaiting_payment')`,
    [guestId],
  );
  return { savedMinor: rows[0].saved, currency: rows[0].currency };
}

export type DishCard = { id: string; name: Localised; priceMinor: number; soldOut: boolean; imageUrl: string | null; timesOrdered: number };

function toCard(item: MenuItem, timesOrdered: number): DishCard {
  return { id: item.id, name: item.name, priceMinor: item.priceMinor, soldOut: item.soldOut, imageUrl: item.imageUrl, timesOrdered };
}

/** Dishes ordered most by this guest, counting quantities across orders that were not cancelled or rejected. */
export async function frequentFor(guestId: string, limit = 5): Promise<DishCard[]> {
  const { rows } = await pool.query(
    `select ol.menu_item_id, sum(ol.qty)::int as times
     from order_lines ol join orders o on o.id = ol.order_id
     where o.guest_session_id = $1 and ol.menu_item_id is not null and o.status not in ('cancelled', 'rejected')
     group by ol.menu_item_id
     order by sum(ol.qty) desc, max(o.placed_at) desc
     limit $2`,
    [guestId, limit],
  );
  const items = await getItems(rows.map((r) => r.menu_item_id));
  return rows.flatMap((r) => {
    const item = items.get(r.menu_item_id);
    return item ? [toCard(item, r.times)] : [];
  });
}

export async function favouritesFor(guestId: string): Promise<DishCard[]> {
  const { rows } = await pool.query(
    'select menu_item_id from favourites where guest_session_id = $1 order by created_at desc',
    [guestId],
  );
  const items = await getItems(rows.map((r) => r.menu_item_id));
  return rows.flatMap((r) => {
    const item = items.get(r.menu_item_id);
    return item ? [toCard(item, 0)] : [];
  });
}

export async function setFavourite(guestId: string, itemId: string, on: boolean): Promise<void> {
  if (!UUID.test(itemId)) throw new RuleError('That dish is not on the menu.', 'item_missing', 404);
  if (on) {
    const item = await getItems([itemId]);
    if (!item.has(itemId)) throw new RuleError('That dish is not on the menu.', 'item_missing', 404);
    await pool.query(
      `insert into favourites (guest_session_id, menu_item_id) values ($1, $2) on conflict do nothing`,
      [guestId, itemId],
    );
  } else {
    await pool.query('delete from favourites where guest_session_id = $1 and menu_item_id = $2', [guestId, itemId]);
  }
}

export async function homeFor(guestId: string) {
  const [recent, frequent, favourites] = await Promise.all([ordersFor(guestId, 1), frequentFor(guestId), favouritesFor(guestId)]);
  return { lastOrder: recent[0] ?? null, frequent, favourites };
}

/**
 * Puts a past order's dishes back in the cart. Dishes that are gone or sold out are not added; their names come
 * back so the customer can see what was left out. Quantities are capped the same way the cart caps them.
 */
export async function reorder(guestId: string, orderId: string): Promise<{ added: string[]; skipped: string[] }> {
  if (!UUID.test(orderId)) throw new RuleError('Order not found.', 'not_found', 404);
  const { rows } = await pool.query(
    `select ol.menu_item_id, ol.name_en, ol.qty from order_lines ol join orders o on o.id = ol.order_id
     where o.id = $1 and o.guest_session_id = $2`,
    [orderId, guestId],
  );
  if (rows.length === 0) throw new RuleError('Order not found.', 'not_found', 404);
  const items = await getItems(rows.filter((r) => r.menu_item_id).map((r) => r.menu_item_id));
  const cart: CartLine[] = await getCart(guestId);
  const added: string[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const item = row.menu_item_id ? items.get(row.menu_item_id) : undefined;
    if (!item || item.soldOut) {
      skipped.push(row.name_en);
      continue;
    }
    const existing = cart.find((l) => l.itemId === item.id);
    const qty = Math.min(MAX_CART_QTY, (existing?.qty ?? 0) + row.qty);
    if (existing) existing.qty = qty;
    else cart.push({ itemId: item.id, qty, note: '' });
    added.push(item.name.en);
  }
  if (added.length > 0) await setCart(guestId, cart);
  return { added, skipped };
}
