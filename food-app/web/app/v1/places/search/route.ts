import { NextRequest, NextResponse } from 'next/server';
import { currentLocale, errorResponse } from '@/lib/http.ts';
import { searchPlaces } from '@/lib/places.ts';

export async function GET(request: NextRequest) {
  try {
    const places = await searchPlaces(request.nextUrl.searchParams.get('q') ?? '', await currentLocale());
    return NextResponse.json({ places });
  } catch (error) {
    return errorResponse(error);
  }
}
