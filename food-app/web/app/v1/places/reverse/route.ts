import { NextRequest, NextResponse } from 'next/server';
import { currentLocale, errorResponse } from '@/lib/http.ts';
import { reversePlace } from '@/lib/places.ts';

export async function GET(request: NextRequest) {
  try {
    const lat = Number(request.nextUrl.searchParams.get('lat'));
    const lng = Number(request.nextUrl.searchParams.get('lng'));
    const place = await reversePlace(lat, lng, await currentLocale());
    return NextResponse.json({ place });
  } catch (error) {
    return errorResponse(error);
  }
}
