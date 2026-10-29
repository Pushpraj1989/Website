import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const PLACEMENTS = {
  hero: 'Top of the home screen',
  mid_feed: 'Between sections of the home screen',
  product_background: 'Plays behind a product when it is opened',
};

// A promotion puts one picture or video in one place, for a set time. Videos are chosen from product galleries.
export default function Promotions({ catalog }) {
  const [promos, setPromos] = useState(null);
  const [mediaByProduct, setMediaByProduct] = useState({});
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setPromos((await api.promotions()).promotions);
      const entries = await Promise.all(catalog.products.map(async (p) => [p.id, (await api.gallery(p.id)).media]));
      setMediaByProduct(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catalog]);

  const productName = (id) => catalog.products.find((p) => p.id === id)?.name.en ?? '—';

  async function remove(id) {
    if (!window.confirm('Remove this promotion?')) return;
    try {
      await api.deletePromotion(id);
      setMessage('Removed.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const now = Date.now();
  const status = (p) => (!p.active ? 'Stopped' : now < Date.parse(p.startsAt) ? 'Scheduled' : now > Date.parse(p.endsAt) ? 'Ended' : 'Live');

  return (
    <section className="stack">
      <div className="row between">
        <h1>Promotions</h1>
        <button type="button" className="btn primary" onClick={() => { setEditing('new'); setError(''); setMessage(''); }}>Add promotion</button>
      </div>
      <p className="muted">Pick a video or picture from a product and choose where it shows. A promotion runs only inside its dates.</p>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className={editing ? 'split' : undefined}>
        <div className="card table-wrap" tabIndex={0} role="region" aria-label="Promotions">
          <table>
            <thead><tr><th scope="col">Shows</th><th scope="col">Media</th><th scope="col">Title</th><th scope="col">Runs</th><th scope="col">Status</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {promos === null ? <tr><td colSpan={6} className="muted">Loading…</td></tr> : null}
              {promos && promos.length === 0 ? <tr><td colSpan={6} className="muted">No promotions yet.</td></tr> : null}
              {(promos ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{PLACEMENTS[p.placement]}{p.menuItemId ? <div className="muted">{productName(p.menuItemId)}</div> : null}</td>
                  <td>{p.media.kind === 'video' ? 'Video' : 'Picture'}</td>
                  <td>{p.title.en || <span className="muted">No title</span>}</td>
                  <td className="muted">{new Date(p.startsAt).toLocaleDateString()} – {new Date(p.endsAt).toLocaleDateString()}</td>
                  <td><span className={`status ${status(p).toLowerCase()}`}>{status(p)}</span></td>
                  <td>
                    <div className="row">
                      <button type="button" className="btn secondary sm" onClick={() => setEditing(p)}>Edit</button>
                      <button type="button" className="btn danger sm" onClick={() => remove(p.id)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editing ? (
          <PromotionEditor
            key={editing === 'new' ? 'new' : editing.id}
            promo={editing === 'new' ? null : editing}
            catalog={catalog}
            mediaByProduct={mediaByProduct}
            onClose={() => setEditing(null)}
            onSaved={async (text) => { setMessage(text); await load(); }}
          />
        ) : null}
      </div>
    </section>
  );
}

function PromotionEditor({ promo, catalog, mediaByProduct, onClose, onSaved }) {
  const [placement, setPlacement] = useState(promo?.placement ?? 'hero');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toLocal = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const now = new Date();

  // Every picture and video in every product's gallery, labelled by product.
  const options = catalog.products.flatMap((p) => (mediaByProduct[p.id] ?? []).map((m, i) => ({
    id: m.id,
    productId: p.id,
    label: `${p.name.en} — ${m.kind === 'video' ? 'video' : 'picture'} ${i + 1}`,
  })));

  async function save(event) {
    event.preventDefault();
    setError('');
    const f = new FormData(event.currentTarget);
    const body = {
      placement: f.get('placement'),
      menuItemId: f.get('placement') === 'product_background' ? f.get('menuItemId') : null,
      mediaId: f.get('mediaId'),
      titleEn: f.get('titleEn'),
      titleAr: f.get('titleAr'),
      ctaEn: f.get('ctaEn'),
      ctaAr: f.get('ctaAr'),
      startsAt: new Date(f.get('startsAt')).toISOString(),
      endsAt: new Date(f.get('endsAt')).toISOString(),
      active: f.get('active') === 'on',
    };
    setBusy(true);
    try {
      if (promo) await api.updatePromotion(promo.id, body);
      else await api.createPromotion(body);
      await onSaved(promo ? 'Promotion saved.' : 'Promotion added.');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="promo-title">
      <form className="card stack" onSubmit={save}>
        <div className="row between">
          <h2 id="promo-title">{promo ? 'Edit promotion' : 'New promotion'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        <label>Where it shows
          <select name="placement" value={placement} onChange={(e) => setPlacement(e.target.value)}>
            {Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {placement === 'product_background' ? (
          <label>Product it plays behind
            <select name="menuItemId" defaultValue={promo?.menuItemId ?? catalog.products[0]?.id} required>
              {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name.en}</option>)}
            </select>
          </label>
        ) : null}
        <label>Picture or video
          <select name="mediaId" defaultValue={promo?.media.id ?? ''} required>
            <option value="" disabled>Choose one</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        {options.length === 0 ? <p className="muted">Add pictures or videos to a product first.</p> : null}
        <div className="grid-form">
          <label>Title (English)<input name="titleEn" maxLength={120} defaultValue={promo?.title.en ?? ''} /></label>
          <label>Title (Arabic)<input name="titleAr" maxLength={120} dir="rtl" defaultValue={promo?.title.ar ?? ''} /></label>
        </div>
        <div className="grid-form">
          <label>Button (English)<input name="ctaEn" maxLength={40} defaultValue={promo?.cta.en ?? ''} placeholder="Order now" /></label>
          <label>Button (Arabic)<input name="ctaAr" maxLength={40} dir="rtl" defaultValue={promo?.cta.ar ?? ''} /></label>
        </div>
        <div className="grid-form">
          <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={promo ? toLocal(promo.startsAt) : toLocal(now.toISOString())} /></label>
          <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={promo ? toLocal(promo.endsAt) : toLocal(new Date(now.getTime() + 14 * 864e5).toISOString())} /></label>
        </div>
        <label className="choice"><input name="active" type="checkbox" defaultChecked={promo ? promo.active : true} /> Switched on</label>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy || options.length === 0} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}
