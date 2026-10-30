import { NextResponse } from 'next/server';
import { publicBrand } from '@/lib/restaurant-settings.ts';
import { errorResponse } from '@/lib/http.ts';

// Public. How the customer app and the admin sign-in page look for this restaurant: name, tagline, logo, colour, contact.
export async function GET() {
  try {
    return NextResponse.json({ brand: await publicBrand() });
  } catch (error) {
    return errorResponse(error);
  }
}
