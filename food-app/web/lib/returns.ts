// Returns (retail mode, phase 3). A customer asks to return items from a delivered order within the shop's window;
// staff approve or reject. Approving records the refund: back to the card through the payment provider when the
// order was paid by card, otherwise marked for staff to pay back (cash or transfer) and confirm. Staff choose whether
// the items go back into stock.
import type { PoolClient } from 'pg';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';
import { recordAudit } from './audit.ts';
import { refundPayment, stripeConfigured } from './payments/stripe.ts';

type Localised = { en: string; ar: string };
type ReturnLine = { lineId: string; qty: number; name: Localised; unitMinor: number };
export type ReturnView = {
  id: string;
  orderId: string;
  orderNumber?: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  reason: string;
  lines: ReturnLine[];
  itemsMinor: number;
  refundMinor: number | null;
  refundMethod: '' | 'card' | 'manual';
  restocked: boolean;
  staffNote: string;
  createdAt: string;
  decidedAt: string | null;
  currency?: string;
  address?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const itemsMinor = (lines: ReturnLine[]) => lines.reduce((n, l) => n + l.unitMinor * l.qty, 0);

function view(r: Record<string, any>): ReturnView {
  const lines = r.lines as ReturnLine[];
  return {
    id: r.id,
    orderId: r.order_id,
    orderNumber: r.number,
    status: r.status,
    reason: r.reason,
    lines,
    itemsMinor: itemsMinor(lines),
    refundMinor: r.refund_minor,
    refundMethod: r.refund_method,
    restocked: r.restocked,
    staffNote: r.staff_note,
    createdAt: new Date(r.created_at).toISOString(),
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    currency: r.currency,
  };
}

/** Whether an order can still be returned, and until when. Only shops take returns, within their window. */
export async function returnWindow(c: PoolClient | typeof pool, orderId: string) {
  const { rows } = await c.query(
    `select o.status, r.business_type, r.return_days,
            (select max(at) from order_status_events e where e.order_id = o.id and e.status in ('delivered', 'collected')) as done_at
     from orders o join restaurant r on r.id = o.restaurant_id where o.id = $1`,
    [orderId],
  );
  const o = rows[0];
  if (!o) return { open: false, until: null as string | null, reason: 'not_found' };
  if (o.business_type !== 'shop' || o.return_days === 0) return { open: false, until: null, reason: 'no_returns' };
  if (!['delivered', 'collected'].includes(o.status) || !o.done_at) return { open: false, until: null, reason: 'not_delivered' };
  const until = new Date(new Date(o.done_at).getTime() + o.return_days * 86_400_000);
  return { open: until.getTime() > Date.now(), until: until.toISOString(), reason: until.getTime() > Date.now() ? null : 'window_closed' };
}

/** How many of each line have already been asked back (open, approved or refunded returns). */
async function alreadyReturned(c: PoolClient | typeof pool, orderId: string): Promise<Map<string, number>> {
  const { rows } = await c.query(`select lines from order_returns where order_id = $1 and status <> 'rejected'`, [orderId]);
  const used = new Map<string, number>();
  for (const r of rows) for (const l of r.lines as ReturnLine[]) used.set(l.lineId, (used.get(l.lineId) ?? 0) + l.qty);
  return used;
}

/** A customer's return request for their own order: which lines, how many, and why. */
export async function requestReturn(guestId: string, orderId: string, body: Record<string, unknown>): Promise<ReturnView> {
  if (!UUID.test(orderId)) throw new RuleError('Order not found.', 'not_found', 404);
  const reason = typeof body.reason === 'string' ? body.reason.trim().replace(/\s+/g, ' ') : '';
  if (reason.length < 3 || reason.length > 300) throw new RuleError('Tell us briefly why you are returning it (3 to 300 characters).', 'bad_input', 400);
  const asked = Array.isArray(body.lines) ? body.lines : [];
  if (asked.length === 0 || asked.length > 50) throw new RuleError('Choose what you are returning.', 'bad_input', 400);
  return withTx(async (c) => {
    const order = await c.query('select id, guest_session_id from orders where id = $1 for update', [orderId]);
    if (!order.rows[0] || order.rows[0].guest_session_id !== guestId) throw new RuleError('Order not found.', 'not_found', 404);
    const window = await returnWindow(c, orderId);
    if (!window.open) {
      const message = {
        no_returns: 'This shop does not take returns online. Please contact them.',
        not_delivered: 'You can ask for a return once the order has been delivered.',
        window_closed: 'The time to return this order has passed.',
      }[window.reason as string] ?? 'This order cannot be returned.';
      throw new RuleError(message, window.reason ?? 'not_returnable', 409);
    }
    const open = await c.query(`select 1 from order_returns where order_id = $1 and status = 'requested'`, [orderId]);
    if (open.rows[0]) throw new RuleError('You already asked to return items from this order. The shop will reply soon.', 'return_open', 409);
    const lines = await c.query('select id, name_en, name_ar, unit_price_minor, qty from order_lines where order_id = $1', [orderId]);
    const used = await alreadyReturned(c, orderId);
    const chosen: ReturnLine[] = [];
    for (const raw of asked) {
      const r = (raw ?? {}) as { lineId?: unknown; qty?: unknown };
      const line = lines.rows.find((l) => l.id === r.lineId);
      const qty = Number(r.qty);
      if (!line) throw new RuleError('That item is not on this order.', 'bad_input', 400);
      if (chosen.some((x) => x.lineId === line.id)) throw new RuleError('Each item can be listed once.', 'bad_input', 400);
      const left = line.qty - (used.get(line.id) ?? 0);
      if (!Number.isInteger(qty) || qty < 1 || qty > left) {
        throw new RuleError(left > 0 ? `You can return up to ${left} of ${line.name_en}.` : `${line.name_en} has already been returned.`, 'bad_qty', 422);
      }
      chosen.push({ lineId: line.id, qty, name: { en: line.name_en, ar: line.name_ar }, unitMinor: line.unit_price_minor });
    }
    const { rows } = await c.query(
      'insert into order_returns (order_id, reason, lines) values ($1, $2, $3) returning *',
      [orderId, reason, JSON.stringify(chosen)],
    );
    return view(rows[0]);
  });
}

/** The returns of one order, newest first, for the customer's order page. */
export async function returnsForOrder(orderId: string): Promise<ReturnView[]> {
  const { rows } = await pool.query('select * from order_returns where order_id = $1 order by created_at desc', [orderId]);
  return rows.map(view);
}

/** All returns for staff: open requests first, then the rest by time. */
export async function adminReturns(): Promise<ReturnView[]> {
  const { rows } = await pool.query(
    `select rt.*, o.number, o.currency from order_returns rt join orders o on o.id = rt.order_id
     order by (rt.status = 'requested') desc, rt.created_at desc limit 200`,
  );
  return rows.map(view);
}

/**
 * Staff decide a requested return. Approve: the refund (default: the items' price; at most what the order has left to
 * refund), and whether the items go back into stock. A card order is refunded to the card at once; anything else is
 * marked for staff to pay back and confirm with markRefunded. Reject: with a note for the customer.
 */
export async function decideReturn(id: string, body: Record<string, unknown>, actor: string): Promise<ReturnView> {
  if (!UUID.test(id)) throw new RuleError('Return not found.', 'not_found', 404);
  const decision = body.decision;
  if (decision !== 'approve' && decision !== 'reject') throw new RuleError('Choose approve or reject.', 'bad_input', 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  return withTx(async (c) => {
    const found = await c.query(
      `select rt.*, o.total_minor, o.payment_method, o.currency, p.provider_ref as intent
       from order_returns rt join orders o on o.id = rt.order_id left join payments p on p.order_id = o.id and p.status = 'captured'
       where rt.id = $1 for update of rt`,
      [id],
    );
    const r = found.rows[0];
    if (!r) throw new RuleError('Return not found.', 'not_found', 404);
    if (r.status !== 'requested') throw new RuleError(`This return was already ${r.status}.`, 'already_decided', 409);
    if (decision === 'reject') {
      if (note.length < 3) throw new RuleError('Add a short note for the customer saying why.', 'bad_input', 400);
      const { rows } = await c.query(`update order_returns set status = 'rejected', staff_note = $2, decided_at = now() where id = $1 returning *`, [id, note]);
      await recordAudit(c, actor, 'return_rejected', 'restaurant', null, { returnId: id });
      return view(rows[0]);
    }
    const lines = r.lines as ReturnLine[];
    const refunded = await c.query(`select coalesce(sum(refund_minor), 0)::int as n from order_returns where order_id = $1 and status in ('approved', 'refunded')`, [r.order_id]);
    const maxRefund = r.total_minor - refunded.rows[0].n;
    const refund = body.refundMinor === undefined || body.refundMinor === null || body.refundMinor === '' ? Math.min(itemsMinor(lines), maxRefund) : Number(body.refundMinor);
    if (!Number.isInteger(refund) || refund < 0 || refund > maxRefund) {
      throw new RuleError(`The refund can be from 0 to ${(maxRefund / 100).toFixed(2)} ${r.currency}.`, 'bad_input', 400);
    }
    const restock = body.restock === true;
    if (restock) await putBack(c, r.order_id, lines);
    // Card orders go back to the card now; others are paid back by staff.
    let method: 'card' | 'manual' = 'manual';
    let ref = '';
    let status: 'approved' | 'refunded' = 'approved';
    if (refund > 0 && r.payment_method === 'card' && r.intent && stripeConfigured()) {
      const result = await refundPayment(r.intent, refund, `return-${id}`);
      method = 'card';
      ref = result.id;
      status = 'refunded';
      const payment = await c.query('select id from payments where order_id = $1 and provider_ref = $2', [r.order_id, r.intent]);
      await c.query(`insert into refunds (payment_id, order_id, amount_minor, reason, status, provider_ref) values ($1, $2, $3, $4, 'succeeded', $5)`, [payment.rows[0].id, r.order_id, refund, 'return', ref]);
      await c.query(`update orders set payment_status = case when $2 >= total_minor then 'refunded' else 'partly_refunded' end where id = $1`, [r.order_id, refund + refunded.rows[0].n]);
    } else if (refund === 0) {
      status = 'refunded';
    }
    const { rows } = await c.query(
      `update order_returns set status = $2, refund_minor = $3, refund_method = $4, refund_ref = $5, restocked = $6, staff_note = $7, decided_at = now()
       where id = $1 returning *`,
      [id, status, refund, refund === 0 ? '' : method, ref, restock, note],
    );
    await recordAudit(c, actor, 'return_approved', 'restaurant', null, { returnId: id, refundMinor: refund, method, restock });
    return view(rows[0]);
  });
}

/** Staff confirm they paid back an approved return by cash or transfer. */
export async function markRefunded(id: string, actor: string): Promise<ReturnView> {
  if (!UUID.test(id)) throw new RuleError('Return not found.', 'not_found', 404);
  const { rows } = await pool.query(`update order_returns set status = 'refunded' where id = $1 and status = 'approved' returning *`, [id]);
  if (!rows[0]) throw new RuleError('Only an approved return waiting to be paid back can be marked refunded.', 'bad_transition', 409);
  await recordAudit(pool, actor, 'return_refunded', 'restaurant', null, { returnId: id });
  return view(rows[0]);
}

/** Puts returned items back into counted stock (products and options that are not counted are left alone). */
async function putBack(c: PoolClient, orderId: string, lines: ReturnLine[]) {
  for (const l of lines) {
    const line = await c.query('select menu_item_id, variant_id from order_lines where id = $1 and order_id = $2', [l.lineId, orderId]);
    const row = line.rows[0];
    if (!row) continue;
    if (row.variant_id) await c.query('update product_variants set stock = stock + $2 where id = $1 and stock is not null', [row.variant_id, l.qty]);
    else if (row.menu_item_id) await c.query('update menu_items set stock = stock + $2 where id = $1 and stock is not null', [row.menu_item_id, l.qty]);
  }
}
