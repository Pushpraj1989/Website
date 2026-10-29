import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { batchStatus } from '@/lib/partners.ts';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return partnerRoute(request, async (client) => ({ status: 200, body: await batchStatus(client, id) }));
}
