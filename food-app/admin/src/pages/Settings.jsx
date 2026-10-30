import React, { useEffect, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { formatMoney, parseMoney } from '../money.js';

// WCAG 2.2 contrast of white text on a colour, the same check the server makes before saving.
function contrastWithWhite(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return 1.05 / (l + 0.05);
}

// The restaurant's own identity and ordering rules. Everything the customer app shows about the restaurant comes from here.
export default function Settings({ onBrandChanged }) {
  const [settings, setSettings] = useState(null);
  const [color, setColor] = useState('#B45309');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings().then(({ settings: s }) => { setSettings(s); setColor(s.brandColor); }).catch((err) => setError(err.message));
  }, []);

  if (!settings) return <section className="stack"><h1>Restaurant</h1>{error ? <p role="alert" className="error">{error}</p> : <p className="muted">Loading…</p>}</section>;
  const digits = 2;
  const contrast = contrastWithWhite(color);

  async function save(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    const f = new FormData(event.currentTarget);
    const cashLimit = parseMoney(f.get('cashLimit') || '0', digits);
    const serviceFee = parseMoney(f.get('serviceFee') || '0', digits);
    if (cashLimit === null) return setError(`Enter the cash limit in ${settings.currency}, like 300.00. Use 0 for no limit.`);
    if (serviceFee === null) return setError(`Enter the service fee in ${settings.currency}, like 2.00.`);
    setBusy(true);
    try {
      const { settings: saved } = await api.saveSettings({
        name: { en: f.get('nameEn'), ar: f.get('nameAr') },
        tagline: { en: f.get('taglineEn'), ar: f.get('taglineAr') },
        phone: f.get('phone'),
        address: { en: f.get('addressEn'), ar: f.get('addressAr') },
        brandColor: color,
        cashLimitMinor: cashLimit,
        serviceFeeMinor: serviceFee,
        payments: { cod: f.get('cod') === 'on', payOnArrival: f.get('payOnArrival') === 'on', card: f.get('card') === 'on' },
      });
      setSettings(saved);
      setMessage('Saved. The customer app shows the changes the next time it opens.');
      onBrandChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const { settings: saved } = await api.uploadLogo(file);
      setSettings(saved);
      setMessage('Logo updated.');
      onBrandChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLogo() {
    try {
      const { settings: saved } = await api.removeLogo();
      setSettings(saved);
      setMessage('Logo removed. The app shows the restaurant name instead.');
      onBrandChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h1>Restaurant</h1>
          <p className="muted">Your name, logo, colour and ordering rules. The customer app and this console use them.</p>
        </div>
      </div>
      {message ? <p role="status" className="ok">{message}</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}

      <div className="card stack">
        <h2>Logo</h2>
        <div className="row">
          <div className="logo-preview" aria-hidden={settings.logoUrl ? undefined : 'true'}>
            {settings.logoUrl ? <img src={settings.logoUrl} alt={`${settings.name.en} logo`} /> : <span>{settings.name.en.slice(0, 1)}</span>}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <label className="btn file"><ImageUp className="icon" aria-hidden="true" /> {settings.logoUrl ? 'Replace logo' : 'Upload logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} />
            </label>
            {settings.logoUrl ? <button type="button" className="btn ghost sm" onClick={removeLogo}><Trash2 className="icon" aria-hidden="true" /> Remove logo</button> : null}
            <p className="hint">A square PNG, JPEG or WebP picture, up to 1 MB. Without a logo the app shows the name.</p>
          </div>
        </div>
      </div>

      <form className="stack" onSubmit={save}>
        <div className="card stack">
          <h2>Name and contact</h2>
          <div className="form-grid">
            <label>Name (English)<input id="nameEn" name="nameEn" required minLength={2} maxLength={80} defaultValue={settings.name.en} /></label>
            <label>Name (Arabic)<input id="nameAr" name="nameAr" required minLength={2} maxLength={80} dir="rtl" defaultValue={settings.name.ar} /></label>
            <label>Tagline (English) <span className="hint">optional</span><input id="taglineEn" name="taglineEn" maxLength={120} defaultValue={settings.tagline.en} /></label>
            <label>Tagline (Arabic) <span className="hint">optional</span><input id="taglineAr" name="taglineAr" maxLength={120} dir="rtl" defaultValue={settings.tagline.ar} /></label>
            <label>Phone<input id="phone" name="phone" type="tel" required minLength={6} maxLength={30} defaultValue={settings.phone} /></label>
            <label>Address (English) <span className="hint">optional</span><input id="addressEn" name="addressEn" maxLength={200} defaultValue={settings.address.en} /></label>
            <label>Address (Arabic) <span className="hint">optional</span><input id="addressAr" name="addressAr" maxLength={200} dir="rtl" defaultValue={settings.address.ar} /></label>
          </div>
        </div>

        <div className="card stack">
          <h2>Brand colour</h2>
          <div className="form-grid">
            <label>Colour<input id="brandColorPicker" type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} /></label>
            <label>Hex code<input id="brandColor" value={color} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={(e) => setColor(e.target.value.toUpperCase())} /></label>
            <div className="brand-sample" style={{ '--sample': color }}>
              <span className="btn primary sample-btn">Add to cart</span>
            </div>
          </div>
          <p className={contrast >= 4.5 ? 'hint' : 'error'} role={contrast >= 4.5 ? undefined : 'alert'}>
            {contrast >= 4.5
              ? `White text on this colour has a contrast of ${contrast.toFixed(1)}:1, which is easy to read.`
              : `White text on this colour has a contrast of ${contrast.toFixed(1)}:1. Choose a darker shade (4.5:1 or more).`}
          </p>
        </div>

        <div className="card stack">
          <h2>Ordering</h2>
          <fieldset className="choices">
            <legend>Ways to pay</legend>
            <label className="choice"><input id="cod" name="cod" type="checkbox" defaultChecked={settings.payments.cod} /> Cash on delivery</label>
            <label className="choice"><input id="payOnArrival" name="payOnArrival" type="checkbox" defaultChecked={settings.payments.payOnArrival} /> Pay on arrival (pickup)</label>
            <label className="choice"><input id="card" name="card" type="checkbox" defaultChecked={settings.payments.card && settings.cardAvailable} disabled={!settings.cardAvailable} /> Card {settings.cardAvailable ? '' : <span className="hint">needs the payment provider set up</span>}</label>
          </fieldset>
          <div className="form-grid">
            <label>Cash limit, {settings.currency} <span className="hint">0 for none</span><input id="cashLimit" name="cashLimit" inputMode="decimal" defaultValue={(settings.cashLimitMinor / 100).toFixed(digits)} /></label>
            <label>Service fee, {settings.currency}<input id="serviceFee" name="serviceFee" inputMode="decimal" defaultValue={(settings.serviceFeeMinor / 100).toFixed(digits)} /></label>
          </div>
          <p className="hint">Currency {settings.currency} and tax ({settings.taxLabel} {settings.taxBasisPoints / 100}%) are set for your country when the restaurant is set up. Cash orders above {settings.cashLimitMinor > 0 ? formatMoney(settings.cashLimitMinor, digits, settings.currency) : 'any amount'} are refused.</p>
        </div>

        <div className="actions submit">
          <button type="submit" className="btn primary" disabled={busy || contrast < 4.5} aria-busy={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
    </section>
  );
}
