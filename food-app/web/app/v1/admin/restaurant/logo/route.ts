import { NextRequest, NextResponse } from 'next/server';
import { MAX_LOGO_BYTES, removeLogo, setLogo } from '@/lib/restaurant-settings.ts';
import { isStaff, errorResponse } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// Uploads the logo. The file's signature decides whether it is a picture; the name and declared type are ignored.
export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    if (Number(request.headers.get('content-length') ?? 0) > MAX_LOGO_BYTES + 64 * 1024) throw new RuleError('The logo is larger than 1 MB. Use a smaller file.', 'too_large', 413);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new RuleError('Choose a picture for the logo.', 'bad_input', 400);
    return NextResponse.json({ settings: await setLogo(Buffer.from(await file.arrayBuffer()), 'staff') }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ settings: await removeLogo('staff') });
  } catch (error) {
    return errorResponse(error);
  }
}
