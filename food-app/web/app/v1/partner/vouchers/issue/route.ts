import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { issueVouchers } from '@/lib/partners.ts';
import { readJson } from '@/lib/http.ts';

// Issues one to a hundred vouchers from an approved campaign. The codes are in the answer, once. Needs an Idempotency-Key.
export async function POST(request: NextRequest) {
  const body = await readJson(request).catch(() => ({}));
  const key = request.headers.get('idempotency-key');
  return partnerRoute(request, (client) => issueVouchers(client, body, key));
}
