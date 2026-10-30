import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { rateOrder } from '@/lib/ratings.ts';

// Owner only: { stars: 1-5, comment? }. Allowed once the order was delivered or collected; a second rating replaces the first.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Order not found.', 'not_found', 404);
    return NextResponse.json({ rating: await rateOrder(id, guestId, await readJson(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
