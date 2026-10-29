import { NextRequest, NextResponse } from 'next/server';
import { createBatch } from '@/lib/campaigns.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const key = request.headers.get('idempotency-key') ?? '';
    return NextResponse.json({ batch: await createBatch(id, await readJson(request), key) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
