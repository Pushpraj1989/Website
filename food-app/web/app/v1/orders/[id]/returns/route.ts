import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { requestReturn } from '@/lib/returns.ts';

// A customer asks to return items from their own delivered order (shops, within the return window).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Order not found.', 'not_found', 404);
    return NextResponse.json({ return: await requestReturn(guestId, id, await readJson(request)) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
