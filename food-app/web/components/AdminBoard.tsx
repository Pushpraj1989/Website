'use client';

import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import type { OrderStatus } from '@/lib/status.ts';

type Board = {
  id: string;
  number: number;
  channel: 'delivery' | 'pickup';
  method: string;
  status: OrderStatus;
  etaMinutes: number | null;
  address: string | null;
  lines: { name: { en: string; ar: string }; qty: number; note: string }[];
  total: number;
  currency: string;
};

// The next step a kitchen or cashier moves an order to, after acceptance.
function nextStep(order: Board): OrderStatus | null {
  switch (order.status) {
    case 'accepted': return 'preparing';
    case 'preparing': return 'ready';
    case 'ready': return order.channel === 'delivery' ? 'out_for_delivery' : 'collected';
    case 'out_for_delivery': return 'delivered';
    default: return null;
  }
}

export function AdminBoard({ locale }: { locale: Locale }) {
  const s = t(locale);
  const [orders, setOrders] = useState<Board[] | null>(null);
  const [error, setError] = useState('');
  const [eta, setEta] = useState<Record<string, number>>({});

  async function load() {
    const response = await fetch('/v1/admin/orders', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) setError(body.error?.message ?? s.errorGeneric);
    else setOrders(body.orders);
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // load is recreated each render; the timer only needs to start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(url: string, body: object) {
    setError('');
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) setError(result.error?.message ?? s.errorGeneric);
    await load();
  }

  if (error && !orders) return <p role="alert" className="error">{error}</p>;
  if (!orders) return <p className="skeleton" aria-busy="true" style={{ height: 160 }} />;
  if (orders.length === 0) return <p className="muted">{s.noOrders}</p>;

  return (
    <div className="stack">
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className="board">
        {orders.map((order) => {
          const step = nextStep(order);
          return (
            <article key={order.id} className="card stack">
              <div className="row">
                <strong>#{order.number}</strong>
                <span className="badge">{s.statusLabels[order.status]}</span>
                <span className="spacer" />
                <span className="muted">{order.channel === 'delivery' ? s.delivery : s.pickup}</span>
              </div>
              <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
                {order.lines.map((line, i) => (
                  <li key={i}>{line.qty} × {line.name[locale]}{line.note ? ` (${line.note})` : ''}</li>
                ))}
              </ul>
              {order.address ? <p className="muted" style={{ margin: 0 }}>{order.address}</p> : null}
              {order.status === 'placed' ? (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(`/v1/admin/orders/${order.id}/accept`, { etaMinutes: eta[order.id] ?? 20 });
                  }}
                >
                  <label style={{ width: 'auto' }}>
                    {locale === 'ar' ? 'دقائق' : 'Minutes'}
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={eta[order.id] ?? 20}
                      onChange={(e) => setEta({ ...eta, [order.id]: Number(e.target.value) })}
                      style={{ width: 96 }}
                    />
                  </label>
                  <button type="submit" className="btn primary">{s.accept}</button>
                  <button type="button" className="btn" onClick={() => act(`/v1/admin/orders/${order.id}/status`, { to: 'rejected' })}>
                    {locale === 'ar' ? 'رفض' : 'Reject'}
                  </button>
                </form>
              ) : null}
              {step ? (
                <button type="button" className="btn" onClick={() => act(`/v1/admin/orders/${order.id}/status`, { to: step })}>
                  {s.markNext}: {s.statusLabels[step]}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
