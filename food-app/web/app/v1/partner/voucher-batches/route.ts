import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { requestBatch } from '@/lib/partners.ts';
import { readJson } from '@/lib/http.ts';

// Requests a bulk batch of up to 10,000 codes. Larger batches are finished by polling the batch's status.
export async function POST(request: NextRequest) {
  const body = await readJson(request).catch(() => ({}));
  const key = request.headers.get('idempotency-key');
  return partnerRoute(request, (client) => requestBatch(client, body, key));
}
