import { NextResponse } from 'next/server';
import { promotionsReport } from '@/lib/reports.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The promotion report: summary, campaigns, funding, issuance by day, partners, failed batches and reconciliation.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json(await promotionsReport());
  } catch (error) {
    return errorResponse(error);
  }
}
