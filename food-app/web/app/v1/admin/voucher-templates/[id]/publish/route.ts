import { NextRequest, NextResponse } from 'next/server';
import { publishTemplate } from '@/lib/templates.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ template: await publishTemplate(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
