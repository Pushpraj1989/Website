import { NextRequest, NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { applyCartCode, cartAddressId, quoteFor, removeCartCode, RuleError } from '@/lib/orders.ts';

// Puts a voucher or an offer code on the cart. The server checks it against the cart now, and says why if it cannot.
export async function PUT(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Add something to your cart first.', 'empty_cart');
    const accountId = (await accountForToken(bearerToken(request)))?.id ?? null;
    const channel = body.channel === 'pickup' ? 'pickup' : 'delivery';
    const addressId = await cartAddressId(guestId, channel, typeof body.addressId === 'string' ? body.addressId : null);
    await applyCartCode(guestId, accountId, body.code, channel, addressId);
    const { quote, offer } = await quoteFor(guestId, channel, addressId, accountId);
    return NextResponse.json({ offer, quote, currency: (await data.getRestaurant()).currency });
  } catch (error) {
    return errorResponse(error);
  }
}

// Takes the code off the cart.
export async function DELETE(request: NextRequest) {
  try {
    const guestId = await currentGuestId();
    if (!guestId) return NextResponse.json({ offer: null });
    await removeCartCode(guestId);
    void request;
    return NextResponse.json({ offer: null });
  } catch (error) {
    return errorResponse(error);
  }
}
