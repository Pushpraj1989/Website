import { NextRequest, NextResponse } from 'next/server';

// Sets the language cookie, then sends the user back to a same-site path. POST only: a GET must not change
// state, because links are prefetched.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const lang = form.get('lang') === 'ar' ? 'ar' : 'en';
  const next = String(form.get('next') ?? '/menu');
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/menu';
  const response = NextResponse.redirect(new URL(safe, request.url), 303);
  response.cookies.set('locale', lang, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 });
  return response;
}
