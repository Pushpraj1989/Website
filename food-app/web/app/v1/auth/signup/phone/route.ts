import { NextRequest, NextResponse } from 'next/server';
import { accountByPhone, normaliseName, normalisePhone, startChallenge } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Step 1 of sign-up: the name and the mobile number. Sends a code by SMS.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const name = normaliseName(body.name);
    const phone = normalisePhone(body.phone);
    if (await accountByPhone(phone)) {
      throw new RuleError('This number already has an account. Sign in instead.', 'phone_registered', 409);
    }
    return NextResponse.json(await startChallenge({ purpose: 'signup_phone', target: phone, name }));
  } catch (error) {
    return errorResponse(error);
  }
}
