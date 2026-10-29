import { NextRequest, NextResponse } from 'next/server';
import { modelsFor } from '@/lib/ai/assistant.ts';
import { isStaff, errorResponse, readJson } from '@/lib/http.ts';
import { RuleError } from '@/lib/orders.ts';

// POST, not GET: a typed key must not appear in a URL, a log or browser history.
export async function POST(request: NextRequest) {
  try {
    if (!(await isStaff())) throw new RuleError('Sign in as staff.', 'unauthorised', 401);
    const body = await readJson(request);
    return NextResponse.json({ models: await modelsFor(body.provider, body.apiKey) });
  } catch (error) {
    return errorResponse(error);
  }
}
