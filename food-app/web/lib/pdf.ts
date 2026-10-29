// A small PDF writer for printed vouchers, with no dependency. It writes what vouchers need: pages in millimetres,
// filled rectangles (QR modules), text in Helvetica (WinAnsi, printable ASCII), and pictures: JPEG as stored, and
// 8-bit RGB or RGBA PNG decoded and stored with flate compression. Anything else is refused with a clear message.
import { deflateSync, inflateSync } from 'node:zlib';

export const MM = 72 / 25.4;

// Helvetica glyph widths (1/1000 em) for printable ASCII 32..126, from the standard font metrics.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

export function textWidth(text: string, sizePt: number, bold: boolean): number {
  let units = 0;
  for (const ch of text) units += HELVETICA[ch.charCodeAt(0) - 32] ?? 556;
  return (units / 1000) * sizePt * (bold ? 1.06 : 1);
}

/** Checks that text can be drawn with the standard font. Arabic and other scripts are not supported yet. */
export function assertPrintable(text: string, label: string) {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new PdfError(`${label} has a character the print cannot draw yet (only Latin letters, digits and common punctuation).`);
    }
  }
}

export class PdfError extends Error {
  code = 'pdf_unsupported';
  status = 422;
}

export type PdfImage = {
  kind: 'jpeg' | 'png';
  width: number;
  height: number;
  colors: 1 | 3;
  data: Buffer; // jpeg: the file; png: flate-compressed raw samples
  alpha?: Buffer; // png with transparency: flate-compressed grey mask
};

/** Reads a JPEG (baseline or progressive, 1 or 3 components) or an 8-bit RGB/RGBA/grey PNG. */
export function readImage(bytes: Buffer): PdfImage {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return readJpeg(bytes);
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return readPng(bytes);
  throw new PdfError('The background must be a JPEG or a PNG picture.');
}

function readJpeg(bytes: Buffer): PdfImage {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = bytes.readUInt16BE(i + 5);
      const width = bytes.readUInt16BE(i + 7);
      const components = bytes[i + 9];
      if (components !== 1 && components !== 3) throw new PdfError('The JPEG background must be colour or grey, not CMYK.');
      return { kind: 'jpeg', width, height, colors: components as 1 | 3, data: bytes };
    }
    const length = bytes.readUInt16BE(i + 2);
    i += 2 + length;
  }
  throw new PdfError('The JPEG background could not be read.');
}

function readPng(bytes: Buffer): PdfImage {
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.subarray(pos + 4, pos + 8).toString('ascii');
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'PLTE') {
      palette = body;
    } else if (type === 'tRNS') {
      transparency = body;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }
  if (depth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(colorType)) {
    throw new PdfError('The PNG background must be 8-bit, not interlaced, and RGB, RGBA, grey or palette.');
  }
  if (colorType === 3 && !palette) throw new PdfError('The PNG background has no colour palette.');
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? cur[x - channels] : 0;
      const up = prev[x];
      const upLeft = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + left) & 0xff;
      else if (filter === 2) v = (v + up) & 0xff;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        v = (v + pred) & 0xff;
      } else if (filter !== 0) throw new PdfError('The PNG background uses an unknown filter.');
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  if (colorType === 3) {
    const colour = Buffer.alloc(width * height * 3);
    const hasAlpha = transparency !== null;
    const alpha = hasAlpha ? Buffer.alloc(width * height, 255) : null;
    for (let p = 0; p < width * height; p++) {
      const index = out[p];
      colour[p * 3] = palette![index * 3];
      colour[p * 3 + 1] = palette![index * 3 + 1];
      colour[p * 3 + 2] = palette![index * 3 + 2];
      if (alpha && transparency && index < transparency.length) alpha[p] = transparency[index];
    }
    return alpha
      ? { kind: 'png', width, height, colors: 3, data: deflateSync(colour), alpha: deflateSync(alpha) }
      : { kind: 'png', width, height, colors: 3, data: deflateSync(colour) };
  }
  if (colorType === 4) {
    const grey = Buffer.alloc(width * height);
    const alpha = Buffer.alloc(width * height);
    for (let p = 0; p < width * height; p++) {
      grey[p] = out[p * 2];
      alpha[p] = out[p * 2 + 1];
    }
    return { kind: 'png', width, height, colors: 1, data: deflateSync(grey), alpha: deflateSync(alpha) };
  }
  if (colorType === 6) {
    const colour = Buffer.alloc(width * height * 3);
    const alpha = Buffer.alloc(width * height);
    for (let p = 0; p < width * height; p++) {
      colour[p * 3] = out[p * 4];
      colour[p * 3 + 1] = out[p * 4 + 1];
      colour[p * 3 + 2] = out[p * 4 + 2];
      alpha[p] = out[p * 4 + 3];
    }
    return { kind: 'png', width, height, colors: 3, data: deflateSync(colour), alpha: deflateSync(alpha) };
  }
  return { kind: 'png', width, height, colors: channels === 3 ? 3 : 1, data: deflateSync(out) };
}

export type PageOps = {
  widthMm: number;
  heightMm: number;
  content: string;
  images: { name: string; image: number }[]; // name is used in the content stream, e.g. "Im1"
};

/** Writes a complete PDF. Images are referenced by their index in `images`. */
export function buildPdf(pages: PageOps[], images: PdfImage[], title: string): Buffer {
  const objects: (Buffer | null)[] = [];
  const reserve = () => {
    objects.push(null);
    return objects.length;
  };
  const put = (id: number, body: Buffer | string) => {
    objects[id - 1] = Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1');
  };
  const catalog = reserve();
  const pagesRoot = reserve();
  const fontRegular = reserve();
  const fontBold = reserve();
  put(fontRegular, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  put(fontBold, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const imageIds = images.map((img) => {
    const alphaId = img.alpha ? reserve() : 0;
    const id = reserve();
    const colourSpace = img.colors === 3 ? '/DeviceRGB' : '/DeviceGray';
    const filter = img.kind === 'jpeg' ? '/DCTDecode' : '/FlateDecode';
    if (img.alpha) put(alphaId, Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.alpha.length} >>\nstream\n`, 'latin1'), img.alpha, Buffer.from('\nendstream', 'latin1')]));
    const smask = img.alpha ? ` /SMask ${alphaId} 0 R` : '';
    put(id, Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${colourSpace} /BitsPerComponent 8 /Filter ${filter}${smask} /Length ${img.data.length} >>\nstream\n`, 'latin1'), img.data, Buffer.from('\nendstream', 'latin1')]));
    return id;
  });
  const pageIds: number[] = [];
  for (const page of pages) {
    const contentId = reserve();
    const pageId = reserve();
    const w = (page.widthMm * MM).toFixed(2);
    const h = (page.heightMm * MM).toFixed(2);
    const xobjects = page.images.map((im) => `/${im.name} ${imageIds[im.image]} 0 R`).join(' ');
    const stream = Buffer.from(page.content, 'latin1');
    put(contentId, Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream', 'latin1')]));
    put(pageId, `<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> /XObject << ${xobjects} >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  put(pagesRoot, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  put(catalog, `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`);
  const info = reserve();
  put(info, `<< /Title (${escapeString(title)}) /Producer (Sample Kitchen voucher print) >>`);

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = parts[0].length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    if (!body) throw new Error(`PDF object ${i + 1} was never written`);
    const head = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
    const tail = Buffer.from('\nendobj\n', 'latin1');
    offsets.push(offset);
    parts.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xrefAt = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

export function escapeString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** A filled rectangle, in millimetres from the top-left of the page. */
export function rect(xMm: number, yMm: number, wMm: number, hMm: number, pageHeightMm: number, rgb = '0 0 0'): string {
  const x = (xMm * MM).toFixed(2);
  const y = ((pageHeightMm - yMm - hMm) * MM).toFixed(2);
  return `${rgb} rg ${x} ${y} ${(wMm * MM).toFixed(2)} ${(hMm * MM).toFixed(2)} re f\n`;
}

/** A line of text with its baseline at yMm from the top, aligned inside a box of width wMm. */
export function text(value: string, xMm: number, yMm: number, wMm: number, sizePt: number, bold: boolean, align: 'left' | 'center' | 'right', pageHeightMm: number, rgb = '0 0 0'): string {
  const width = textWidth(value, sizePt, bold) / MM;
  const offset = align === 'center' ? (wMm - width) / 2 : align === 'right' ? wMm - width : 0;
  const x = ((xMm + offset) * MM).toFixed(2);
  const y = ((pageHeightMm - yMm) * MM).toFixed(2);
  return `BT ${rgb} rg /${bold ? 'F2' : 'F1'} ${sizePt.toFixed(2)} Tf ${x} ${y} Td (${escapeString(value)}) Tj ET\n`;
}

/** Places a picture to fill a box, in millimetres from the top-left of the page. */
export function picture(name: string, xMm: number, yMm: number, wMm: number, hMm: number, pageHeightMm: number): string {
  const x = (xMm * MM).toFixed(2);
  const y = ((pageHeightMm - yMm - hMm) * MM).toFixed(2);
  return `q ${(wMm * MM).toFixed(2)} 0 0 ${(hMm * MM).toFixed(2)} ${x} ${y} cm /${name} Do Q\n`;
}
