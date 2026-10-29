import { NextRequest, NextResponse } from 'next/server';
import { accountByPhone, checkChallenge, createAccount, createSession } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Step 2 of sign-up: the code from the SMS. Creates the account and signs the phone in.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const challenge = await checkChallenge(body.challengeId as string, 'signup_phone', body.code);
    if (!challenge.name) throw new RuleError('This code is no longer valid. Ask for a new one.', 'code_used', 410);
    if (await accountByPhone(challenge.target)) {
      throw new RuleError('This number already has an account. Sign in instead.', 'phone_registered', 409);
    }
    const account = await createAccount(challenge.name, challenge.target);
    const token = await createSession(account.id);
    return NextResponse.json({ token, account }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
