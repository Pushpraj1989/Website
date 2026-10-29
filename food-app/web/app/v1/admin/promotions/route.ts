import { NextRequest, NextResponse } from 'next/server';
import { createPromotion, listPromotions } from '@/lib/gallery.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ promotions: await listPromotions() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ id: await createPromotion(await readJson(request)) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
