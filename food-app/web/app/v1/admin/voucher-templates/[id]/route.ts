import { NextRequest, NextResponse } from 'next/server';
import { getTemplate, updateDraft } from '@/lib/templates.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json(await getTemplate(id));
  } catch (error) {
    return errorResponse(error);
  }
}

// Saves the draft. Published versions are never changed by this.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ template: await updateDraft(id, await readJson(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
