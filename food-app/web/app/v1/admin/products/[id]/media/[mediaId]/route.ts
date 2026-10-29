import { NextRequest, NextResponse } from 'next/server';
import { removeProductMedia } from '@/lib/gallery.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const { id, mediaId } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    await removeProductMedia(id, mediaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
