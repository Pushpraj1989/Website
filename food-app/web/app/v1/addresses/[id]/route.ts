import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { removeAddress, RuleError, updateAddress } from '@/lib/orders.ts';

async function guestOrThrow(): Promise<string> {
  const guestId = await currentGuestId();
  if (!guestId) throw new RuleError('Address not found.', 'not_found', 404);
  return guestId;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const address = await updateAddress(await guestOrThrow(), id, await readJson(request));
    return NextResponse.json({ address });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await removeAddress(await guestOrThrow(), id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
