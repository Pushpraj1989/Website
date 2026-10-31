import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, readJson } from '@/lib/http.ts';
import { loginWithPasskey } from '@/lib/passkeys.ts';
import { requestOrigin } from '@/lib/passkey-route.ts';

// Signing in with Face ID (a passkey), step 2: the signed challenge. Returns a session token, as the email code does.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    return NextResponse.json(await loginWithPasskey(body.challengeId, body.response, requestOrigin(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
