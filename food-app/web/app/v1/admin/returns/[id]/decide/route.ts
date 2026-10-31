import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { decideReturn } from '@/lib/returns.ts';

// Approve (with the refund and whether to put the stock back) or reject (with a note for the customer).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ return: await decideReturn(id, await readJson(request), 'staff') });
  } catch (error) {
    return errorResponse(error);
  }
}
