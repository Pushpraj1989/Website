import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { markRefunded } from '@/lib/returns.ts';

// Staff confirm an approved return was paid back by cash or transfer.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ return: await markRefunded(id, 'staff') });
  } catch (error) {
    return errorResponse(error);
  }
}
