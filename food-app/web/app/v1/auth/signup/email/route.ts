import { NextRequest, NextResponse } from 'next/server';
import { accountByEmail, accountByPhone, normaliseEmail, normaliseName, normalisePhone, startChallenge } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Sign-up by email, step 1: name, mobile number and email. Sends a code to the email.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const name = normaliseName(body.name);
    const phone = normalisePhone(body.phone);
    const email = normaliseEmail(body.email);
    if (await accountByEmail(email)) throw new RuleError('This email already has an account. Sign in instead.', 'email_registered', 409);
    if (await accountByPhone(phone)) throw new RuleError('This number already has an account. Sign in instead.', 'phone_registered', 409);
    return NextResponse.json(await startChallenge({ purpose: 'signup_email', target: email, name, phone }));
  } catch (error) {
    return errorResponse(error);
  }
}
