import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, ensureGuest, withGuestCookie, errorResponse, readJson } from '@/lib/http.ts';
import { listAddresses, saveAddress } from '@/lib/orders.ts';

// The customer's saved delivery addresses. A guest session owns them until the customer signs in.
export async function GET() {
  try {
    const guestId = await currentGuestId();
    return NextResponse.json({ addresses: guestId ? await listAddresses(guestId) : [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guest = await ensureGuest(await currentGuestId());
    const address = await saveAddress(guest.id, body);
    return withGuestCookie(NextResponse.json({ address }, { status: 201 }), guest.newToken);
  } catch (error) {
    return errorResponse(error);
  }
}
