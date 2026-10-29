import { NextRequest, NextResponse } from 'next/server';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, errorResponse, readJson } from '@/lib/http.ts';
import { saveVoucher, walletFor } from '@/lib/wallet.ts';
import { RuleError } from '@/lib/orders.ts';

async function signedIn(request: NextRequest) {
  const account = await accountForToken(bearerToken(request));
  if (!account) throw new RuleError('Sign in first.', 'unauthorised', 401);
  return account;
}

// The customer's wallet: available, used and expired vouchers.
export async function GET(request: NextRequest) {
  try {
    const account = await signedIn(request);
    return NextResponse.json(await walletFor(account.id));
  } catch (error) {
    return errorResponse(error);
  }
}

// Saves a voucher by its code. Saving does not use it.
export async function POST(request: NextRequest) {
  try {
    const account = await signedIn(request);
    const body = await readJson(request);
    return NextResponse.json({ voucher: await saveVoucher(account.id, body.code) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
