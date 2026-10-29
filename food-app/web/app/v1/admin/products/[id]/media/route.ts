import { NextRequest, NextResponse } from 'next/server';
import { addProductMedia, arrangeGallery, productGallery, MAX_VIDEO_BYTES } from '@/lib/gallery.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ media: await productGallery(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

// Adds one picture or video. The file's signature decides what it is; the size limits differ by kind.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_VIDEO_BYTES + 256 * 1024) throw new RuleError('The upload is too large.', 'too_large', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new RuleError('Choose a picture or a video.', 'bad_input', 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const item = await addProductMedia(id, bytes, String(form.get('altEn') ?? '').slice(0, 200), String(form.get('altAr') ?? '').slice(0, 200), null);
    return NextResponse.json({ media: item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

// Sets the order and the cover: { order: [mediaId, ...], primary: mediaId }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    return NextResponse.json({ media: await arrangeGallery(id, body.order, body.primary) });
  } catch (error) {
    return errorResponse(error);
  }
}
