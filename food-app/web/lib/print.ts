// Printing and export of vouchers (Phase 4). Real codes come from the encrypted copy, each checked against its hash.
// Designs are the published versions the vouchers were issued with. Every print and export is recorded.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './db.ts';
import { decryptSecret } from './crypto.ts';
import { encode } from './qr.ts';
import { buildPdf, assertPrintable, picture, readImage, rect, text, textWidth, PdfError, MM } from './pdf.ts';
import type { PdfImage, PageOps } from './pdf.ts';
import { RESTAURANT_ID, storageDir } from './catalog.ts';
import { codeHash } from './campaigns.ts';
import { RuleError } from './orders.ts';

export const PRINT_LIMIT = 2000;
export const MIN_QR_MM = 12;
const SHEETS: Record<string, { widthMm: number; heightMm: number; margin: number; gap: number }> = {
  a4: { widthMm: 210, heightMm: 297, margin: 10, gap: 4 },
  a5: { widthMm: 148, heightMm: 210, margin: 8, gap: 3 },
};

type Layout = { widthMm: number; heightMm: number; backgroundMediaId: string | null; fields: any[] };

/** The vouchers to print or export: one pool, optionally one batch, only those still usable. */
async function vouchersFor(poolId: string, batchId: string | null, usableOnly: boolean) {
  const { rows } = await pool.query(
    `select v.id, v.code_hash, v.code_ciphertext, v.status, v.expires_at, v.batch_id, v.template_version_id,
            row_number() over (partition by v.pool_id order by v.created_at, v.id) as serial,
            o.offer_type, o.value_int, o.min_subtotal_minor, o.applies_to,
            cm.name as campaign_name, r.name_en as restaurant_name, r.timezone as timezone,
            tv.layout, p.template_id
     from vouchers v
     join voucher_pools p on p.id = v.pool_id
     join campaigns cm on cm.id = p.campaign_id
     join offers o on o.id = v.offer_id
     join restaurant r on r.id = cm.restaurant_id
     left join voucher_template_versions tv on tv.id = v.template_version_id
     where v.pool_id = $1 and cm.restaurant_id = $2
       and ($3::uuid is null or v.batch_id = $3)
       and ($4::boolean = false or (v.status = 'available' and v.expires_at > now()))
     order by v.created_at, v.id`,
    [poolId, RESTAURANT_ID, batchId, usableOnly],
  );
  return rows;
}

/** The real code of a voucher, read back from its encrypted copy and checked against its hash. */
export function codeOf(row: { code_ciphertext: string; code_hash: string }): string {
  let code: string;
  try {
    code = decryptSecret(row.code_ciphertext);
  } catch {
    // Codes are encrypted with APP_ENCRYPTION_KEY. A different key cannot read them, so say so plainly.
    throw new RuleError('These codes cannot be read with the current encryption key. Check APP_ENCRYPTION_KEY.', 'key_mismatch', 500);
  }
  if (codeHash(code) !== row.code_hash) throw new RuleError('A stored code does not match its record. Print stopped.', 'integrity', 500);
  return code;
}

export function discountText(row: any): string {
  const v = Number(row.value_int);
  switch (row.offer_type) {
    case 'percent': return `${Number((v / 100).toFixed(2))}% OFF`;
    case 'fixed': return `AED ${(v / 100).toFixed(2)} OFF`;
    case 'free_delivery': return 'FREE DELIVERY';
    case 'item_free': return 'FREE ITEM';
    default: return 'SPECIAL OFFER';
  }
}

function expiryText(row: any): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: row.timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(row.expires_at));
}

/** The text a placeholder becomes for one voucher. Only facts the platform holds are used. */
function values(row: any, code: string): Record<string, string> {
  const min = Number(row.min_subtotal_minor);
  return {
    'voucher.code': code,
    'voucher.qr': code,
    'voucher.discount': discountText(row),
    'voucher.expiry_date': `Valid until ${expiryText(row)}`,
    'campaign.name': row.campaign_name,
    'restaurant.name': row.restaurant_name,
    'customer.name': '',
    'voucher.terms': `One use.${min > 0 ? ` Minimum order AED ${(min / 100).toFixed(2)}.` : ''} Terms apply.`,
    'voucher.serial_number': `SN-${String(row.serial).padStart(4, '0')}`,
  };
}

function fillReal(content: string, vals: Record<string, string>): string {
  return content.replace(/\{\{([^}]*)\}\}/g, (_m, key: string) => vals[key] ?? '');
}

function hexRgb(hex: string): string {
  const n = (i: number) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3);
  return `${n(1)} ${n(3)} ${n(5)}`;
}

/** Wraps text into lines that fit a width. Words are kept whole; a single word wider than the box is refused. */
function wrap(value: string, sizePt: number, bold: boolean, widthMm: number, label: string): string[] {
  const maxPt = widthMm * MM;
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, sizePt, bold) <= maxPt) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      if (textWidth(word, sizePt, bold) > maxPt) throw new RuleError(`${label}: a word does not fit its box. Make the box wider or the text smaller.`, 'does_not_fit', 422);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Draws one voucher at (ox, oy) on the page. Returns the picture it used, if any. */
function drawVoucher(layout: Layout, row: any, code: string, ox: number, oy: number, pageH: number, bgName: string | null, ops: string[]) {
  const vals = values(row, code);
  if (bgName) ops.push(picture(bgName, ox, oy, layout.widthMm, layout.heightMm, pageH));
  for (const f of layout.fields) {
    const x = ox + f.x;
    const y = oy + f.y;
    if (f.type === 'qr') {
      const side = Math.min(f.w, f.h);
      if (side < MIN_QR_MM) throw new RuleError(`The QR area is too small to scan (at least ${MIN_QR_MM} mm).`, 'qr_too_small', 422);
      const grid = encode(vals['voucher.qr']);
      const n = grid.length;
      const module = side / (n + 8);
      ops.push(rect(x, y, side, side, pageH, '1 1 1'));
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (grid[r][c]) ops.push(rect(x + (c + 4) * module, y + (r + 4) * module, module, module, pageH));
        }
      }
      continue;
    }
    const value = fillReal(f.content, vals);
    assertPrintable(value, `Field ${f.id}`);
    const lineHeightMm = f.fontSizePt * 1.2 / MM;
    const lines = wrap(value, f.fontSizePt, f.fontWeight === 700, f.w, `Field ${f.id}`);
    const usedMm = lines.length * lineHeightMm;
    if (usedMm > f.h + 0.01) throw new RuleError(`Field ${f.id} does not fit its box for voucher ${vals['voucher.serial_number']}. Make the box taller or the text shorter.`, 'does_not_fit', 422);
    lines.forEach((line, i) => {
      const baseline = y + f.fontSizePt * 0.8 / MM + i * lineHeightMm;
      ops.push(text(line, x, baseline, f.w, f.fontSizePt, f.fontWeight === 700, f.align, pageH, hexRgb(f.color)));
    });
  }
}

async function loadBackground(id: string | null, cache: Map<string, { name: string; index: number }>, images: PdfImage[]) {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id)!;
  const { rows } = await pool.query(`select storage_key from media where id = $1 and kind = 'image'`, [id]);
  if (!rows[0]) throw new RuleError('The design background is missing.', 'not_found', 404);
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(storageDir(), rows[0].storage_key));
  } catch {
    throw new RuleError('The design background file is missing.', 'not_found', 404);
  }
  let image: PdfImage;
  try {
    image = readImage(bytes);
  } catch (err) {
    if (err instanceof PdfError) throw new RuleError(`${err.message} Upload the design background again as a JPEG or PNG.`, 'bad_background', 422);
    throw err;
  }
  images.push(image);
  const entry = { name: `Im${images.length}`, index: images.length - 1 };
  cache.set(id, entry);
  return entry;
}

/** Builds a PDF of vouchers. format: 'card' is one voucher per page at design size; 'a4' and 'a5' are sheets. */
export async function printPdf(poolId: string, format: string, batchId: string | null, requestedBy: string): Promise<{ pdf: Buffer; count: number }> {
  if (!['card', 'a4', 'a5'].includes(format)) throw new RuleError('Choose a4, a5 or card.', 'bad_input', 400);
  const poolRow = await pool.query(`select p.template_id from voucher_pools p join campaigns cm on cm.id = p.campaign_id where p.id = $1 and cm.restaurant_id = $2`, [poolId, RESTAURANT_ID]);
  if (!poolRow.rows[0]) throw new RuleError('Pool not found.', 'not_found', 404);
  if (!poolRow.rows[0].template_id) throw new RuleError('Choose a design for this pool before printing.', 'no_design', 409);
  const rows = await vouchersFor(poolId, batchId, true);
  if (rows.length === 0) throw new RuleError('No usable vouchers to print.', 'nothing_to_print', 409);
  if (rows.length > PRINT_LIMIT) throw new RuleError(`Print at most ${PRINT_LIMIT} vouchers at once. Use a smaller batch.`, 'too_many', 422);
  if (rows.some((r) => !r.layout)) throw new RuleError('Some vouchers have no design version. Re-issue them after publishing the design.', 'no_design', 409);

  const images: PdfImage[] = [];
  const cache = new Map<string, { name: string; index: number }>();
  const pages: PageOps[] = [];
  let page: { ops: string[]; images: { name: string; image: number }[]; widthMm: number; heightMm: number } | null = null;
  let cell = 0;
  let perPage = 1;
  let sheet = format === 'card' ? null : SHEETS[format];
  let layoutKey: string | null = null;
  let layout: Layout | null = null;
  let bg: { name: string; index: number } | null = null;

  for (const row of rows) {
    const key = row.template_version_id as string;
    if (key !== layoutKey) {
      layoutKey = key;
      layout = row.layout as Layout;
      bg = await loadBackground(layout.backgroundMediaId, cache, images);
      if (format === 'card') {
        sheet = { widthMm: layout.widthMm, heightMm: layout.heightMm, margin: 0, gap: 0 };
      } else if (layout.widthMm > (sheet as any).widthMm - 2 * (sheet as any).margin || layout.heightMm > (sheet as any).heightMm - 2 * (sheet as any).margin) {
        throw new RuleError('The design is larger than the sheet. Print it as cards instead.', 'too_large_for_sheet', 422);
      }
    }
    const s = sheet!;
    const cols = format === 'card' ? 1 : Math.max(1, Math.floor((s.widthMm - 2 * s.margin + s.gap) / (layout!.widthMm + s.gap)));
    const rowsPerPage = format === 'card' ? 1 : Math.max(1, Math.floor((s.heightMm - 2 * s.margin + s.gap) / (layout!.heightMm + s.gap)));
    perPage = cols * rowsPerPage;
    if (!page || cell >= perPage) {
      if (page) pages.push({ widthMm: page.widthMm, heightMm: page.heightMm, content: page.ops.join(''), images: page.images });
      page = { ops: [], images: [], widthMm: s.widthMm, heightMm: s.heightMm };
      cell = 0;
    }
    const col = cell % cols;
    const r = Math.floor(cell / cols);
    const ox = s.margin + col * (layout!.widthMm + s.gap);
    const oy = s.margin + r * (layout!.heightMm + s.gap);
    const code = codeOf(row);
    const bgName = bg ? bg.name : null;
    if (bg && !page.images.some((i) => i.name === bg!.name)) page.images.push({ name: bg.name, image: bg.index });
    drawVoucher(layout!, row, code, ox, oy, page.heightMm, bgName, page.ops);
    cell++;
  }
  if (page) pages.push({ widthMm: page.widthMm, heightMm: page.heightMm, content: page.ops.join(''), images: page.images });
  void perPage;

  await pool.query(
    `insert into voucher_print_jobs (pool_id, batch_id, kind, format, voucher_count, requested_by) values ($1,$2,'print',$3,$4,$5)`,
    [poolId, batchId, format, rows.length, requestedBy],
  );
  // Pages in mixed sizes are allowed; each page carries its own size.
  const pdf = buildPdf(pages.map((p) => ({ ...p, widthMm: p.widthMm, heightMm: p.heightMm })), images, 'Vouchers');
  return { pdf, count: rows.length };
}

/** The codes as CSV, for a warehouse or a partner. Every export is recorded. */
export async function exportCsv(poolId: string, batchId: string | null, requestedBy: string): Promise<{ csv: string; count: number }> {
  const rows = await vouchersFor(poolId, batchId, false);
  if (rows.length === 0) throw new RuleError('No vouchers to export.', 'nothing_to_export', 409);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['code,serial,status,expires_at,batch_id'];
  for (const row of rows) {
    lines.push([codeOf(row), `SN-${String(row.serial).padStart(4, '0')}`, row.status, new Date(row.expires_at).toISOString(), row.batch_id ?? ''].map((v) => esc(String(v))).join(','));
  }
  await pool.query(
    `insert into voucher_print_jobs (pool_id, batch_id, kind, format, voucher_count, requested_by) values ($1,$2,'export','csv',$3,$4)`,
    [poolId, batchId, rows.length, requestedBy],
  );
  return { csv: lines.join('\n') + '\n', count: rows.length };
}
