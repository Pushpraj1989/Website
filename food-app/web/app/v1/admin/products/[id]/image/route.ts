import { NextRequest, NextResponse } from 'next/server';
import { removeProductImage, setProductImage, MAX_IMAGE_BYTES } from '@/lib/catalog.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Replaces a product's picture. The file is checked by its first bytes; the name and declared type are ignored.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_IMAGE_BYTES + 64 * 1024) throw new RuleError('The image is larger than 3 MB.', 'too_large', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new RuleError('Choose an image to upload.', 'bad_input', 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const alt = String(form.get('altEn') ?? '').slice(0, 200);
    const altAr = String(form.get('altAr') ?? '').slice(0, 200);
    const url = await setProductImage(id, bytes, alt, altAr, null);
    return NextResponse.json({ imageUrl: url }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    await removeProductImage(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
