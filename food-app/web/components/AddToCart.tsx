'use client';

import { useState } from 'react';

/** Sent on window whenever the cart changes, with the cart as the server now has it. The cart bar listens for it. */
export const CART_CHANGED = 'cart:changed';

// Adds one of an item to the cart. The cart on the server is the source of truth; this sends the whole list back,
// then tells the rest of the page (the cart bar at the bottom) what the cart now holds.
export function AddToCart({ itemId, label, addLabel }: { itemId: string; label: string; addLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function add() {
    setBusy(true);
    setMessage('');
    try {
      const current = await fetch('/v1/cart', { cache: 'no-store' }).then((r) => r.json());
      const items = (current.lines as { itemId: string; qty: number; note: string }[]).map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        note: l.note,
      }));
      const existing = items.find((l) => l.itemId === itemId);
      if (existing) existing.qty += 1;
      else items.push({ itemId, qty: 1, note: '' });
      const response = await fetch('/v1/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error?.message ?? 'Something went wrong.');
      } else {
        setMessage('✓');
        window.dispatchEvent(new CustomEvent(CART_CHANGED, { detail: body }));
        setTimeout(() => setMessage(''), 2500);
      }
    } catch {
      setMessage('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-wrap">
      <button type="button" className={message === '✓' ? 'btn add done' : 'btn add'} onClick={add} disabled={busy} aria-label={label} aria-busy={busy}>
        {message === '✓' ? <span aria-hidden="true">✓</span> : <>{addLabel.toUpperCase()}<span aria-hidden="true" className="plus">+</span></>}
      </button>
      <span role="status" className={message && message !== '✓' ? 'add-error' : 'sr'} aria-live="polite">{message}</span>
    </div>
  );
}
