import { NextResponse } from 'next/server';
import { listPlans } from '@/lib/membership.ts';
import { currentGuestId, errorResponse } from '@/lib/http.ts';

// The plans and benefits to show in the membership screen, and this customer's membership if they have one.
export async function GET() {
  try {
    return NextResponse.json(await listPlans(await currentGuestId()));
  } catch (error) {
    return errorResponse(error);
  }
}
