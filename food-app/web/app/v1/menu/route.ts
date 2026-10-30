import { NextResponse } from 'next/server';
import * as data from '@/lib/data.ts';
import { errorResponse } from '@/lib/http.ts';
import { stripeConfigured } from '@/lib/payments/stripe.ts';
import { publicBrand } from '@/lib/restaurant-settings.ts';

// Public. Both languages in one payload, so the app switches language without a round trip.
export async function GET() {
  try {
    const [restaurant, categories, offers, brand] = await Promise.all([data.getRestaurant(), data.getMenu(), data.activeOffers(), publicBrand()]);
    return NextResponse.json({
      restaurant: restaurant.name,
      brand,
      currency: restaurant.currency,
      categories,
      offers,
      payments: {
        cod: restaurant.payments.cod,
        payOnArrival: restaurant.payments.payOnArrival,
        card: restaurant.payments.card && stripeConfigured(),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
