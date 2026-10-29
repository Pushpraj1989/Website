import { NextRequest, NextResponse } from 'next/server';
import { accountForToken, checkChallenge, setVerifiedEmail } from '@/lib/accounts.ts';
import { bearerToken, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Verify email, step 2: the code from the email. Marks the address as verified on this account.
export async function POST(request: NextRequest) {
  try {
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first.', 'unauthorised', 401);
    const body = await readJson(request);
    const challenge = await checkChallenge(body.challengeId as string, 'verify_email', body.code);
    if (challenge.account_id !== account.id) throw new RuleError('This code is for another account.', 'forbidden', 403);
    return NextResponse.json({ account: await setVerifiedEmail(account.id, challenge.target) });
  } catch (error) {
    return errorResponse(error);
  }
}
