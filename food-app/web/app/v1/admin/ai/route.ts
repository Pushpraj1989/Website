import { NextRequest, NextResponse } from 'next/server';
import { getAiSettings, saveAiSettings } from '@/lib/ai/assistant.ts';
import { PROVIDERS } from '@/lib/ai/providers.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// The assistant settings. The key is accepted here and never returned: the response carries only its last four characters.
export async function GET() {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ settings: await getAiSettings(), providers: PROVIDERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    return NextResponse.json({ settings: await saveAiSettings(await readJson(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
