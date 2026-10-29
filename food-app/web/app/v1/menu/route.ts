import { NextResponse } from 'next/server';
import { CATEGORIES, ITEMS, RESTAURANT } from '@/lib/seed.ts';
import { stripeConfigured } from '@/lib/payments/stripe.ts';

// Public. Both languages in one payload, so the app switches language without a round trip.
export async function GET() {
  const categories = CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    items: ITEMS.filter((item) => item.categoryId === category.id).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceMinor: item.priceMinor,
      currency: RESTAURANT.pricing.currency,
      soldOut: item.soldOut,
    })),
  }));
  const payments = {
    cod: RESTAURANT.payments.cod,
    payOnArrival: RESTAURANT.payments.payOnArrival,
    card: RESTAURANT.payments.card && stripeConfigured(),
  };
  return NextResponse.json({ restaurant: RESTAURANT.name, categories, payments });
}
