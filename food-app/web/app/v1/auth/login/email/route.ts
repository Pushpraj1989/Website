import { NextRequest, NextResponse } from 'next/server';
import { accountByEmail, normaliseEmail, startChallenge } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Sign-in by email, step 1: sends a code to an email that has an account.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const email = normaliseEmail(body.email);
    const account = await accountByEmail(email);
    if (!account) throw new RuleError('No account uses this email. Create one first.', 'no_account', 404);
    return NextResponse.json(await startChallenge({ purpose: 'login_email', target: email, accountId: account.id }));
  } catch (error) {
    return errorResponse(error);
  }
}
