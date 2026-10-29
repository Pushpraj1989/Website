import { NextRequest, NextResponse } from 'next/server';
import { rotatePartnerKey } from '@/lib/partners.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// A new key for the partner. The old one stops working at once.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json(await rotatePartnerKey(id));
  } catch (error) {
    return errorResponse(error);
  }
}
