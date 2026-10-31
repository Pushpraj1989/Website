import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http.ts';
import { listRates } from '@/lib/shipping.ts';

// The courier shipping options customers can choose at checkout (retail mode). Empty when the business ships nothing.
export async function GET() {
  try {
    return NextResponse.json({ rates: await listRates() });
  } catch (error) {
    return errorResponse(error);
  }
}
