import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http.ts';
import { loginOptions } from '@/lib/passkeys.ts';
import { requestOrigin } from '@/lib/passkey-route.ts';

// Signing in with Face ID (a passkey), step 1: a challenge for the device to sign.
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await loginOptions(requestOrigin(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
