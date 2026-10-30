import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/restaurant-settings.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The restaurant's own settings: name, tagline, logo, colour, contact, payments, cash limit and service fee.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ settings: await getSettings() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ settings: await updateSettings(await readJson(request), 'staff') });
  } catch (error) {
    return errorResponse(error);
  }
}
