import { NextRequest, NextResponse } from 'next/server';
import { reorder } from '@/lib/customer.ts';
import { currentGuestId, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Puts a past order's dishes back in the cart. The reply lists what was added and what was left out.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Order not found.', 'not_found', 404);
    return NextResponse.json(await reorder(guestId, id));
  } catch (error) {
    return errorResponse(error);
  }
}
