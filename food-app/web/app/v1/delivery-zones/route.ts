import { NextResponse } from 'next/server';
import { listActiveZones } from '@/lib/data.ts';
import { errorResponse } from '@/lib/http.ts';

// The delivery areas the restaurant serves, with the fee and minimum order for each. Drawn in the admin.
export async function GET() {
  try {
    return NextResponse.json({ zones: await listActiveZones() });
  } catch (error) {
    return errorResponse(error);
  }
}
