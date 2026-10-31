'use client';

import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';
import { PaymentPanel } from '@/components/PaymentPanel';
import type { OrderStatus } from '@/lib/status.ts';

type Order = {
  id: string;
  number: number;
  channel: 'delivery' | 'pickup' | 'shipping';
  shipping?: { rate: string; carrier: string; trackingNumber: string; trackingUrl: string } | null;
  method: 'card' | 'cod' | 'pay_on_arrival';
  status: OrderStatus;
  etaMinutes: number | null;
  lines: { lineId: string; name: { en: string; ar: string }; qty: number; note: string; unitMinor: number }[];
  returns?: { id: string; status: string; reason: string; lines: { lineId: string; qty: number; name: { en: string; ar: string } }[]; refundMinor: number | null; staffNote: string }[];
  returnsOpenUntil?: string | null;
  quote: { totalMinor: number; currency: string; taxLabel: string; taxIncludedMinor: number; subtotalMinor: number };
};

const STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];
// A courier order: packed, then shipped with tracking, then delivered.
const SHIP_STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'shipped', 'delivered'];

// Polls the order every 5 seconds. A realtime channel replaces this with the Supabase layer.
export function OrderView({ id, locale }: { id: string; locale: Locale }) {
  const s = t(locale);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function load() {
      const response = await fetch(`/v1/orders/${id}`, { cache: 'no-store' });
      const body = await response.json();
      if (!alive) return;
      if (!response.ok) setError(body.error?.message ?? s.errorGeneric);
      else setOrder(body.order);
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, s.errorGeneric]);

  if (error) return <p role="alert" className="error">{error}</p>;
  if (!order) return <p className="skeleton" aria-busy="true" style={{ height: 120 }} />;

  const label = s.statusLabels[order.status];
  const steps = order.channel === 'shipping' ? SHIP_STEPS : order.channel === 'pickup' ? STEPS.filter((x) => x !== 'out_for_delivery') : STEPS;
  const currentIndex = steps.indexOf(order.status);

  return (
    <div className="stack">
      <p className="muted">{s.orderNumber} #{order.number}</p>
      <p role="status" aria-live="polite" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>{label}</p>
      {order.etaMinutes && order.status !== 'awaiting_payment' && order.channel !== 'shipping' ? (
        <p className="muted">{locale === 'ar' ? `الوقت المتوقع حوالي ${order.etaMinutes} دقيقة` : `About ${order.etaMinutes} minutes`}</p>
      ) : null}

      {order.shipping?.trackingNumber ? (
        <section className="card stack" aria-label={s.trackingTitle}>
          <strong>{s.trackingTitle}</strong>
          <span>{order.shipping.carrier} · <bdi>{order.shipping.trackingNumber}</bdi></span>
          {order.shipping.trackingUrl ? <a className="btn" href={order.shipping.trackingUrl} target="_blank" rel="noopener noreferrer">{s.trackParcel}</a> : null}
        </section>
      ) : null}

      {order.status === 'awaiting_payment' && order.method === 'card' ? <PaymentPanel orderId={order.id} locale={locale} /> : null}

      <ol className="timeline" aria-label={s.orderStatus}>
        {steps.map((step, index) => (
          <li key={step} aria-current={index === currentIndex ? 'step' : undefined}>{s.statusLabels[step]}</li>
        ))}
      </ol>

      {(order.returns ?? []).map((r) => (
        <section key={r.id} className="card stack" aria-label={s.returnStatus[r.status] ?? r.status}>
          <strong>{s.returnStatus[r.status] ?? r.status}</strong>
          <span>{r.lines.map((l) => `${l.qty} × ${l.name[locale]}`).join(', ')}</span>
          {r.refundMinor !== null && r.status !== 'rejected' ? <span><Money minor={r.refundMinor} currency={order.quote.currency} locale={locale} /></span> : null}
          {r.staffNote ? <span className="muted">{r.staffNote}</span> : null}
        </section>
      ))}
      {order.returnsOpenUntil && !(order.returns ?? []).some((r) => r.status === 'requested') ? (
        <ReturnForm order={order} locale={locale} onSent={() => undefined} />
      ) : null}

      <section className="card stack" aria-label={s.orderStatus}>
        {order.lines.map((line, index) => (
          <div key={index} className="row">
            <span>{line.qty} × {line.name[locale]}</span>
            <span className="spacer" />
            <Money minor={line.unitMinor * line.qty} currency={order.quote.currency} locale={locale} />
          </div>
        ))}
        <div className="row">
          <strong>{s.total}</strong>
          <span className="spacer" />
          <Money minor={order.quote.totalMinor} currency={order.quote.currency} locale={locale} />
        </div>
      </section>
    </div>
  );
}

/** Asks to return items from a delivered order: how many of each, and why. The shop decides in its console. */
function ReturnForm({ order, locale, onSent }: { order: Order; locale: Locale; onSent: () => void }) {
  const s = t(locale);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const until = order.returnsOpenUntil ? new Date(order.returnsOpenUntil).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'long' }) : '';
  const chosen = Object.entries(qty).filter(([, n]) => n > 0).map(([lineId, n]) => ({ lineId, qty: n }));

  async function send() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/v1/orders/${order.id}/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: chosen, reason }) });
      const body = await response.json();
      if (!response.ok) setMessage(body.error?.message ?? s.errorGeneric);
      else {
        setMessage(s.returnSent);
        setOpen(false);
        onSent();
      }
    } catch {
      setMessage(s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-label={s.returnItems}>
      <p className="muted" style={{ margin: 0 }}>{s.returnUntil(until)}</p>
      {!open ? <button type="button" className="btn" onClick={() => setOpen(true)}>{s.returnItems}</button> : (
        <>
          {order.lines.map((line) => (
            <label key={line.lineId} className="row">
              <span className="spacer">{line.name[locale]}</span>
              <select aria-label={s.returnQty(line.name[locale])} value={qty[line.lineId] ?? 0} onChange={(e) => setQty({ ...qty, [line.lineId]: Number(e.target.value) })} style={{ width: 90 }}>
                {Array.from({ length: line.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ))}
          <label>{s.returnWhy}<textarea value={reason} maxLength={300} rows={2} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" className="btn primary" disabled={busy || chosen.length === 0 || reason.trim().length < 3} aria-busy={busy} onClick={send}>{s.returnSend}</button>
        </>
      )}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
