'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';
import { formatMoney } from '@/lib/money.ts';

type Channel = 'delivery' | 'pickup' | 'shipping';
type Rate = { id: string; name: Localised; eta: Localised; priceMinor: number; freeOverMinor: number | null };
type Method = 'card' | 'cod' | 'pay_on_arrival';
type Quote = { subtotalMinor: number; deliveryFeeMinor: number; serviceFeeMinor: number; totalMinor: number; taxIncludedMinor: number; taxLabel: string; currency: string };
type Payments = { cod: boolean; payOnArrival: boolean; card: boolean };
type Localised = { en: string; ar: string };
type Zone = { id: string; name: Localised; feeMinor: number; minOrderMinor: number };
type SavedAddress = { id: string; label: string; line1: string; line2: string; isDefault: boolean; zone: { name: Localised } | null; city?: string; country?: string };
type Delivery = { minOrderMinor: number; deliverable: boolean } | null;

const blankAddress = { label: '', line1: '', line2: '', zoneId: '' };
const blankShipping = { label: '', line1: '', line2: '', city: '', country: '' };
/** An address a courier can use: it has a city and a country. */
const shippable = (a: SavedAddress) => Boolean(a.city && a.country);

export function CheckoutForm({ locale }: { locale: Locale }) {
  const s = t(locale);
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>('delivery');
  const [method, setMethod] = useState<Method>('cod');
  // Delivery goes to a saved address: its zone sets the fee and the minimum order, as in the app.
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [draft, setDraft] = useState<typeof blankAddress | null>(null);
  // Courier shipping (shops): the options on offer, the one chosen, and a new shipping address being typed.
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateId, setRateId] = useState<string | null>(null);
  const [shipDraft, setShipDraft] = useState<typeof blankShipping | null>(null);
  const [shipAddressId, setShipAddressId] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [delivery, setDelivery] = useState<Delivery>(null);
  // Unknown until the cart is read; an empty cart is a state, not an error, so it is never sent for pricing.
  const [cartFilled, setCartFilled] = useState<boolean | null>(null);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per form visit: a double tap on "Place order" returns the same order instead of a second one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    fetch('/v1/menu').then((r) => r.json()).then((m) => setPayments(m.payments));
    fetch('/v1/delivery-zones').then((r) => r.json()).then((b) => setZones(b.zones ?? [])).catch(() => setZones([]));
    fetch('/v1/shipping-rates').then((r) => r.json()).then((b) => { setRates(b.rates ?? []); setRateId((b.rates ?? [])[0]?.id ?? null); }).catch(() => setRates([]));
    loadAddresses();
    fetch('/v1/cart').then((r) => r.json()).then((c) => setCartFilled((c.lines ?? []).length > 0)).catch(() => setCartFilled(true));
  }, []);

  async function loadAddresses(choose?: string) {
    try {
      const body = await (await fetch('/v1/addresses')).json();
      const list: SavedAddress[] = body.addresses ?? [];
      setAddresses(list);
      setAddressId((current) => {
        const keep = choose ?? current;
        if (keep && list.some((a) => a.id === keep)) return keep;
        return (list.find((a) => a.isDefault) ?? list[0])?.id ?? null;
      });
      setShipAddressId((current) => {
        const keep = choose ?? current;
        if (keep && list.some((a) => a.id === keep && shippable(a))) return keep;
        return list.find(shippable)?.id ?? null;
      });
    } catch {
      setAddresses([]);
    }
  }

  useEffect(() => {
    setQuote(null);
    setDelivery(null);
    if (!cartFilled) return;
    fetch('/v1/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, addressId: channel === 'delivery' ? addressId : channel === 'shipping' ? shipAddressId : null, shippingRateId: channel === 'shipping' ? rateId : null }),
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          if (body.error?.code === 'empty_cart') setCartFilled(false);
          else setError(body.error?.message ?? s.errorGeneric);
        } else {
          setError('');
          setQuote(body.quote);
          setDelivery(body.delivery ?? null);
        }
      })
      .catch(() => setError(s.errorGeneric));
    // Pick a payment method the channel allows, keeping the current one if it still fits.
    setMethod((current) => {
      const allowed: Method[] = channel === 'pickup' ? ['pay_on_arrival', 'card'] : ['cod', 'card'];
      return allowed.includes(current) ? current : allowed[0];
    });
  }, [channel, addressId, shipAddressId, rateId, cartFilled, s.errorGeneric]);

  async function saveShippingAddress() {
    if (!shipDraft) return;
    setSavingAddress(true);
    setError('');
    try {
      const response = await fetch('/v1/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shipDraft, label: shipDraft.label || 'Home', forShipping: true }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? s.errorGeneric);
        return;
      }
      setShipDraft(null);
      await loadAddresses(body.address.id);
    } catch {
      setError(s.errorGeneric);
    } finally {
      setSavingAddress(false);
    }
  }

  async function saveAddress() {
    if (!draft) return;
    setSavingAddress(true);
    setError('');
    try {
      const response = await fetch('/v1/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: draft.label, line1: draft.line1, line2: draft.line2, zoneId: draft.zoneId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? s.errorGeneric);
        return;
      }
      setDraft(null);
      await loadAddresses(body.address.id);
    } catch {
      setError(s.errorGeneric);
    } finally {
      setSavingAddress(false);
    }
  }

  const methods: { value: Method; label: string; available: boolean }[] = [
    { value: 'cod', label: s.payCod, available: channel !== 'pickup' && Boolean(payments?.cod) },
    { value: 'pay_on_arrival', label: s.payArrival, available: channel === 'pickup' && Boolean(payments?.payOnArrival) },
    { value: 'card', label: s.payCard, available: Boolean(payments?.card) },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, method, addressId: channel === 'delivery' ? addressId : channel === 'shipping' ? shipAddressId : null, shippingRateId: channel === 'shipping' ? rateId : null, idempotencyKey }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? s.errorGeneric);
        return;
      }
      router.push(`/orders/${body.order.id}`);
    } catch {
      setError(s.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (cartFilled === false) {
    return (
      <div className="card stack">
        <p>{s.emptyCart}</p>
        <a className="btn primary lg" href="/menu">{s.browseMenu}</a>
      </div>
    );
  }

  const deliveryBlocked = (channel === 'delivery' && (!addressId || (delivery !== null && !delivery.deliverable)))
    || (channel === 'shipping' && (!shipAddressId || !rateId));
  const shipForm = shipDraft ? (
    <div className="card stack" role="group" aria-label={s.addShippingAddress}>
      <label>{s.addressLine1}<input value={shipDraft.line1} maxLength={200} required autoComplete="address-line1" onChange={(e) => setShipDraft({ ...shipDraft, line1: e.target.value })} /></label>
      <label>{s.addressLine2}<input value={shipDraft.line2} maxLength={200} autoComplete="address-line2" onChange={(e) => setShipDraft({ ...shipDraft, line2: e.target.value })} /></label>
      <label>{s.city}<input value={shipDraft.city} maxLength={80} required autoComplete="address-level2" onChange={(e) => setShipDraft({ ...shipDraft, city: e.target.value })} /></label>
      <label>{s.country}<input value={shipDraft.country} maxLength={80} required autoComplete="country-name" onChange={(e) => setShipDraft({ ...shipDraft, country: e.target.value })} /></label>
      <div className="row">
        <button type="button" className="btn primary" onClick={saveShippingAddress} disabled={savingAddress || shipDraft.line1.trim().length < 3 || shipDraft.city.trim().length < 2 || shipDraft.country.trim().length < 2} aria-busy={savingAddress}>{s.saveAddress}</button>
        <button type="button" className="btn" onClick={() => setShipDraft(null)}>{s.cancel}</button>
      </div>
    </div>
  ) : null;
  const addressForm = draft ? (
    <div className="card stack" role="group" aria-label={s.addAddress}>
      <label>{s.addressLabel}<input value={draft.label} maxLength={30} placeholder={s.addressLabelHint} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
      <label>{s.addressLine1}<input value={draft.line1} maxLength={200} required autoComplete="street-address" onChange={(e) => setDraft({ ...draft, line1: e.target.value })} /></label>
      <label>{s.addressLine2}<input value={draft.line2} maxLength={200} onChange={(e) => setDraft({ ...draft, line2: e.target.value })} /></label>
      <label>
        {s.deliveryArea}
        <select value={draft.zoneId} required onChange={(e) => setDraft({ ...draft, zoneId: e.target.value })}>
          <option value="">{s.chooseArea}</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name[locale]}</option>)}
        </select>
      </label>
      <div className="row">
        <button type="button" className="btn primary" onClick={saveAddress} disabled={savingAddress || draft.line1.trim().length < 3 || !draft.zoneId} aria-busy={savingAddress}>{s.saveAddress}</button>
        <button type="button" className="btn" onClick={() => setDraft(null)}>{s.cancel}</button>
      </div>
    </div>
  ) : null;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <fieldset>
        <legend>{s.howYouGetIt}</legend>
        <label className="choice"><input type="radio" name="channel" value="delivery" checked={channel === 'delivery'} onChange={() => setChannel('delivery')} />{s.delivery}</label>
        <label className="choice"><input type="radio" name="channel" value="pickup" checked={channel === 'pickup'} onChange={() => setChannel('pickup')} />{s.pickup}</label>
        {rates.length ? <label className="choice"><input type="radio" name="channel" value="shipping" checked={channel === 'shipping'} onChange={() => setChannel('shipping')} />{s.shipByCourier}</label> : null}
      </fieldset>

      {channel === 'shipping' ? (
        <>
          <fieldset>
            <legend>{s.shipTo}</legend>
            {(addresses ?? []).filter(shippable).map((a) => (
              <label key={a.id} className="choice">
                <input type="radio" name="shipAddress" value={a.id} checked={shipAddressId === a.id} onChange={() => setShipAddressId(a.id)} />
                <span><strong>{a.label}</strong> · {[a.line1, a.line2, a.city, a.country].filter(Boolean).join(', ')}</span>
              </label>
            ))}
            {shipForm ?? <button type="button" className="btn" onClick={() => setShipDraft({ ...blankShipping })}>{s.addShippingAddress}</button>}
          </fieldset>
          <fieldset>
            <legend>{s.shippingOption}</legend>
            {rates.map((r) => (
              <label key={r.id} className="choice">
                <input type="radio" name="rate" value={r.id} checked={rateId === r.id} onChange={() => setRateId(r.id)} />
                <span>
                  <strong>{r.name[locale]}</strong>{r.eta[locale] ? ` · ${r.eta[locale]}` : ''} · {formatMoney(r.priceMinor, quote?.currency ?? 'AED', locale)}
                  {r.freeOverMinor ? <span className="muted"> · {s.freeOver(formatMoney(r.freeOverMinor, quote?.currency ?? 'AED', locale))}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      {channel === 'delivery' ? (
        <fieldset>
          <legend>{s.address}</legend>
          {addresses !== null && addresses.length === 0 ? <p className="muted">{s.noAddressYet}</p> : null}
          {(addresses ?? []).map((a) => (
            <label key={a.id} className="choice">
              <input type="radio" name="address" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
              <span>
                <strong>{a.label}</strong> · {[a.line1, a.line2, a.zone?.name[locale] ?? ''].filter(Boolean).join(', ')}
              </span>
            </label>
          ))}
          {delivery && !delivery.deliverable && quote ? (
            <p role="alert" className="error">{s.belowMinimum} <Money minor={delivery.minOrderMinor} currency={quote.currency} locale={locale} /></p>
          ) : null}
          {addressForm ?? <button type="button" className="btn" onClick={() => setDraft({ ...blankAddress })}>{s.addAddress}</button>}
        </fieldset>
      ) : null}

      <fieldset>
        <legend>{s.paymentMethod}</legend>
        {methods.filter((m) => m.available).map((m) => (
          <label key={m.value} className="choice">
            <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
            {m.label}
          </label>
        ))}
      </fieldset>

      {quote ? (
        <dl className="totals card">
          <dt>{s.subtotal}</dt>
          <dd><Money minor={quote.subtotalMinor} currency={quote.currency} locale={locale} /></dd>
          {quote.deliveryFeeMinor ? (<><dt>{channel === 'shipping' ? s.shippingFee : s.deliveryFee}</dt><dd><Money minor={quote.deliveryFeeMinor} currency={quote.currency} locale={locale} /></dd></>) : null}
          {quote.serviceFeeMinor ? (<><dt>{s.serviceFee}</dt><dd><Money minor={quote.serviceFeeMinor} currency={quote.currency} locale={locale} /></dd></>) : null}
          <dt>{s.total}</dt>
          <dd className="grand"><Money minor={quote.totalMinor} currency={quote.currency} locale={locale} /></dd>
          <dt className="muted" style={{ gridColumn: '1 / -1' }}>{s.includesTax} {quote.taxLabel} <Money minor={quote.taxIncludedMinor} currency={quote.currency} locale={locale} /></dt>
        </dl>
      ) : null}

      {error ? <p role="alert" className="error">{error}</p> : null}
      <button type="submit" className="btn primary lg" disabled={busy || !quote || deliveryBlocked || !methods.some((m) => m.available)} aria-busy={busy}>
        {busy ? s.placing : s.placeOrder}
      </button>
    </form>
  );
}
