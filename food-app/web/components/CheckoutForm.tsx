'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';
import { Money } from '@/components/Money';

type Channel = 'delivery' | 'pickup';
type Method = 'card' | 'cod' | 'pay_on_arrival';
type Quote = { subtotalMinor: number; deliveryFeeMinor: number; serviceFeeMinor: number; totalMinor: number; taxIncludedMinor: number; taxLabel: string; currency: string };
type Payments = { cod: boolean; payOnArrival: boolean; card: boolean };

export function CheckoutForm({ locale }: { locale: Locale }) {
  const s = t(locale);
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>('delivery');
  const [method, setMethod] = useState<Method>('cod');
  const [address, setAddress] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per form visit: a double tap on "Place order" returns the same order instead of a second one.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    fetch('/v1/menu').then((r) => r.json()).then((m) => setPayments(m.payments));
  }, []);

  useEffect(() => {
    fetch('/v1/checkout/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) setError(body.error?.message ?? s.errorGeneric);
        else {
          setError('');
          setQuote(body.quote);
        }
      })
      .catch(() => setError(s.errorGeneric));
    // Pick a payment method the channel allows, keeping the current one if it still fits.
    setMethod((current) => {
      const allowed: Method[] = channel === 'delivery' ? ['cod', 'card'] : ['pay_on_arrival', 'card'];
      return allowed.includes(current) ? current : allowed[0];
    });
  }, [channel, s.errorGeneric]);

  const methods: { value: Method; label: string; available: boolean }[] = [
    { value: 'cod', label: s.payCod, available: channel === 'delivery' && Boolean(payments?.cod) },
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
        body: JSON.stringify({ channel, method, address, idempotencyKey }),
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

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <fieldset>
        <legend>{locale === 'ar' ? 'الاستلام' : 'How you get it'}</legend>
        <label className="choice"><input type="radio" name="channel" value="delivery" checked={channel === 'delivery'} onChange={() => setChannel('delivery')} />{s.delivery}</label>
        <label className="choice"><input type="radio" name="channel" value="pickup" checked={channel === 'pickup'} onChange={() => setChannel('pickup')} />{s.pickup}</label>
      </fieldset>

      {channel === 'delivery' ? (
        <label>
          {s.address}
          <textarea value={address} maxLength={300} autoComplete="street-address" onChange={(e) => setAddress(e.target.value)} />
        </label>
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
          {quote.deliveryFeeMinor ? (<><dt>{s.deliveryFee}</dt><dd><Money minor={quote.deliveryFeeMinor} currency={quote.currency} locale={locale} /></dd></>) : null}
          {quote.serviceFeeMinor ? (<><dt>{s.serviceFee}</dt><dd><Money minor={quote.serviceFeeMinor} currency={quote.currency} locale={locale} /></dd></>) : null}
          <dt>{s.total}</dt>
          <dd className="grand"><Money minor={quote.totalMinor} currency={quote.currency} locale={locale} /></dd>
          <dt className="muted" style={{ gridColumn: '1 / -1' }}>{s.includesTax} {quote.taxLabel} <Money minor={quote.taxIncludedMinor} currency={quote.currency} locale={locale} /></dt>
        </dl>
      ) : null}

      {error ? <p role="alert" className="error">{error}</p> : null}
      <button type="submit" className="btn primary lg" disabled={busy || !quote} aria-busy={busy}>
        {busy ? s.placing : s.placeOrder}
      </button>
    </form>
  );
}
