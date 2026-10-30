import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { errorResponse, readJson, staffSessionValue, STAFF_COOKIE } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { assertCanTry, recordFailure, sourceOf } from '@/lib/staff-login.ts';

// Staff sign-in. The slice uses one shared password from the environment. Real staff accounts with two-factor
// sign-in come with the Supabase layer (A01).
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.ADMIN_PASSWORD ?? '';
    if (!expected || expected.length < 12) {
      return NextResponse.json({ error: { code: 'not_configured', message: 'Staff sign-in is not configured.' } }, { status: 503 });
    }
    const source = sourceOf(request.headers);
    await assertCanTry(source);
    const body = await readJson(request);
    const given = Buffer.from(typeof body.password === 'string' ? body.password : '');
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      await recordFailure(source);
      throw new RuleError('That password is not right.', 'bad_credentials', 401);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(STAFF_COOKIE, staffSessionValue(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
