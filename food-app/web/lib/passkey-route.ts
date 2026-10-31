import type { NextRequest } from 'next/server';

/** The address the browser used, for passkeys when PUBLIC_URL is not set (development and tests). */
export function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  const host = request.headers.get('host') ?? request.nextUrl.host;
  return `${proto}://${host}`;
}
