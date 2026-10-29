import { NextRequest, NextResponse } from 'next/server';
import { createOffer } from '@/lib/catalog.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ offer: await createOffer(await readJson(request)) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
