import { NextRequest, NextResponse } from 'next/server';
import { accountByPhone, normalisePhone, startChallenge } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Sign-in step 1: the mobile number. Sends a code by SMS to a number that has an account.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const phone = normalisePhone(body.phone);
    const account = await accountByPhone(phone);
    if (!account) throw new RuleError('No account uses this number. Create one first.', 'no_account', 404);
    return NextResponse.json(await startChallenge({ purpose: 'login_phone', target: phone, accountId: account.id }));
  } catch (error) {
    return errorResponse(error);
  }
}
