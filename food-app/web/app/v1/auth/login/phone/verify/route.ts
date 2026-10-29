import { NextRequest, NextResponse } from 'next/server';
import { accountForToken, checkChallenge, createSession } from '@/lib/accounts.ts';
import { errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { pool } from '@/lib/db.ts';

// Sign-in step 2: the code from the SMS. Returns a session token for the device.
export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const challenge = await checkChallenge(body.challengeId as string, 'login_phone', body.code);
    if (!challenge.account_id) throw new RuleError('This code is no longer valid. Ask for a new one.', 'code_used', 410);
    const { rows } = await pool.query('select id from accounts where id = $1', [challenge.account_id]);
    if (!rows[0]) throw new RuleError('No account uses this number.', 'no_account', 404);
    const token = await createSession(rows[0].id);
    return NextResponse.json({ token, account: await accountForToken(token) });
  } catch (error) {
    return errorResponse(error);
  }
}
