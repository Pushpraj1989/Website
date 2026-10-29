import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storageDir } from '@/lib/catalog.ts';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Serves uploaded product images. Only names the server created can be read: a UUID and an image extension.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const match = /^([0-9a-f-]{36})\.(jpg|png|webp)$/.exec(key);
  const file = match ? join(storageDir(), key) : null;
  if (!file || !existsSync(file)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(readFileSync(file), {
    headers: { 'Content-Type': TYPES[match![2]], 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
