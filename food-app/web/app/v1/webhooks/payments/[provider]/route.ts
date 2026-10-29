import { NextRequest, NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { confirmCardPayment } from '@/lib/orders.ts';
import { verifyStripeSignature } from '@/lib/stripe-signature.ts';
import { stripeWebhookSecret } from '@/lib/payments/stripe.ts';

type StripeEvent = {
  id: string;
  type: string;
  data: { object: { id: string; amount_received?: number; amount: number; currency: string; metadata?: { order_id?: string } } };
};

// 1) verify the signature on the raw body, 2) store the event once, 3) process. Processing is idempotent by
// order status, so a retried event never confirms an order twice.
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== 'stripe') return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  const raw = await request.text();
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), stripeWebhookSecret(), nowSeconds)) {
    return NextResponse.json({ error: 'signature check failed' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'not JSON' }, { status: 400 });
  }

  const object = event.data?.object;
  const orderId = object?.metadata?.order_id ?? null;
  data.recordPaymentEvent(event.id, event.type, orderId);

  if (event.type === 'payment_intent.succeeded' && object) {
    const amount = object.amount_received ?? object.amount;
    confirmCardPayment(object.id, orderId, amount, object.currency);
  }
  return NextResponse.json({ received: true });
}
