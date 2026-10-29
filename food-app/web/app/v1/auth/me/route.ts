import { NextRequest, NextResponse } from 'next/server';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET(request: NextRequest) {
  try {
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first.', 'unauthorised', 401);
    return NextResponse.json({ account });
  } catch (error) {
    return errorResponse(error);
  }
}
