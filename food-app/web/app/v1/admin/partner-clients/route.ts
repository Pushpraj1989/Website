import { NextRequest, NextResponse } from 'next/server';
import { createPartnerClient, listPartnerClients } from '@/lib/partners.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ partners: await listPartnerClients() });
  } catch (error) {
    return errorResponse(error);
  }
}

// Creates a partner. The key is shown in this answer only; it cannot be read again.
export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json(await createPartnerClient(await readJson(request)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
