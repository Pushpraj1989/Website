import { NextResponse } from 'next/server';
import { adminCatalog } from '@/lib/catalog.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Everything the admin console edits in one call: categories, products (including hidden ones) and offers.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json(await adminCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}
