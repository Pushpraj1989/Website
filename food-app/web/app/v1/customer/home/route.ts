import { NextResponse } from 'next/server';
import { homeFor } from '@/lib/customer.ts';
import { currentGuestId, errorResponse } from '@/lib/http.ts';

// The home screen's personal shortcuts: the last order, the dishes this customer orders most, and favourites.
export async function GET() {
  try {
    const guestId = await currentGuestId();
    if (!guestId) return NextResponse.json({ lastOrder: null, frequent: [], favourites: [] });
    return NextResponse.json(await homeFor(guestId));
  } catch (error) {
    return errorResponse(error);
  }
}
