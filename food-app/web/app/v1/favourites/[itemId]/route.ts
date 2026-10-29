import { NextRequest, NextResponse } from 'next/server';
import { setFavourite } from '@/lib/customer.ts';
import { currentGuestId, ensureGuest, errorResponse, withGuestCookie } from '@/lib/http.ts';

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const guest = await ensureGuest(await currentGuestId());
    await setFavourite(guest.id, itemId, true);
    return withGuestCookie(new NextResponse(null, { status: 204 }), guest.newToken);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const guestId = await currentGuestId();
    if (guestId) await setFavourite(guestId, itemId, false);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
