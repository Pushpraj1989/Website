'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialOf, t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';
import { Icon } from '@/components/Icon';
import { CART_CHANGED } from '@/components/AddToCart';

type Line = { itemId: string; qty: number; note: string; name: { en: string; ar: string } | null; unitMinor: number | null; soldOut: boolean; imageUrl?: string | null };
type Cart = { currency: string; lines: Line[]; quote: { subtotalMinor: number; totalMinor: number } | null; problem: string | null };

// As in the app: once something is in the cart, a bar at the foot of the page shows the dishes' photos, how many and
// the total. "View cart" slides the cart up from the bottom, where amounts change at once and Checkout is one tap
// away. The bar stays out of the way on the cart, checkout and order pages, which show the cart themselves.
export function CartBar({ locale }: { locale: Locale }) {
  const s = t(locale);
  const pathname = usePathname();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sheet = useRef<HTMLDialogElement>(null);

  const load = useCallback(() => {
    fetch('/v1/cart', { cache: 'no-store' }).then((r) => r.json()).then(setCart).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Cart>).detail;
      if (detail?.lines) setCart(detail);
      else load();
    };
    window.addEventListener(CART_CHANGED, onChange);
    return () => window.removeEventListener(CART_CHANGED, onChange);
  }, [load, pathname]);

  async function change(itemId: string, delta: number) {
    if (!cart) return;
    setBusy(true);
    setError('');
    const items = cart.lines
      .map((l) => ({ itemId: l.itemId, qty: l.itemId === itemId ? l.qty + delta : l.qty, note: l.note }))
      .filter((l) => l.qty > 0);
    try {
      const response = await fetch('/v1/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
      const body = await response.json();
      if (!response.ok) setError(body.error?.message ?? s.errorGeneric);
      else {
        setCart(body);
        if (body.lines.length === 0) sheet.current?.close();
      }
    } catch {
      setError(s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const hidden = !cart || cart.lines.length === 0 || /^\/(cart|checkout|orders|admin)/.test(pathname ?? '');
  if (hidden) return null;
  const count = cart.lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.quote?.subtotalMinor ?? cart.lines.reduce((n, l) => n + (l.unitMinor ?? 0) * l.qty, 0);

  return (
    <>
      <div className="cart-bar" role="region" aria-label={s.cart}>
        <div className="cart-thumbs" aria-hidden="true">
          {cart.lines.slice(0, 3).map((l) => (
            <span key={l.itemId} className="cart-thumb">{l.imageUrl ? <img src={l.imageUrl} alt="" /> : initialOf(l.name?.[locale] ?? '?')}</span>
          ))}
        </div>
        <div className="cart-sum">
          <strong>{s.itemsCount(count)}</strong>
          <Money minor={subtotal} currency={cart.currency} locale={locale} />
        </div>
        <button type="button" className="btn primary" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
          {s.viewCart}
        </button>
      </div>

      <dialog ref={sheet} className="cart-sheet" aria-label={s.cart} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{s.cart}</h2>
          <button type="button" className="icon-btn" aria-label={s.close} onClick={() => sheet.current?.close()}><Icon name="x" /></button>
        </div>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <ul className="sheet-lines">
          {cart.lines.map((l) => {
            const name = l.name?.[locale] ?? '';
            return (
              <li key={l.itemId}>
                <span className="cart-thumb lg">{l.imageUrl ? <img src={l.imageUrl} alt="" /> : initialOf(name)}</span>
                <div className="sheet-name">
                  <strong>{name}</strong>
                  {l.unitMinor !== null ? <Money minor={l.unitMinor * l.qty} currency={cart.currency} locale={locale} /> : null}
                  {l.soldOut ? <span className="badge danger">{s.soldOut}</span> : null}
                </div>
                <div className="stepper">
                  <button type="button" aria-label={s.oneLess(name)} disabled={busy} onClick={() => change(l.itemId, -1)}><Icon name="minus" size={18} /></button>
                  <span aria-live="polite" aria-label={`${s.quantity}: ${l.qty}`}>{l.qty}</span>
                  <button type="button" aria-label={s.oneMore(name)} disabled={busy || l.qty >= 20} onClick={() => change(l.itemId, 1)}><Icon name="plus" size={18} /></button>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="totals">
          <dt>{s.subtotal}</dt>
          <dd><Money minor={subtotal} currency={cart.currency} locale={locale} /></dd>
        </dl>
        {cart.problem ? <p className="error">{cart.problem}</p> : null}
        <div className="sheet-actions">
          <Link className="btn primary lg" href="/checkout">{s.checkout}</Link>
          <Link className="btn lg" href="/cart">{s.seeFullCart}</Link>
        </div>
      </dialog>
    </>
  );
}
