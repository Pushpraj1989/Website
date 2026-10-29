'use client';

import { useEffect, useRef, useState } from 'react';
import { t, type Locale } from '@/lib/i18n.ts';

type StripeLike = {
  elements: (options: { clientSecret: string }) => {
    create: (type: 'payment') => { mount: (el: HTMLElement) => void };
  };
  confirmPayment: (options: { elements: unknown; confirmParams: { return_url: string }; redirect: 'if_required' }) => Promise<{ error?: { message?: string } }>;
};

declare global {
  interface Window {
    Stripe?: (key: string) => StripeLike;
  }
}

// Stripe Payment Element. The card form is Stripe's; the app never sees a card number.
export function PaymentPanel({ orderId, locale }: { orderId: string; locale: Locale }) {
  const s = t(locale);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const stripeRef = useRef<StripeLike | null>(null);
  const elementsRef = useRef<unknown>(null);

  async function start() {
    setError('');
    const response = await fetch(`/v1/orders/${orderId}/payment`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok || !body.publishableKey) {
      setError(body.error?.message ?? s.cardUnavailable);
      return;
    }
    await loadScript('https://js.stripe.com/v3/');
    const stripe = window.Stripe!(body.publishableKey);
    const elements = stripe.elements({ clientSecret: body.clientSecret });
    elements.create('payment').mount(document.getElementById('payment-element') as HTMLElement);
    stripeRef.current = stripe;
    elementsRef.current = elements;
    setReady(true);
  }

  async function pay() {
    const result = await stripeRef.current!.confirmPayment({
      elements: elementsRef.current,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (result.error) setError(result.error.message ?? s.errorGeneric);
  }

  useEffect(() => {
    start().catch(() => setError(s.errorGeneric));
    // Runs once for this order; start is recreated each render but depends only on orderId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="card stack">
      <div id="payment-element" />
      {error ? <p role="alert" className="error">{error}</p> : null}
      <button type="button" className="btn primary lg" onClick={pay} disabled={!ready}>{s.payCard}</button>
    </div>
  );
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment form.'));
    document.head.appendChild(script);
  });
}
