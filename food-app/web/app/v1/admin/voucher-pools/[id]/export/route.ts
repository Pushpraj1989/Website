import { NextRequest, NextResponse } from 'next/server';
import { exportCsv } from '@/lib/print.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The codes as CSV. These are redeemable codes: the export is staff-only and recorded.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const batch = request.nextUrl.searchParams.get('batch');
    const { csv, count } = await exportCsv(id, batch, 'staff');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="voucher-codes-${count}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
