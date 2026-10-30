import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api.js';

const PLACEMENTS = {
  hero: 'Hero, full width at the top of the home screen',
  carousel: 'Offers carousel, slides on its own',
  welcome: 'Pop-up when the app opens',
  strip: 'Offer strip above the menu bar',
  mid_feed: 'Spotlight, between home sections',
  product_background: 'Plays behind a product when it is opened',
};
// Where a picture is optional: these can run on colour and words, or on a linked offer's terms.
const MEDIA_OPTIONAL = ['carousel', 'welcome', 'strip'];
const ANIMATIONS = { slide_up: 'Slide up from the bottom', slide_down: 'Slide down from the top', slide_left: 'Slide in from the left', slide_right: 'Slide in from the right', zoom: 'Zoom in', fade: 'Fade in' };
const SIZES = { compact: 'Compact', standard: 'Standard', tall: 'Tall', full: 'Full screen' };
const FRAMES = { rounded: 'Rounded card', square: 'Square edges', ticket: 'Ticket', circle: 'Circle picture' };
const FREQUENCIES = { every_open: 'Every time the app opens', once_per_day: 'Once a day', once: 'Only once per customer' };
// Which look settings mean something in each place.
const USES = {
  hero: ['animation', 'size', 'duration'],
  carousel: ['animation', 'frame', 'colour', 'duration'],
  welcome: ['animation', 'size', 'frame', 'colour', 'frequency'],
  strip: ['animation', 'colour'],
  mid_feed: ['size', 'frame', 'colour'],
  product_background: [],
};
const mediaLabel = (m) => (!m ? 'None' : m.kind === 'video' ? 'Video' : m.mime === 'image/gif' ? 'GIF' : 'Picture');

// A promotion puts a picture, GIF, video or offer in one place on the customer's home, for a set time, with the look
// staff choose: how it arrives, its size and frame, its colour and how long it stays.
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
      <p className="muted">Upload a picture, GIF or video, or link an offer, and choose where it shows and how it arrives. A promotion runs only inside its dates; one linked to an offer stops when the offer ends.</p>
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
                  <td>{mediaLabel(p.media)}{p.offer ? <div className="muted">{p.offer.headline.en}</div> : null}</td>
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
  const [media, setMedia] = useState(promo?.media ?? null);
  const [look, setLook] = useState({ animation: 'slide_up', size: 'standard', frame: 'rounded', colour: null, durationSeconds: 5, frequency: 'once_per_day', ...(promo?.look ?? {}) });
  const [title, setTitle] = useState(promo?.title.en ?? '');
  const [offerId, setOfferId] = useState(promo?.offer?.offerId ?? '');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [replay, setReplay] = useState(0);
  const toLocal = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const now = new Date();
  const uses = USES[placement];
  const setL = (k, v) => { setLook((l) => ({ ...l, [k]: v })); setReplay((n) => n + 1); };

  // Every picture and video in every product's gallery, labelled by product.
  const options = catalog.products.flatMap((p) => (mediaByProduct[p.id] ?? []).map((m, i) => ({
    ...m,
    label: `${p.name.en}, ${mediaLabel(m).toLowerCase()} ${i + 1}`,
  })));
  const offer = catalog.offers.find((o) => o.id === offerId);

  async function upload(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      setMedia((await api.uploadPromotionMedia(file)).media);
      setReplay((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const f = new FormData(event.currentTarget);
    const body = {
      placement,
      menuItemId: f.get('menuItemId') || null,
      mediaId: media?.id ?? null,
      offerId: offerId || null,
      kickerEn: f.get('kickerEn') ?? '',
      kickerAr: f.get('kickerAr') ?? '',
      titleEn: f.get('titleEn'),
      titleAr: f.get('titleAr'),
      bodyEn: f.get('bodyEn') ?? '',
      bodyAr: f.get('bodyAr') ?? '',
      ctaEn: f.get('ctaEn') ?? '',
      ctaAr: f.get('ctaAr') ?? '',
      animation: look.animation,
      size: look.size,
      frame: look.frame,
      colour: look.colour,
      durationSeconds: Number(look.durationSeconds),
      frequency: look.frequency,
      position: Number(f.get('position') || 0),
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

  const needsMedia = !MEDIA_OPTIONAL.includes(placement);
  return (
    <div className="drawer" role="dialog" aria-modal="false" aria-labelledby="promo-title">
      <form className="card stack" onSubmit={save}>
        <div className="row between sheet-head">
          <h2 id="promo-title">{promo ? 'Edit promotion' : 'New promotion'}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Close"><X className="icon" aria-hidden="true" /></button>
        </div>

        <div className="form-grid">
          <label className="full">Where it shows
            <select name="placement" value={placement} onChange={(e) => { setPlacement(e.target.value); setReplay((n) => n + 1); }}>
              {Object.entries(PLACEMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="stack">
          <legend>Picture, GIF or video{needsMedia ? '' : ' (optional)'}</legend>
          <div className="row">
            <div className="promo-thumb">{media ? (media.kind === 'video' ? <video src={media.url} muted playsInline aria-label="Chosen video" /> : <img src={media.url} alt="Chosen picture" />) : <span className="muted">None</span>}</div>
            <div className="stack" style={{ flex: 1, minWidth: 0 }}>
              <label className="btn secondary sm upload">{uploading ? 'Uploading…' : 'Upload a file'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" onChange={(e) => upload(e.target.files?.[0])} disabled={uploading} />
              </label>
              <label>Or use one from a product
                <select value={options.some((o) => o.id === media?.id) ? media.id : ''} onChange={(e) => { setMedia(options.find((o) => o.id === e.target.value) ?? null); setReplay((n) => n + 1); }}>
                  <option value="">Choose one</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              {media && !needsMedia ? <button type="button" className="btn ghost sm" onClick={() => setMedia(null)}>Use no picture</button> : null}
            </div>
          </div>
          <p className="hint">JPEG, PNG or WebP up to 3 MB, GIF up to 8 MB, MP4, MOV or WebM up to 60 MB.</p>
        </fieldset>

        <div className="form-grid">
          {placement === 'product_background' ? (
            <label>Product it plays behind
              <select name="menuItemId" defaultValue={promo?.menuItemId ?? catalog.products[0]?.id} required>
                {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name.en}</option>)}
              </select>
            </label>
          ) : (
            <label>Button opens
              <select name="menuItemId" defaultValue={promo?.menuItemId ?? ''}>
                <option value="">The menu</option>
                {catalog.products.map((p) => <option key={p.id} value={p.id}>{p.name.en}</option>)}
              </select>
            </label>
          )}
          {placement !== 'product_background' ? (
            <label>Offer to show (optional)
              <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
                <option value="">No offer</option>
                {catalog.offers.map((o) => <option key={o.id} value={o.id}>{o.name.en}{o.code ? ` · ${o.code}` : ''}{o.active ? '' : ' (off)'}</option>)}
              </select>
            </label>
          ) : null}
          <label>Small label (English)<input name="kickerEn" maxLength={40} defaultValue={promo?.kicker.en ?? ''} placeholder="This weekend" /></label>
          <label>Small label (Arabic)<input name="kickerAr" maxLength={40} dir="rtl" defaultValue={promo?.kicker.ar ?? ''} /></label>
          <label>Title (English)<input name="titleEn" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Title (Arabic)<input name="titleAr" maxLength={120} dir="rtl" defaultValue={promo?.title.ar ?? ''} /></label>
          <label>Line under the title (English)<input name="bodyEn" maxLength={200} defaultValue={promo?.body.en ?? ''} /></label>
          <label>Line under the title (Arabic)<input name="bodyAr" maxLength={200} dir="rtl" defaultValue={promo?.body.ar ?? ''} /></label>
          <label>Button (English)<input name="ctaEn" maxLength={40} defaultValue={promo?.cta.en ?? ''} placeholder="Order now" /></label>
          <label>Button (Arabic)<input name="ctaAr" maxLength={40} dir="rtl" defaultValue={promo?.cta.ar ?? ''} /></label>
        </div>

        {uses.length ? (
          <fieldset className="stack">
            <legend>How it looks and arrives</legend>
            <div className="promo-look">
              <div className="form-grid">
                {uses.includes('animation') ? (
                  <label>{placement === 'welcome' || placement === 'strip' ? 'Arrives' : 'Moves to the next slide'}
                    <select value={look.animation} onChange={(e) => setL('animation', e.target.value)}>{Object.entries(ANIMATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                ) : null}
                {uses.includes('size') ? (
                  <label>Size<select value={look.size} onChange={(e) => setL('size', e.target.value)}>{Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                ) : null}
                {uses.includes('frame') ? (
                  <label>Frame<select value={look.frame} onChange={(e) => setL('frame', e.target.value)}>{Object.entries(FRAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                ) : null}
                {uses.includes('duration') ? (
                  <label>Seconds on screen<input type="number" min={3} max={20} value={look.durationSeconds} onChange={(e) => setL('durationSeconds', e.target.value)} /></label>
                ) : null}
                {uses.includes('frequency') ? (
                  <label>Shows<select value={look.frequency} onChange={(e) => setL('frequency', e.target.value)}>{Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                ) : null}
                {uses.includes('colour') ? (
                  <div className="stack">
                    <label className="choice"><input type="checkbox" checked={!look.colour} onChange={(e) => setL('colour', e.target.checked ? null : '#0F766E')} /> Use the brand colour</label>
                    {look.colour ? <label>Colour<input type="color" value={look.colour} onChange={(e) => setL('colour', e.target.value.toUpperCase())} /></label> : null}
                  </div>
                ) : null}
              </div>
              <PromoPreview key={replay} placement={placement} look={look} media={media} title={title} offer={offer} onReplay={() => setReplay((n) => n + 1)} />
            </div>
            {look.colour && whiteContrast(look.colour) < 4.5 ? <p role="alert" className="error">White words on this colour are hard to read ({whiteContrast(look.colour).toFixed(1)}:1). Choose a darker shade.</p> : null}
          </fieldset>
        ) : null}

        <div className="form-grid">
          <label>Order among others<input name="position" type="number" min={0} max={99} defaultValue={promo?.position ?? 0} /></label>
          <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={promo ? toLocal(promo.startsAt) : toLocal(now.toISOString())} /></label>
          <label>Ends<input name="endsAt" type="datetime-local" required defaultValue={promo ? toLocal(promo.endsAt) : toLocal(new Date(now.getTime() + 14 * 864e5).toISOString())} /></label>
          <label className="choice full"><input name="active" type="checkbox" defaultChecked={promo ? promo.active : true} /> Switched on</label>
        </div>
        {error ? <p role="alert" className="error">{error}</p> : null}
        <div className="actions submit">
          <button type="submit" className="btn primary" disabled={busy || uploading || (needsMedia && !media)} aria-busy={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function whiteContrast(hex) {
  const c = (i) => { const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 1.05 / (0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2) + 0.05);
}

/** A small phone that plays the chosen arrival, so staff see the effect before saving. */
function PromoPreview({ placement, look, media, title, offer, onReplay }) {
  const bg = look.colour ?? 'var(--accent)';
  const headline = offer ? (offer.type === 'percent' ? `${offer.value / 100}% OFF` : offer.type === 'free_delivery' ? 'FREE DELIVERY' : 'OFFER') : '';
  const pic = media ? (media.kind === 'video' ? <video src={media.url} muted autoPlay loop playsInline aria-hidden="true" /> : <img src={media.url} alt="" />) : null;
  return (
    <div className="promo-preview" aria-label="Preview">
      <div className={`pp-phone pp-${placement}`}>
        <div className={`pp-item anim-${look.animation} size-${look.size} frame-${look.frame}`} style={{ '--pp-bg': bg }}>
          {pic}
          <span className="pp-text">{title || headline || 'Title'}</span>
          {placement === 'welcome' && headline ? <b className="pp-ticket">{headline}</b> : null}
        </div>
      </div>
      <button type="button" className="btn ghost sm" onClick={onReplay}>Play again</button>
    </div>
  );
}
