import { NextRequest, NextResponse } from 'next/server';
import { runBatch } from '@/lib/campaigns.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Moves a queued or running batch forward a few chunks. The admin calls it until the batch is completed.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ batch: await runBatch(id, 4) });
  } catch (error) {
    return errorResponse(error);
  }
}
