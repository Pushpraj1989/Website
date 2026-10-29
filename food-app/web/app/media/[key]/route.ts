import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { storageDir } from '@/lib/catalog.ts';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

// Serves uploaded pictures and videos. Only names the server created can be read: a UUID and a known extension.
// Video is served in byte ranges, so a phone can start playing and seek without downloading the whole file.
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const match = /^([0-9a-f-]{36})\.(jpg|png|webp|mp4|mov|webm)$/.exec(key);
  const file = match ? join(storageDir(), key) : null;
  if (!file || !existsSync(file)) return new NextResponse('Not found', { status: 404 });
  const type = TYPES[match![2]];
  const size = statSync(file).size;
  const common = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=3600' };
  const range = request.headers.get('range');
  if (range && type.startsWith('video/')) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (m[1] === '' && m[2] === '')) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...common, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...common, 'Accept-Ranges': type.startsWith('video/') ? 'bytes' : 'none', 'Content-Length': String(size) } });
}
