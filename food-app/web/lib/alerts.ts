// New-order alerts for the kitchen. The stream starts from the moment staff connect, so an old order never sounds an
// alert. Polling the database every few seconds is simple and works across servers without a message broker.
import { pool } from './db.ts';
import { restaurantId } from './data.ts';

export type NewOrder = { id: string; number: string; channel: string; totalMinor: number; currency: string; placedAt: string };

export async function ordersPlacedAfter(since: Date, limit = 50): Promise<{ orders: NewOrder[]; latest: Date }> {
  const { rows } = await pool.query(
    `select id, number, channel, total_minor, currency, placed_at from orders
     where restaurant_id = $1 and placed_at > $2 and status <> 'awaiting_payment'
     order by placed_at asc limit $3`,
    [restaurantId, since, limit],
  );
  const orders = rows.map((r) => ({
    id: r.id,
    number: r.number,
    channel: r.channel,
    totalMinor: r.total_minor,
    currency: r.currency,
    placedAt: r.placed_at.toISOString(),
  }));
  const latest = rows.length ? rows[rows.length - 1].placed_at : since;
  return { orders, latest };
}
