import { NextRequest, NextResponse } from 'next/server';
import { ask } from '@/lib/ai/assistant.ts';
import { currentGuestId, currentLocale, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The customer's question. Only the customer's own browser or app (its guest session) identifies whose orders apply.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const guestId = await currentGuestId();
    if (!guestId) throw new RuleError('Open the menu first, then ask again.', 'no_session', 401);
    const locale = body.locale === 'ar' ? 'ar' : await currentLocale();
    return NextResponse.json(await ask({ guestId, message: body.message, locale, history: body.history }));
  } catch (error) {
    return errorResponse(error);
  }
}
