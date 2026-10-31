import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { parseMoney } from '../money.js';

const DIGITS = 2;
const CODE = 'AED';
const money = (minor) => (minor === null || minor === undefined ? '' : (minor / 100).toFixed(DIGITS));
const blank = () => ({ key: Math.random().toString(36).slice(2), id: null, nameEn: '', nameAr: '', etaEn: '', etaAr: '', price: '', freeOver: '', active: true });

/**
 * Courier shipping (retail mode): the options customers choose from at checkout to have an order sent anywhere,
 * beyond the delivery areas on the map. Each has a price and can be free above an amount. With none on sale,
 * customers do not see shipping at all.
 */
export default function Shipping() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fromServer = (rates) => rates.map((r) => ({
    key: r.id, id: r.id, nameEn: r.name.en, nameAr: r.name.ar, etaEn: r.eta.en, etaAr: r.eta.ar,
    price: money(r.priceMinor), freeOver: money(r.freeOverMinor), active: r.active,
  }));
  useEffect(() => { api.shippingRates().then(({ rates }) => setRows(fromServer(rates))).catch((err) => setError(err.message)); }, []);

  const change = (key, field, value) => setRows((list) => list.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const move = (index, by) => setRows((list) => {
    const next = [...list];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    return next;
  });

  async function save() {
    setError('');
    setMessage('');
    const rates = [];
    for (const [i, r] of rows.entries()) {
      const price = parseMoney(r.price, DIGITS);
      const freeOver = r.freeOver.trim() === '' ? null : parseMoney(r.freeOver, DIGITS);
      if (!r.nameEn.trim() || !r.nameAr.trim()) return setError(`Option ${i + 1}: give it a name in English and Arabic.`);
      if (price === null) return setError(`Option ${i + 1}: enter the price like 15.00 (0.00 for free).`);
      if (r.freeOver.trim() !== '' && (freeOver === null || freeOver <= 0)) return setError(`Option ${i + 1}: enter "free over" like 200.00, or leave it empty.`);
      rates.push({ id: r.id, name: { en: r.nameEn.trim(), ar: r.nameAr.trim() }, eta: { en: r.etaEn.trim(), ar: r.etaAr.trim() }, priceMinor: price, freeOverMinor: freeOver, active: r.active });
    }
    setBusy(true);
    try {
      const { rates: saved } = await api.saveShippingRates(rates);
      setRows(fromServer(saved));
      const live = saved.filter((r) => r.active).length;
      setMessage(live ? `Saved. Customers can choose from ${live} shipping option${live === 1 ? '' : 's'} at checkout.` : 'Saved. No shipping option is on, so customers do not see shipping.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h1>Shipping</h1>
          <p className="muted">Send orders anywhere by courier, beyond your delivery areas. Customers pick one of these at checkout; you add the courier and tracking number when you ship.</p>
        </div>
      </div>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      {!rows ? <p className="muted">Loading…</p> : (
        <div className="card stack">
          {rows.length === 0 ? <p className="muted">No shipping options yet. Add one, for example "Standard, 2–4 days".</p> : null}
          <ol className="variant-list">
            {rows.map((r, i) => (
              <li key={r.key} className="variant-card">
                <div className="variant-head">
                  <strong>Option {i + 1}</strong>
                  <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <button type="button" className="btn ghost sm" aria-label={`Move option ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="icon" aria-hidden="true" /></button>
                    <button type="button" className="btn ghost sm" aria-label={`Move option ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown className="icon" aria-hidden="true" /></button>
                    <button type="button" className="btn ghost sm" aria-label={`Remove option ${i + 1}`} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}><Trash2 className="icon" aria-hidden="true" /></button>
                  </span>
                </div>
                <div className="variant-grid">
                  <label>Name (English)<input value={r.nameEn} maxLength={60} placeholder="Standard" onChange={(e) => change(r.key, 'nameEn', e.target.value)} /></label>
                  <label>Name (Arabic)<input value={r.nameAr} maxLength={60} dir="rtl" onChange={(e) => change(r.key, 'nameAr', e.target.value)} /></label>
                  <label>Delivery time (English) <span className="hint">optional</span><input value={r.etaEn} maxLength={60} placeholder="2–4 days" onChange={(e) => change(r.key, 'etaEn', e.target.value)} /></label>
                  <label>Delivery time (Arabic) <span className="hint">optional</span><input value={r.etaAr} maxLength={60} dir="rtl" onChange={(e) => change(r.key, 'etaAr', e.target.value)} /></label>
                  <label>Price, {CODE}<input value={r.price} inputMode="decimal" placeholder="15.00" onChange={(e) => change(r.key, 'price', e.target.value)} /></label>
                  <label>Free over, {CODE} <span className="hint">optional</span><input value={r.freeOver} inputMode="decimal" placeholder="200.00" onChange={(e) => change(r.key, 'freeOver', e.target.value)} /></label>
                  <label className="choice"><input type="checkbox" checked={r.active} onChange={(e) => change(r.key, 'active', e.target.checked)} /> Offered</label>
                </div>
              </li>
            ))}
          </ol>
          <div className="actions">
            <button type="button" className="btn secondary" onClick={() => setRows((list) => [...list, blank()])}><Plus className="icon" aria-hidden="true" /> Add shipping option</button>
            <button type="button" className="btn primary" disabled={busy} aria-busy={busy} onClick={save}>{busy ? 'Saving…' : 'Save shipping'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
