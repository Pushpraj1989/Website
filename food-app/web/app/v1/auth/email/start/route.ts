import { NextRequest, NextResponse } from 'next/server';
import { accountForToken, normaliseEmail, startChallenge } from '@/lib/accounts.ts';
import { bearerToken, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { pool } from '@/lib/db.ts';

// Verify email, step 1: the email address the user typed. Sends a code to that address.
export async function POST(request: NextRequest) {
  try {
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first.', 'unauthorised', 401);
    const body = await readJson(request);
    const email = normaliseEmail(body.email);
    const taken = await pool.query('select 1 from accounts where email = $1 and id <> $2', [email, account.id]);
    if (taken.rows[0]) throw new RuleError('That email is already used by another account.', 'email_taken', 409);
    return NextResponse.json(await startChallenge({ purpose: 'verify_email', target: email, accountId: account.id }));
  } catch (error) {
    return errorResponse(error);
  }
}
