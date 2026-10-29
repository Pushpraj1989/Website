import { NextRequest, NextResponse } from 'next/server';
import { revokeVoucher } from '@/lib/operations.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Revokes a voucher that has not been used. The reason is required and kept with the history.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    return NextResponse.json(await revokeVoucher(id, 'staff', body.reason));
  } catch (error) {
    return errorResponse(error);
  }
}
