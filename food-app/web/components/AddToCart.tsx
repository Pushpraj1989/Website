'use client';

import { useRef, useState } from 'react';
import { formatMoney } from '@/lib/money.ts';
import { forPut, type CartLineIn } from '@/lib/cart-lines.ts';
import type { Locale } from '@/lib/i18n.ts';

/** Sent on window whenever the cart changes, with the cart as the server now has it. The cart bar listens for it. */
export const CART_CHANGED = 'cart:changed';

export type Option = { id: string; name: string; priceMinor: number; soldOut: boolean };

// Adds one of an item to the cart. The cart on the server is the source of truth; this sends the whole list back,
// then tells the rest of the page (the cart bar at the bottom) what the cart now holds.
// A product sold in options (sizes, colours...) first opens a small sheet to choose one; sold-out options stay
// visible but cannot be chosen.
export function AddToCart({ itemId, label, addLabel, options = [], chooseLabel = 'Choose', chooseTitle = '', soldOutLabel = 'Sold out', currency = '', locale = 'en' }: {
  itemId: string; label: string; addLabel: string;
  options?: Option[]; chooseLabel?: string; chooseTitle?: string; soldOutLabel?: string; currency?: string; locale?: Locale;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sheet = useRef<HTMLDialogElement>(null);

  async function add(variantId: string | null) {
    setBusy(true);
    setMessage('');
    try {
      const current = await fetch('/v1/cart', { cache: 'no-store' }).then((r) => r.json());
      const items: CartLineIn[] = (current.lines as CartLineIn[]).map((l) => ({ itemId: l.itemId, variantId: l.variantId ?? null, qty: l.qty, note: l.note }));
      const existing = items.find((l) => l.itemId === itemId && (l.variantId ?? null) === variantId);
      if (existing) existing.qty += 1;
      else items.push({ itemId, variantId, qty: 1, note: '' });
      const response = await fetch('/v1/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(forPut) }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error?.message ?? 'Something went wrong.');
      } else {
        setMessage('✓');
        sheet.current?.close();
        window.dispatchEvent(new CustomEvent(CART_CHANGED, { detail: body }));
        setTimeout(() => setMessage(''), 2500);
      }
    } catch {
      setMessage('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const hasOptions = options.length > 0;
  return (
    <div className="add-wrap">
      <button
        type="button" className={message === '✓' ? 'btn add done' : 'btn add'} disabled={busy} aria-busy={busy}
        aria-label={hasOptions ? chooseTitle || label : label} aria-haspopup={hasOptions ? 'dialog' : undefined}
        onClick={() => (hasOptions ? sheet.current?.showModal() : add(null))}
      >
        {message === '✓' ? <span aria-hidden="true">✓</span> : <>{(hasOptions ? chooseLabel : addLabel).toUpperCase()}<span aria-hidden="true" className="plus">+</span></>}
      </button>
      <span role="status" className={message && message !== '✓' ? 'add-error' : 'sr'} aria-live="polite">{message}</span>
      {hasOptions ? (
        <dialog ref={sheet} className="options-sheet" aria-label={chooseTitle} onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
          <div className="options-inner">
            <div className="sheet-grab" aria-hidden="true" />
            <h2>{chooseTitle}</h2>
            <ul className="options-list">
              {options.map((o) => (
                <li key={o.id}>
                  <button type="button" className="option" disabled={o.soldOut || busy} onClick={() => add(o.id)}>
                    <span className="option-name">{o.name}</span>
                    <span className="option-price">{o.soldOut ? soldOutLabel : formatMoney(o.priceMinor, currency, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {message && message !== '✓' ? <p role="alert" className="error">{message}</p> : null}
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
