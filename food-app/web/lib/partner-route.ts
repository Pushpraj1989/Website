// The route side of a partner call: reads the key from the request and turns the result into a response.
import { NextRequest, NextResponse } from 'next/server';
import { bearerToken } from './http.ts';
import { runPartnerCall, type PartnerClient } from './partners.ts';

export async function partnerRoute(request: NextRequest, run: (client: PartnerClient) => Promise<{ status: number; body: unknown; replayed?: boolean }>) {
  const result = await runPartnerCall(request.method, request.url, bearerToken(request), run);
  const response = NextResponse.json(result.body, { status: result.status });
  if (result.replayed) response.headers.set('Idempotent-Replayed', 'true');
  return response;
}
