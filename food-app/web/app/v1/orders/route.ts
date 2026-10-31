import { NextRequest, NextResponse } from 'next/server';
import { currentGuestId, currentLocale, errorResponse, readJson } from '@/lib/http.ts';
import { customerView, placeOrder, RuleError } from '@/lib/orders.ts';
import { ordersFor, savingsFor } from '@/lib/customer.ts';
import { stripeConfigured } from '@/lib/payments/stripe.ts';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken } from '@/lib/http.ts';

export async function GET() {
  try {
    const guestId = await currentGuestId();
    if (!guestId) return NextResponse.json({ orders: [], savedMinor: 0 });
    const [orders, savings] = await Promise.all([ordersFor(guestId), savingsFor(guestId)]);
    return NextResponse.json({ orders, savedMinor: savings.savedMinor });
  } catch (error) {
    return errorResponse(error);
  }
}

const METHODS = ['card', 'cod', 'pay_on_arrival'] as const;
type Method = (typeof METHODS)[number];

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Your cart is empty.', 'empty_cart');
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    if (idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new RuleError('The order needs an idempotency key of 8 to 100 characters.', 'bad_input', 400);
    }
    const method = body.method as Method;
    if (!METHODS.includes(method)) throw new RuleError('Choose a payment method.', 'bad_input', 400);
    if (method === 'card' && !stripeConfigured()) {
      throw new RuleError('Card payment is not available yet.', 'method_unavailable');
    }
    const accountId = (await accountForToken(bearerToken(request)))?.id ?? null;
    const order = await placeOrder({
      guestId,
      accountId,
      idempotencyKey,
      channel: body.channel === 'pickup' ? 'pickup' : body.channel === 'shipping' ? 'shipping' : 'delivery',
      shippingRateId: typeof body.shippingRateId === 'string' ? body.shippingRateId : null,
      method,
      addressId: typeof body.addressId === 'string' ? body.addressId : null,
      locale: await currentLocale(),
    });
    return NextResponse.json({ order: customerView(order) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
