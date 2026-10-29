import { NextRequest, NextResponse } from 'next/server';
import { transitionCampaign } from '@/lib/campaigns.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    return NextResponse.json(await transitionCampaign(id, String(body.action ?? '')));
  } catch (error) {
    return errorResponse(error);
  }
}
