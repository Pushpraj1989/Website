import { NextRequest, NextResponse } from 'next/server';
import { guestHash, errorResponse } from '@/lib/http.ts';
import { cardIntentFor, ownedOrder, RuleError } from '@/lib/orders.ts';
import { stripeConfigured } from '@/lib/payments/stripe.ts';

// Creates the PaymentIntent for a card order. The browser gets only the client secret and the publishable key.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!stripeConfigured()) {
      return NextResponse.json({ error: { code: 'card_unavailable', message: 'Card payment is not available yet.' } }, { status: 503 });
    }
    const owner = await guestHash();
    const order = owner ? ownedOrder(id, owner) : null;
    if (!order) throw new RuleError('Order not found.', 'not_found', 404);
    const intent = await cardIntentFor(order);
    return NextResponse.json({ clientSecret: intent.clientSecret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}
