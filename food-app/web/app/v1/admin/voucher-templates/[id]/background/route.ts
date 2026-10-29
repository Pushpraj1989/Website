import { NextRequest, NextResponse } from 'next/server';
import { setBackground } from '@/lib/templates.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';
import { MAX_IMAGE_BYTES } from '@/lib/gallery.ts';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_IMAGE_BYTES + 256 * 1024) throw new RuleError('The picture is larger than 3 MB.', 'too_large', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new RuleError('Choose a picture for the background.', 'bad_input', 400);
    return NextResponse.json({ template: await setBackground(id, Buffer.from(await file.arrayBuffer())) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
