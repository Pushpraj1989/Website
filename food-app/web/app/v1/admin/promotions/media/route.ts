import { NextRequest, NextResponse } from 'next/server';
import { addPromotionMedia, MAX_VIDEO_BYTES } from '@/lib/gallery.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// A picture, GIF or video for a promotion. The file's signature decides what it is; the size limits differ by kind.
export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (contentLength > MAX_VIDEO_BYTES + 256 * 1024) throw new RuleError('The upload is too large.', 'too_large', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new RuleError('Choose a picture, GIF or video.', 'bad_input', 400);
    return NextResponse.json({ media: await addPromotionMedia(Buffer.from(await file.arrayBuffer()), null) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
