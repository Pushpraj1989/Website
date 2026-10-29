import { NextResponse } from 'next/server';
import { livePromotions } from '@/lib/gallery.ts';
import { errorResponse } from '@/lib/http.ts';

// Public. The live hero and mid-feed promotions for the customer home.
export async function GET() {
  try {
    return NextResponse.json(await livePromotions());
  } catch (error) {
    return errorResponse(error);
  }
}
