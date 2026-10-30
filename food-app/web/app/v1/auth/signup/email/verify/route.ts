import { NextRequest, NextResponse } from 'next/server';
import { checkChallenge, createAccountWithEmail, createSession } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Sign-up by email, step 2: the code from the email. Creates the account (email verified) and signs the device in.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const challenge = await checkChallenge(body.challengeId as string, 'signup_email', body.code);
    if (!challenge.name || !challenge.phone) throw new RuleError('This code is no longer valid. Ask for a new one.', 'code_used', 410);
    const account = await createAccountWithEmail(challenge.name, challenge.phone, challenge.target);
    const token = await createSession(account.id);
    return NextResponse.json({ token, account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
