import { NextRequest, NextResponse } from 'next/server';
import { printPdf } from '@/lib/print.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// A PDF of the pool's usable vouchers, or one batch's, on A4, A5 or as single cards. Recorded in the print log.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const format = request.nextUrl.searchParams.get('format') ?? 'a4';
    const batch = request.nextUrl.searchParams.get('batch');
    const { pdf, count } = await printPdf(id, format, batch, 'staff');
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vouchers-${format}-${count}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
