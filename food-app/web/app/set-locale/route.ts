import { NextRequest, NextResponse } from 'next/server';

// Sets the language cookie, then sends the user back to a same-site path. POST only: a GET must not change
// state, because links are prefetched. The redirect is a bare path: behind a proxy the server's own address
// (127.0.0.1:3100) is not the one the browser used, so building a full URL here sent customers to localhost.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const lang = form.get('lang') === 'ar' ? 'ar' : 'en';
  const next = String(form.get('next') ?? '/menu');
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/menu';
  const response = new NextResponse(null, { status: 303, headers: { Location: safe } });
  response.cookies.set('locale', lang, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60 });
  return response;
}
