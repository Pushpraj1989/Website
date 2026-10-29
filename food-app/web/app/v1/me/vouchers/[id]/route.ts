import { NextRequest, NextResponse } from 'next/server';
import { accountForToken } from '@/lib/accounts.ts';
import { bearerToken, errorResponse } from '@/lib/http.ts';
import { removeVoucher } from '@/lib/wallet.ts';
import { RuleError } from '@/lib/orders.ts';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await accountForToken(bearerToken(request));
    if (!account) throw new RuleError('Sign in first.', 'unauthorised', 401);
    return NextResponse.json(await removeVoucher(account.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
