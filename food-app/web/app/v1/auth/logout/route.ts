import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/accounts.ts';
import { bearerToken, errorResponse } from '@/lib/http.ts';

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (token) await revokeSession(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
