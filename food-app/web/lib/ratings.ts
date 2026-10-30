// Order ratings. A customer rates their own order once it has been delivered or collected (and may change the
// rating). A dish's score is the average of the ratings of the orders it was in; it is shown only once it has as
// many ratings as the restaurant set in its settings, so one early rating does not stand for a dish.
import { pool } from './db.ts';
import { RuleError, ownedOrder } from './orders.ts';

const FINISHED = new Set(['delivered', 'collected']);

export async function rateOrder(orderId: string, guestId: string, body: Record<string, unknown>) {
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new RuleError('Choose from 1 to 5 stars.', 'bad_input', 400);
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 300) : '';
  const order = await ownedOrder(orderId, guestId);
  if (!order) throw new RuleError('Order not found.', 'not_found', 404);
  if (!FINISHED.has(order.status)) throw new RuleError('You can rate an order once it has reached you.', 'not_finished', 409);
  await pool.query(
    `insert into order_ratings (order_id, stars, comment) values ($1,$2,$3)
     on conflict (order_id) do update set stars = excluded.stars, comment = excluded.comment, rated_at = now()`,
    [orderId, stars, comment],
  );
  return { stars, comment };
}

export async function ratingOf(orderId: string): Promise<{ stars: number; comment: string } | null> {
  const { rows } = await pool.query('select stars, comment from order_ratings where order_id = $1', [orderId]);
  return rows[0] ? { stars: rows[0].stars, comment: rows[0].comment } : null;
}

/** Each dish's average and count, only for dishes with at least the restaurant's minimum number of ratings. */
export async function dishRatings(): Promise<Map<string, { average: number; count: number }>> {
  const { rows } = await pool.query(
    `select l.menu_item_id as id, round(avg(r.stars)::numeric, 1)::float as average, count(distinct r.order_id)::int as count
     from order_ratings r join order_lines l on l.order_id = r.order_id
     where l.menu_item_id is not null
     group by l.menu_item_id
     having count(distinct r.order_id) >= (select rating_min_count from restaurant limit 1)`,
  );
  return new Map(rows.map((r) => [r.id as string, { average: Number(r.average), count: r.count as number }]));
}
