'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';

type CartLine = { itemId: string; qty: number; note: string; name: { en: string; ar: string } | null; unitMinor: number | null; soldOut: boolean };
type Quote = { subtotalMinor: number; deliveryFeeMinor: number; serviceFeeMinor: number; totalMinor: number; taxIncludedMinor: number; taxLabel: string; currency: string };
type CartView = { lines: CartLine[]; quote: Quote | null; problem: string | null; currency?: string };

export function CartEditor({ locale }: { locale: Locale }) {
  const s = t(locale);
  const [cart, setCart] = useState<CartView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/v1/cart?channel=delivery', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setCart)
      .catch(() => setError(s.errorGeneric));
  }, [s.errorGeneric]);

  async function save(lines: CartLine[]) {
    setError('');
    const response = await fetch('/v1/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, note: l.note })), channel: 'delivery' }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error?.message ?? s.errorGeneric);
    else setCart(body);
  }

  if (!cart) return <p className="skeleton" aria-busy="true" aria-label={s.cart} style={{ height: 120 }} />;
  if (cart.lines.length === 0) {
    return (
      <div className="stack">
        <p>{s.emptyCart}</p>
        <Link href="/menu">{s.menu}</Link>
      </div>
    );
  }
  const currency = cart.currency ?? 'AED';

  return (
    <div className="stack">
      {error ? <p role="alert" className="error">{error}</p> : null}
      {cart.lines.map((line) => (
        <div key={line.itemId} className="card stack">
          <div className="row">
            <strong>{line.name?.[locale] ?? '—'}</strong>
            <span className="spacer" />
            {line.unitMinor !== null ? <Money minor={line.unitMinor * line.qty} currency={currency} locale={locale} /> : null}
          </div>
          {line.soldOut ? <span className="badge danger">{s.soldOut}</span> : null}
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label style={{ width: 'auto' }}>
              {s.quantity}
              <input
                aria-label={`${s.quantity}: ${line.name?.[locale] ?? ''}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={20}
                value={line.qty}
                style={{ width: 96 }}
                onChange={(e) => {
                  const qty = Math.min(20, Math.max(0, Number(e.target.value) || 0));
                  setCart({ ...cart, lines: cart.lines.map((l) => (l.itemId === line.itemId ? { ...l, qty } : l)) });
                }}
                onBlur={() => save(cart.lines.filter((l) => l.qty > 0))}
              />
            </label>
            <label style={{ flex: 1, minWidth: 180 }}>
              {s.note}
              <input
                type="text"
                maxLength={200}
                value={line.note}
                onChange={(e) => setCart({ ...cart, lines: cart.lines.map((l) => (l.itemId === line.itemId ? { ...l, note: e.target.value } : l)) })}
                onBlur={() => save(cart.lines.filter((l) => l.qty > 0))}
              />
            </label>
            <button type="button" className="btn" onClick={() => save(cart.lines.filter((l) => l.itemId !== line.itemId))}>
              {s.remove}
            </button>
          </div>
        </div>
      ))}
      {cart.problem ? <p role="alert" className="error">{cart.problem}</p> : null}
      {cart.quote ? (
        <dl className="totals card">
          <dt>{s.subtotal}</dt>
          <dd><Money minor={cart.quote.subtotalMinor} currency={currency} locale={locale} /></dd>
          <dt>{s.total}</dt>
          <dd className="grand"><Money minor={cart.quote.totalMinor} currency={currency} locale={locale} /></dd>
          <dt className="muted" style={{ gridColumn: '1 / -1' }}>{s.includesTax} {cart.quote.taxLabel} <Money minor={cart.quote.taxIncludedMinor} currency={currency} locale={locale} /></dt>
        </dl>
      ) : null}
      {cart.quote && !cart.problem ? (
        <Link className="btn primary lg" href="/checkout">{s.checkout}</Link>
      ) : null}
    </div>
  );
}
