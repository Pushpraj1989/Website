import { NextRequest, NextResponse } from 'next/server';
import { guestHash, errorResponse, readJson } from '@/lib/http.ts';
import { quoteFor, RuleError } from '@/lib/orders.ts';

// Server totals for the chosen channel. The app shows these; the order is priced again on placement.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const owner = await guestHash();
    if (!owner) throw new RuleError('Your cart is empty.', 'empty_cart');
    const channel = body.channel === 'pickup' ? 'pickup' : 'delivery';
    return NextResponse.json({ quote: quoteFor(owner, channel) });
  } catch (error) {
    return errorResponse(error);
  }
}
