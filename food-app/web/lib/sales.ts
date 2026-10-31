// The sales dashboard. Read-only: every figure is counted from the orders themselves, by the day the order was placed
// in the restaurant's own time zone. An order still waiting for its card payment is not counted as received.
import { pool } from './db.ts';
import { RESTAURANT_ID } from './catalog.ts';
import { RuleError } from './orders.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

// Which statuses count as what. Completed and cancelled orders are final; everything else is still in progress.
const COMPLETED = `('delivered','collected')`;
const CANCELLED = `('cancelled','rejected')`;
const COUNTED = `status <> 'awaiting_payment'`;

export type Totals = {
  received: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  salesMinor: number;
  discountMinor: number;
  averageMinor: number;
};

function parseDay(value: unknown, name: string): string {
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new RuleError(`Choose a valid ${name} date.`, 'bad_date', 400);
  }
  return value;
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
function minusYear(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  // 29 February becomes 28 February.
  const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

async function totals(tz: string, from: string, to: string): Promise<Totals> {
  const { rows } = await pool.query(
    `select count(*)::int as received,
       count(*) filter (where status in ${COMPLETED})::int as completed,
       count(*) filter (where status in ${CANCELLED})::int as cancelled,
       coalesce(sum(total_minor) filter (where status not in ${CANCELLED}), 0)::bigint as sales,
       coalesce(sum(discount_minor) filter (where status not in ${CANCELLED}), 0)::bigint as discount
     from orders
     where restaurant_id = $1 and ${COUNTED} and (placed_at at time zone $2)::date between $3::date and $4::date`,
    [RESTAURANT_ID, tz, from, to],
  );
  const r = rows[0];
  const kept = r.received - r.cancelled;
  return {
    received: r.received,
    completed: r.completed,
    cancelled: r.cancelled,
    inProgress: kept - r.completed,
    salesMinor: Number(r.sales),
    discountMinor: Number(r.discount),
    averageMinor: kept > 0 ? Math.round(Number(r.sales) / kept) : 0,
  };
}

/** Sales for the chosen days (both included), compared with the period just before and the same days a year earlier. */
export async function salesReport(input: { from: unknown; to: unknown }) {
  const from = parseDay(input.from, 'start');
  const to = parseDay(input.to, 'end');
  const days = daysBetween(from, to);
  if (days < 1) throw new RuleError('The start date must be on or before the end date.', 'bad_range', 400);
  if (days > MAX_DAYS) throw new RuleError('Choose at most one year at a time.', 'bad_range', 400);

  const { rows: [shop] } = await pool.query('select timezone, currency_code from restaurant where id = $1', [RESTAURANT_ID]);
  const tz = shop.timezone as string;
  const params = [RESTAURANT_ID, tz, from, to];

  const [current, previous, lastYear, byDay, monthly, channels, payments, topItems, byHour, byWeekday, customers] = await Promise.all([
    totals(tz, from, to),
    totals(tz, addDays(from, -days), addDays(from, -1)),
    totals(tz, minusYear(from), minusYear(to)),
    pool.query(
      `select d::date::text as day,
         count(o.id)::int as orders,
         coalesce(sum(o.total_minor) filter (where o.status not in ${CANCELLED}), 0)::bigint as sales
       from generate_series($3::date, $4::date, interval '1 day') d
       left join orders o on o.restaurant_id = $1 and o.${COUNTED} and (o.placed_at at time zone $2)::date = d::date
       group by d order by d`,
      params,
    ),
    // Twenty-four months up to the end date, so each of the last twelve has its month before and its year before.
    pool.query(
      `select to_char(m, 'YYYY-MM') as month,
         count(o.id) filter (where o.status not in ${CANCELLED})::int as orders,
         coalesce(sum(o.total_minor) filter (where o.status not in ${CANCELLED}), 0)::bigint as sales
       from generate_series(date_trunc('month', $3::date) - interval '23 months', date_trunc('month', $3::date), interval '1 month') m
       left join orders o on o.restaurant_id = $1 and o.${COUNTED}
         and date_trunc('month', (o.placed_at at time zone $2)) = m
       group by m order by m`,
      [RESTAURANT_ID, tz, to],
    ),
    pool.query(
      `select channel as key, count(*)::int as orders, coalesce(sum(total_minor), 0)::bigint as sales
       from orders where restaurant_id = $1 and ${COUNTED} and status not in ${CANCELLED}
         and (placed_at at time zone $2)::date between $3::date and $4::date
       group by channel order by sales desc`,
      params,
    ),
    pool.query(
      `select payment_method as key, count(*)::int as orders, coalesce(sum(total_minor), 0)::bigint as sales
       from orders where restaurant_id = $1 and ${COUNTED} and status not in ${CANCELLED}
         and (placed_at at time zone $2)::date between $3::date and $4::date
       group by payment_method order by sales desc`,
      params,
    ),
    pool.query(
      `select l.name_en, l.name_ar, sum(l.qty)::int as qty, sum(l.line_total_minor)::bigint as sales
       from order_lines l join orders o on o.id = l.order_id
       where o.restaurant_id = $1 and o.${COUNTED} and o.status not in ${CANCELLED}
         and (o.placed_at at time zone $2)::date between $3::date and $4::date
       group by l.name_en, l.name_ar order by sales desc, qty desc limit 10`,
      params,
    ),
    // When orders come in: by hour of the restaurant's day, and by day of the week (0 = Sunday).
    pool.query(
      `select h as hour, count(o.id)::int as orders, coalesce(sum(o.total_minor), 0)::bigint as sales
       from generate_series(0, 23) h
       left join orders o on o.restaurant_id = $1 and o.${COUNTED} and o.status not in ${CANCELLED}
         and (o.placed_at at time zone $2)::date between $3::date and $4::date
         and extract(hour from o.placed_at at time zone $2) = h
       group by h order by h`,
      params,
    ),
    pool.query(
      `select d as weekday, count(o.id)::int as orders, coalesce(sum(o.total_minor), 0)::bigint as sales
       from generate_series(0, 6) d
       left join orders o on o.restaurant_id = $1 and o.${COUNTED} and o.status not in ${CANCELLED}
         and (o.placed_at at time zone $2)::date between $3::date and $4::date
         and extract(dow from o.placed_at at time zone $2) = d
       group by d order by d`,
      params,
    ),
    // Customers who ordered in these days. A customer is new when their first order ever falls in these days.
    // Guests are counted by their browser or app session, so one person on two devices counts twice.
    pool.query(
      `with buyers as (
         select coalesce(customer_id, guest_session_id) as who, count(*)::int as orders, sum(total_minor)::bigint as sales
         from orders where restaurant_id = $1 and ${COUNTED} and status not in ${CANCELLED}
           and (placed_at at time zone $2)::date between $3::date and $4::date
         group by 1
       ), firsts as (
         select coalesce(customer_id, guest_session_id) as who, min(placed_at) as first_at
         from orders where restaurant_id = $1 and ${COUNTED} and status not in ${CANCELLED} group by 1
       )
       select count(*)::int as customers,
         count(*) filter (where (f.first_at at time zone $2)::date >= $3::date)::int as new_customers,
         count(*) filter (where b.orders > 1)::int as ordered_again,
         coalesce(sum(b.sales) filter (where (f.first_at at time zone $2)::date < $3::date), 0)::bigint as returning_sales
       from buyers b join firsts f on f.who = b.who`,
      params,
    ),
  ]);

  const split = (rows: Record<string, unknown>[]) => rows.map((r) => ({ key: r.key as string, orders: r.orders as number, salesMinor: Number(r.sales) }));
  return {
    currency: shop.currency_code as string,
    timezone: tz,
    from,
    to,
    previousFrom: addDays(from, -days),
    previousTo: addDays(from, -1),
    lastYearFrom: minusYear(from),
    lastYearTo: minusYear(to),
    current,
    previous,
    lastYear,
    byDay: byDay.rows.map((r) => ({ day: r.day as string, orders: r.orders as number, salesMinor: Number(r.sales) })),
    monthly: monthly.rows.map((r) => ({ month: r.month as string, orders: r.orders as number, salesMinor: Number(r.sales) })),
    channels: split(channels.rows),
    payments: split(payments.rows),
    byHour: byHour.rows.map((r) => ({ hour: r.hour as number, orders: r.orders as number, salesMinor: Number(r.sales) })),
    byWeekday: byWeekday.rows.map((r) => ({ weekday: r.weekday as number, orders: r.orders as number, salesMinor: Number(r.sales) })),
    customers: {
      total: customers.rows[0].customers as number,
      new: customers.rows[0].new_customers as number,
      returning: (customers.rows[0].customers as number) - (customers.rows[0].new_customers as number),
      orderedMoreThanOnce: customers.rows[0].ordered_again as number,
      returningSalesMinor: Number(customers.rows[0].returning_sales),
    },
    topItems: topItems.rows.map((r) => ({ nameEn: r.name_en as string, nameAr: r.name_ar as string, qty: r.qty as number, salesMinor: Number(r.sales) })),
  };
}
