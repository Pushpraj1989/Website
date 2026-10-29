import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError, setOrderStatus } from '@/lib/orders.ts';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/status.ts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    const to = body.to as OrderStatus;
    if (!ORDER_STATUSES.includes(to)) throw new RuleError('Unknown status.', 'bad_input', 400);
    const order = setOrderStatus(id, to);
    return NextResponse.json({ status: order.status });
  } catch (error) {
    return errorResponse(error);
  }
}
