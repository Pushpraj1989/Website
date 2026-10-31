import { NextRequest, NextResponse } from 'next/server';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { registrationOptions } from '@/lib/passkeys.ts';
import { requestOrigin } from '@/lib/passkey-route.ts';

// Adding Face ID (a passkey), step 1. Signed-in customers only: a passkey is added to an account that already exists.
export async function POST(request: NextRequest) {
  try {
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first, then turn on Face ID.', 'unauthorised', 401);
    return NextResponse.json(await registrationOptions(account, requestOrigin(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
