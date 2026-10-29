import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { quoteFor, RuleError } from '@/lib/orders.ts';

// Server totals for the chosen channel. The app shows these; the order is priced again on placement.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Your cart is empty.', 'empty_cart');
    const channel = body.channel === 'pickup' ? 'pickup' : 'delivery';
    return NextResponse.json({ quote: await quoteFor(guestId, channel) });
  } catch (error) {
    return errorResponse(error);
  }
}
