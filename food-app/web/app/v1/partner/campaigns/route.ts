import { NextRequest } from 'next/server';
import { partnerRoute } from '@/lib/partner-route.ts';
import { campaignsFor } from '@/lib/partners.ts';

// The campaigns this partner may issue from, with their rules.
export async function GET(request: NextRequest) {
  return partnerRoute(request, async (client) => ({ status: 200, body: { campaigns: await campaignsFor(client) } }));
}
