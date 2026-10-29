import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { validateCode } from '@/lib/partners.ts';
import { readJson } from '@/lib/http.ts';

// Checks a code without using it.
export async function POST(request: NextRequest) {
  const body: Record<string, unknown> = await readJson(request).catch(() => ({}));
  return partnerRoute(request, async (client) => ({ status: 200, body: await validateCode(client, body.code) }));
}
