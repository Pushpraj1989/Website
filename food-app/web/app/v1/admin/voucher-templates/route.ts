import { NextRequest, NextResponse } from 'next/server';
import { createTemplate, listTemplates } from '@/lib/templates.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ templates: await listTemplates() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ template: await createTemplate(await readJson(request)) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
