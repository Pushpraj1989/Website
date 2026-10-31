import { NextRequest, NextResponse } from 'next/server';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { registerPasskey } from '@/lib/passkeys.ts';
import { requestOrigin } from '@/lib/passkey-route.ts';

// Adding Face ID (a passkey), step 2: what the device made, checked and kept.
export async function POST(request: NextRequest) {
  try {
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first, then turn on Face ID.', 'unauthorised', 401);
    const body = await readJson(request);
    return NextResponse.json(await registerPasskey(account, body.challengeId, body.response, requestOrigin(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
