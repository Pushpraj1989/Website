import { NextResponse } from 'next/server';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { adminReturns } from '@/lib/returns.ts';

// Return requests for staff: open ones first.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ returns: await adminReturns() });
  } catch (error) {
    return errorResponse(error);
  }
}
