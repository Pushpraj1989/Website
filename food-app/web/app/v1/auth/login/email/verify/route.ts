import { NextRequest, NextResponse } from 'next/server';
import { accountForToken, checkChallenge, createSession } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Sign-in by email, step 2: the code from the email. Returns a session token for the device.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const challenge = await checkChallenge(body.challengeId as string, 'login_email', body.code);
    if (!challenge.account_id) throw new RuleError('This code is no longer valid. Ask for a new one.', 'code_used', 410);
    const token = await createSession(challenge.account_id);
    return NextResponse.json({ token, account: await accountForToken(token) });
  } catch (error) {
    return errorResponse(error);
  }
}
