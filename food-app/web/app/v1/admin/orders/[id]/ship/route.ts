import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import * as data from '@/lib/data.ts';
import { markShipped } from '@/lib/shipping.ts';

// Hands a courier order to the courier: its carrier, tracking number and optional tracking link. The order moves to
// 'shipped' and the customer sees the tracking on their order.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new RuleError('Order not found.', 'not_found', 404);
    await markShipped(id, await readJson(request), 'staff');
    return NextResponse.json({ order: await data.getOrder(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
