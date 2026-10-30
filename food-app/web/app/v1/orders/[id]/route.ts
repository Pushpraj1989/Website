import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, errorResponse } from '@/lib/http.ts';
import { customerView, ownedOrder, RuleError } from '@/lib/orders.ts';
import { ratingOf } from '@/lib/ratings.ts';

// Owner only. A guest sees only the order placed from their own browser.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guestId = await currentGuestId();
    const order = guestId ? await ownedOrder(id, guestId) : null;
    if (!order) throw new RuleError('Order not found.', 'not_found', 404);
    return NextResponse.json({ order: { ...customerView(order), rating: await ratingOf(order.id) } });
  } catch (error) {
    return errorResponse(error);
  }
}
