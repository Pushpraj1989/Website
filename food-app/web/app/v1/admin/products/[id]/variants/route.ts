import { NextRequest, NextResponse } from 'next/server';
import { saveVariants } from '@/lib/catalog.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// A product's variants (retail mode): the whole list is sent and saved in one go, in the order given.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = (await readJson(request)) as { variants?: unknown };
    return NextResponse.json({ variants: await saveVariants(id, body.variants) });
  } catch (error) {
    return errorResponse(error);
  }
}
