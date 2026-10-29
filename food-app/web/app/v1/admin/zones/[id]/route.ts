import { NextRequest, NextResponse } from 'next/server';
import { updateZone, validateZone } from '@/lib/zones.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new RuleError('Area not found.', 'not_found', 404);
    await updateZone(id, validateZone(await readJson(request)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
