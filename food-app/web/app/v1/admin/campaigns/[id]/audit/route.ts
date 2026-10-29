import { NextRequest, NextResponse } from 'next/server';
import { auditTrail } from '@/lib/operations.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ entries: await auditTrail('campaign', id) });
  } catch (error) {
    return errorResponse(error);
  }
}
