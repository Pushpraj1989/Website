import { NextRequest, NextResponse } from 'next/server';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { listRates, saveRates } from '@/lib/shipping.ts';

// The courier shipping options, for staff: all of them, and the whole list saved in one go.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ rates: await listRates(true) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = (await readJson(request)) as { rates?: unknown };
    return NextResponse.json({ rates: await saveRates(body.rates, 'staff') });
  } catch (error) {
    return errorResponse(error);
  }
}
