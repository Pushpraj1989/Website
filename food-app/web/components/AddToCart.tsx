'use client';

import { useState } from 'react';

// Adds one of an item to the cart. The cart on the server is the source of truth; this sends the whole list back.
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
      if (!response.ok) {
        const body = await response.json();
        setMessage(body.error?.message ?? 'Something went wrong.');
      } else {
        setMessage('✓');
      }
    } catch {
      setMessage('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn add" onClick={add} disabled={busy} aria-label={label} aria-busy={busy}>
        {addLabel}
      </button>
      <span role="status" className="muted" aria-live="polite">{message}</span>
    </div>
  );
}
