import { NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The live board. Staff only. Shows what the kitchen needs, including the delivery address.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const orders = data.listOrders().map((o) => ({
      id: o.id,
      number: o.number,
      channel: o.channel,
      method: o.method,
      status: o.status,
      etaMinutes: o.etaMinutes,
      address: o.address,
      lines: o.lines,
      total: o.quote.totalMinor,
      currency: o.quote.currency,
      createdAt: o.createdAt,
    }));
    return NextResponse.json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}
