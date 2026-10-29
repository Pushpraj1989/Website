import React, { useState } from 'react';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';

const DIGITS = 2;
const CODE = 'AED';
const TYPES = {
  percent: 'Percent off',
  fixed: 'Fixed amount off (AED)',
  free_delivery: 'Free delivery',
  item_free: 'Free item',
  bundle: 'Bundle',
};

// Offers are shown as Live, Scheduled, Ended or Stopped, from their dates and the on/off switch.
export function offerStatus(offer, now = Date.now()) {
  if (!offer.active) return 'Stopped';
  if (now < Date.parse(offer.startsAt)) return 'Scheduled';
  if (now > Date.parse(offer.endsAt)) return 'Ended';
  return 'Live';
}

const toLocalInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Offers({ catalog, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  return (
    <section className="stack">
      <div className="row between">
        <h1>Offers</h1>
        <button type="button" className="btn primary" onClick={() => { setEditing('new'); setMessage(''); setError(''); }}>Add offer</button>
      </div>
      <p className="muted">An offer shows in the app while it is live. Offers that customers have used are stopped, not deleted.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className={editing ? 'split' : undefined}>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Offer</th><th scope="col">Type</th><th scope="col">Value</th><th scope="col">Runs</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr>
          </thead>
          <tbody>
            {catalog.offers.length === 0 ? <tr><td colSpan={6} className="muted">No offers yet.</td></tr> : null}
            {catalog.offers.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.name.en}</strong><div dir="rtl" className="muted">{o.name.ar}</div>{o.code ? <code>{o.code}</code> : null}</td>
                <td>{TYPES[o.type]}</td>
                <td className="num">{o.type === 'percent' ? `${o.value / 100}%` : o.type === 'fixed' ? formatMoney(o.value, DIGITS, CODE) : '—'}</td>
                <td className="muted">{new Date(o.startsAt).toLocaleDateString()} – {new Date(o.endsAt).toLocaleDateString()}</td>
                <td><span className={`status ${offerStatus(o).toLowerCase()}`}>{offerStatus(o)}</span></td>
                <td><button type="button" className="btn secondary sm" onClick={() => setEditing(o)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <OfferEditor
          key={editing === 'new' ? 'new' : editing.id}
          offer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (text) => { setMessage(text); await onChanged(); }}
          onError={setError}
        />
      ) : null}
      </div>
    </section>
  );
}

function OfferEditor({ offer, onClose, onSaved, onError }) {
  const [type, setType] = useState(offer?.type ?? 'percent');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setError('');
    const f = new FormData(event.currentTarget);
    let value = 0;
    if (type === 'percent') {
      const pct = Number(f.get('percent'));
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return setError('Enter a percentage from 1 to 100.');
      value = Math.round(pct * 100); // basis points: 10% = 1000
    } else if (type === 'fixed') {
      value = parseMoney(f.get('amount'), DIGITS);
      if (value === null || value <= 0) return setError('Enter the amount in AED, like 5.00.');
    }
    const minSubtotal = parseMoney(f.get('minSubtotal') || '0', DIGITS);
    if (minSubtotal === null) return setError('Enter the minimum order in AED, like 30.00.');
    const maxDiscount = f.get('maxDiscount') ? parseMoney(f.get('maxDiscount'), DIGITS) : null;
    const body = {
      nameEn: f.get('nameEn'),
      nameAr: f.get('nameAr'),
      type,
      value,
      appliesTo: 'order',
      audience: f.get('audience'),
      minSubtotalMinor: minSubtotal,
      code: f.get('code') || null,
      startsAt: new Date(f.get('startsAt')).toISOString(),
      endsAt: new Date(f.get('endsAt')).toISOString(),
      usageLimit: f.get('usageLimit') ? Number(f.get('usageLimit')) : null,
      maxDiscountMinor: maxDiscount,
      active: f.get('active') === 'on',
    };
    setBusy(true);
    try {
      if (offer) await api.updateOffer(offer.id, body);
      else await api.createOffer(body);
      await onSaved(offer ? 'Offer saved.' : 'Offer added.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function stopOrDelete() {
    try {
      const result = await api.deleteOffer(offer.id);
      await onSaved(result.result === 'stopped' ? 'Offer stopped. It was used, so it is kept for the records.' : 'Offer deleted.');
      onClose();
    } catch (err) {
      onError(err.message);
    }
  }

  const now = new Date();
  const defaultStart = offer ? toLocalInput(offer.startsAt) : toLocalInput(now.toISOString());
  const defaultEnd = offer ? toLocalInput(offer.endsAt) : toLocalInput(new Date(now.getTime() + 7 * 864e5).toISOString());

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="offer-title">
      <form className="card stack" onSubmit={save}>
        <div className="row between">
          <h2 id="offer-title">{offer ? 'Edit offer' : 'New offer'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        <div className="grid-form">
          <label>Name (English)<input name="nameEn" required maxLength={80} defaultValue={offer?.name.en ?? ''} /></label>
          <label>Name (Arabic)<input name="nameAr" required maxLength={80} dir="rtl" defaultValue={offer?.name.ar ?? ''} /></label>
        </div>
        <label>Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {type === 'percent' ? (
          <label>Percent off<input name="percent" inputMode="decimal" required defaultValue={offer ? offer.value / 100 : 10} /></label>
        ) : null}
        {type === 'fixed' ? (
          <label>Amount off (AED)<input name="amount" inputMode="decimal" required defaultValue={offer ? (offer.value / 100).toFixed(2) : '5.00'} /></label>
        ) : null}
        <div className="grid-form">
          <label>Minimum order (AED)<input name="minSubtotal" inputMode="decimal" defaultValue={offer ? (offer.minSubtotalMinor / 100).toFixed(2) : '0.00'} /></label>
          <label>Largest discount (AED, optional)<input name="maxDiscount" inputMode="decimal" defaultValue={offer?.maxDiscountMinor != null ? (offer.maxDiscountMinor / 100).toFixed(2) : ''} /></label>
        </div>
        <div className="grid-form">
          <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={defaultStart} /></label>
          <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={defaultEnd} /></label>
        </div>
        <div className="grid-form">
          <label>Code (optional)<input name="code" maxLength={30} defaultValue={offer?.code ?? ''} placeholder="WEEKEND10" /></label>
          <label>Usage limit (optional)<input name="usageLimit" type="number" min="0" defaultValue={offer?.usageLimit ?? ''} /></label>
        </div>
        <label>Who can use it
          <select name="audience" defaultValue={offer?.audience ?? 'any'}>
            <option value="any">Everyone</option>
            <option value="member">Signed-in customers</option>
            <option value="guest">Guests</option>
          </select>
        </label>
        <label className="choice"><input name="active" type="checkbox" defaultChecked={offer ? offer.active : true} /> Switched on</label>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {offer ? <button type="button" className="btn danger" onClick={stopOrDelete}>{offer.usedCount > 0 ? 'Stop offer' : 'Delete'}</button> : null}
        </div>
      </form>
    </div>
  );
}
