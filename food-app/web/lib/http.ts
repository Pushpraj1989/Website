import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { RuleError, hashToken } from './orders.ts';
import * as data from './data.ts';

export const GUEST_COOKIE = 'guest';
export const STAFF_COOKIE = 'staff';

const cookieBase = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function guestCookieOptions(maxAgeDays: number) {
  return { ...cookieBase, maxAge: maxAgeDays * 24 * 60 * 60 };
}

/** The guest session for this browser, or null when it has none yet. The token itself is only stored hashed. */
export async function currentGuestId(): Promise<string | null> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return token ? data.findGuestSession(hashToken(token)) : null;
}

/** Returns the guest session id, creating one when needed. A new token is returned for the cookie. */
export async function ensureGuest(existingId: string | null): Promise<{ id: string; newToken: string | null }> {
  if (existingId) return { id: existingId, newToken: null };
  const token = randomBytes(24).toString('base64url');
  const id = await data.createGuestSession(hashToken(token));
  return { id, newToken: token };
}

export function withGuestCookie<T extends NextResponse>(response: T, newToken: string | null): T {
  if (newToken) response.cookies.set(GUEST_COOKIE, newToken, guestCookieOptions(30));
  return response;
}

export function staffSessionValue(): string {
  return createHmac('sha256', process.env.ADMIN_PASSWORD ?? '').update('staff-session-v1').digest('hex');
}

export async function isStaff(): Promise<boolean> {
  const value = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!value || !process.env.ADMIN_PASSWORD) return false;
  const expected = Buffer.from(staffSessionValue());
  const given = Buffer.from(value);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Mutating calls must be JSON. A cross-site form cannot send that content type without a preflight. */
export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    throw new RuleError('Send JSON.', 'bad_input', 415);
  }
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    throw new RuleError('The request body is not valid JSON.', 'bad_input', 400);
  }
}

export async function currentLocale(): Promise<'en' | 'ar'> {
  return (await cookies()).get('locale')?.value === 'ar' ? 'ar' : 'en';
}

export function errorResponse(error: unknown) {
  if (error instanceof RuleError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: 'internal', message: 'Something went wrong.' } }, { status: 500 });
}
