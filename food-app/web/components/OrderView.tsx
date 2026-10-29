'use client';

import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';
import { PaymentPanel } from '@/components/PaymentPanel';
import type { OrderStatus } from '@/lib/status.ts';

type Order = {
  id: string;
  number: number;
  channel: 'delivery' | 'pickup';
  method: 'card' | 'cod' | 'pay_on_arrival';
  status: OrderStatus;
  etaMinutes: number | null;
  lines: { name: { en: string; ar: string }; qty: number; note: string; unitMinor: number }[];
  quote: { totalMinor: number; currency: string; taxLabel: string; taxIncludedMinor: number; subtotalMinor: number };
};

const STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

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
  const steps = order.channel === 'pickup' ? STEPS.filter((x) => x !== 'out_for_delivery') : STEPS;
  const currentIndex = steps.indexOf(order.status);

  return (
    <div className="stack">
      <p className="muted">{s.orderNumber} #{order.number}</p>
      <p role="status" aria-live="polite" style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>{label}</p>
      {order.etaMinutes && order.status !== 'awaiting_payment' ? (
        <p className="muted">{locale === 'ar' ? `الوقت المتوقع حوالي ${order.etaMinutes} دقيقة` : `About ${order.etaMinutes} minutes`}</p>
      ) : null}

      {order.status === 'awaiting_payment' && order.method === 'card' ? <PaymentPanel orderId={order.id} locale={locale} /> : null}

      <ol className="timeline" aria-label={s.orderStatus}>
        {steps.map((step, index) => (
          <li key={step} aria-current={index === currentIndex ? 'step' : undefined}>{s.statusLabels[step]}</li>
        ))}
      </ol>

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
