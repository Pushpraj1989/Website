import { NextRequest, NextResponse } from 'next/server';
import { previewTemplate } from '@/lib/templates.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The draft by default, or the published version with ?which=current. Placeholders show sample values only.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const which = request.nextUrl.searchParams.get('which') === 'current' ? 'current' : 'draft';
    return NextResponse.json(await previewTemplate(id, which));
  } catch (error) {
    return errorResponse(error);
  }
}
