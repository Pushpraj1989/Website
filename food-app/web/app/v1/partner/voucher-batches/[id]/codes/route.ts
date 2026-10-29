import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { batchCodes } from '@/lib/partners.ts';

// The codes made so far for a batch, 500 at a time. Follow nextAfter to get the rest.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = request.nextUrl.searchParams.get('after');
  return partnerRoute(request, async (client) => ({ status: 200, body: await batchCodes(client, id, after) }));
}
