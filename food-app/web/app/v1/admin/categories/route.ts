import { NextRequest, NextResponse } from 'next/server';
import { createCategory } from '@/lib/catalog.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ category: await createCategory(await readJson(request)) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
