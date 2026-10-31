import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { quoteFor, RuleError } from '@/lib/orders.ts';
import { accountForToken } from '@/lib/accounts.ts';

// Server totals for the chosen channel. The app shows these; the order is priced again on placement.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Your cart is empty.', 'empty_cart');
    const channel = body.channel === 'pickup' ? 'pickup' : body.channel === 'shipping' ? 'shipping' : 'delivery';
    const addressId = typeof body.addressId === 'string' ? body.addressId : null;
    const accountId = (await accountForToken(bearerToken(request)))?.id ?? null;
    const rateId = typeof body.shippingRateId === 'string' ? body.shippingRateId : null;
    return NextResponse.json(await quoteFor(guestId, channel, addressId, accountId, rateId));
  } catch (error) {
    return errorResponse(error);
  }
}
