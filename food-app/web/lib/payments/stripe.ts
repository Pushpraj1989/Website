// The only file that talks to Stripe. Card amounts are sent in the currency's smallest unit, the same
// integer as orders.total_minor. Calls are plain HTTPS so no secret ever reaches the browser.
const API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

export function stripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? '';
}

type IntentResponse = { id: string; client_secret: string };

async function stripeRequest<T>(method: 'GET' | 'POST', path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ''}` };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${API}${path}`, { method, headers, body, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Stripe ${method} ${path} failed with ${response.status}`);
  return (await response.json()) as T;
}

/**
 * Creates the PaymentIntent once per order. A retry reuses the same idempotency key, so Stripe never charges
 * twice; an intent that already exists is fetched instead of created.
 */
export async function paymentIntentFor(order: {
  id: string;
  paymentIntentId: string | null;
  totalMinor: number;
  currency: string;
}): Promise<{ id: string; clientSecret: string; created: boolean }> {
  if (order.paymentIntentId) {
    const existing = await stripeRequest<IntentResponse>('GET', `/payment_intents/${order.paymentIntentId}`);
    return { id: existing.id, clientSecret: existing.client_secret, created: false };
  }
  const body = new URLSearchParams({
    amount: String(order.totalMinor),
    currency: order.currency.toLowerCase(),
    'metadata[order_id]': order.id,
    'automatic_payment_methods[enabled]': 'true',
  });
  const intent = await stripeRequest<IntentResponse>('POST', '/payment_intents', body, `pi-${order.id}`);
  return { id: intent.id, clientSecret: intent.client_secret, created: true };
}
