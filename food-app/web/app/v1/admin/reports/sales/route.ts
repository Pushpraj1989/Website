import { NextRequest, NextResponse } from 'next/server';
import { salesReport } from '@/lib/sales.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The sales dashboard for ?from=YYYY-MM-DD&to=YYYY-MM-DD, compared with the period before and the year before.
export async function GET(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const query = request.nextUrl.searchParams;
    return NextResponse.json(await salesReport({ from: query.get('from'), to: query.get('to') }));
  } catch (error) {
    return errorResponse(error);
  }
}
