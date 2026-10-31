// Courier shipping (retail mode, phase 2): the rates a business offers, the fee for a cart, and handing an order to the
// courier with its tracking. Delivery by the business's own riders inside the map areas is unchanged (lib/zones.ts).
import type { PoolClient } from 'pg';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';
import { recordAudit } from './audit.ts';

export type Localised = { en: string; ar: string };
export type ShippingRate = { id: string; name: Localised; eta: Localised; priceMinor: number; freeOverMinor: number | null; active: boolean };

const view = (r: Record<string, any>): ShippingRate => ({
  id: r.id,
  name: { en: r.name_en, ar: r.name_ar },
  eta: { en: r.eta_en, ar: r.eta_ar },
  priceMinor: r.price_minor,
  freeOverMinor: r.free_over_minor,
  active: r.active,
});

/** The rates, in order. Customers see only the active ones. */
export async function listRates(all = false, c: PoolClient | typeof pool = pool): Promise<ShippingRate[]> {
  const { rows } = await c.query(`select * from shipping_rates ${all ? '' : 'where active'} order by position, created_at`);
  return rows.map(view);
}

export async function activeRate(c: PoolClient | typeof pool, id: unknown): Promise<ShippingRate> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new RuleError('Choose how to ship your order.', 'rate_required', 400);
  const { rows } = await c.query('select * from shipping_rates where id = $1 and active', [id]);
  if (!rows[0]) throw new RuleError('That shipping option is no longer offered. Choose another.', 'rate_missing', 422);
  return view(rows[0]);
}

/** The shipping fee for a cart: the rate's price, or nothing once the cart reaches its free-shipping amount. */
export const shippingFee = (rate: ShippingRate, subtotalMinor: number) =>
  rate.freeOverMinor !== null && subtotalMinor >= rate.freeOverMinor ? 0 : rate.priceMinor;

const text = (v: unknown, label: string, min: number, max: number) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) throw new RuleError(min ? `${label} must be ${min} to ${max} characters.` : `${label} can be up to ${max} characters.`, 'bad_input', 400);
  return s;
};
const minor = (v: unknown, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100_000_000) throw new RuleError(`${label} must be a whole amount of 0 or more.`, 'bad_input', 400);
  return n;
};

/** Replaces the rates with the list sent, in that order (as for product options). Removed rates are deleted. */
export async function saveRates(raw: unknown, actor: string): Promise<ShippingRate[]> {
  if (!Array.isArray(raw)) throw new RuleError('Send the shipping options as a list.', 'bad_input', 400);
  if (raw.length > 20) throw new RuleError('Offer up to 20 shipping options.', 'bad_input', 400);
  const list = raw.map((r, i) => {
    const v = (r ?? {}) as Record<string, any>;
    const n = `Shipping option ${i + 1}`;
    const free = v.freeOverMinor === null || v.freeOverMinor === undefined || v.freeOverMinor === '' ? null : minor(v.freeOverMinor, `${n}: free over`);
    if (free === 0) throw new RuleError(`${n}: free over must be more than 0, or empty.`, 'bad_input', 400);
    return {
      id: typeof v.id === 'string' && /^[0-9a-f-]{36}$/i.test(v.id) ? v.id : null,
      nameEn: text(v.name?.en, `${n}: English name`, 1, 60),
      nameAr: text(v.name?.ar, `${n}: Arabic name`, 1, 60),
      etaEn: text(v.eta?.en ?? '', `${n}: English delivery time`, 0, 60),
      etaAr: text(v.eta?.ar ?? '', `${n}: Arabic delivery time`, 0, 60),
      priceMinor: minor(v.priceMinor, `${n}: price`),
      freeOverMinor: free,
      active: v.active !== false,
    };
  });
  return withTx(async (c) => {
    const existing = await c.query('select id from shipping_rates');
    const keep = new Set(list.map((r) => r.id).filter(Boolean));
    for (const row of existing.rows) if (!keep.has(row.id)) await c.query('delete from shipping_rates where id = $1', [row.id]);
    for (const [position, r] of list.entries()) {
      if (r.id && existing.rows.some((e) => e.id === r.id)) {
        await c.query(
          'update shipping_rates set name_en=$2, name_ar=$3, eta_en=$4, eta_ar=$5, price_minor=$6, free_over_minor=$7, active=$8, position=$9 where id=$1',
          [r.id, r.nameEn, r.nameAr, r.etaEn, r.etaAr, r.priceMinor, r.freeOverMinor, r.active, position],
        );
      } else {
        await c.query(
          'insert into shipping_rates (name_en, name_ar, eta_en, eta_ar, price_minor, free_over_minor, active, position) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [r.nameEn, r.nameAr, r.etaEn, r.etaAr, r.priceMinor, r.freeOverMinor, r.active, position],
        );
      }
    }
    await recordAudit(c, actor, 'shipping_rates_changed', 'restaurant', null, { count: list.length });
    return listRates(true, c);
  });
}

/**
 * Hands a courier order over: records the carrier and tracking number (and an optional tracking link) and moves it to
 * 'shipped'. Only courier orders can be shipped, and only from accepted, preparing or ready.
 */
export async function markShipped(orderId: string, body: Record<string, unknown>, actor: string) {
  const carrier = text(body.carrier, 'The courier', 2, 60);
  const trackingNumber = text(body.trackingNumber, 'The tracking number', 3, 60);
  const url = typeof body.trackingUrl === 'string' ? body.trackingUrl.trim() : '';
  if (url && !/^https:\/\/[^\s]{4,300}$/.test(url)) throw new RuleError('The tracking link must start with https://', 'bad_input', 400);
  return withTx(async (c) => {
    const { rows } = await c.query('select channel, status from orders where id = $1 for update', [orderId]);
    if (!rows[0]) throw new RuleError('Order not found.', 'not_found', 404);
    if (rows[0].channel !== 'shipping') throw new RuleError('Only orders sent by courier can be marked shipped.', 'not_shipping', 409);
    if (!['accepted', 'preparing', 'ready'].includes(rows[0].status)) {
      throw new RuleError(`An order cannot be shipped while it is ${rows[0].status.replace(/_/g, ' ')}.`, 'bad_transition', 409);
    }
    await c.query(
      `update orders set status = 'shipped', tracking_carrier = $2, tracking_number = $3, tracking_url = $4 where id = $1`,
      [orderId, carrier, trackingNumber, url],
    );
    await c.query(`insert into order_status_events (order_id, status, actor_kind) values ($1, 'shipped', 'staff')`, [orderId]);
    await recordAudit(c, actor, 'order_shipped', 'restaurant', null, { orderId, carrier });
  });
}
