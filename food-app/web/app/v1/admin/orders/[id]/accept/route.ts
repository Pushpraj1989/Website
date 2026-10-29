import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { acceptOrder, RuleError } from '@/lib/orders.ts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    const order = await acceptOrder(id, Number(body.etaMinutes));
    return NextResponse.json({ status: order.status, etaMinutes: order.etaMinutes });
  } catch (error) {
    return errorResponse(error);
  }
}
