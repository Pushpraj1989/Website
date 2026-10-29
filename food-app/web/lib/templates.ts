// Voucher templates: a draft that staff edit, immutable published versions, backgrounds and previews.
// Fields may only show the placeholders in PLACEHOLDERS, so a design can never print anything the server has not
// put there. The preview fills placeholders with sample values; real codes are only ever printed from a version.
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool, withTx } from './db.ts';
import { RESTAURANT_ID, storageDir } from './catalog.ts';
import { checkSize, sniff } from './gallery.ts';
import { RuleError } from './orders.ts';

export const PAGE_MIN_MM = 20;
export const PAGE_MAX_MM = 400;
/** Nothing is printed closer than this to the edge: a safe margin for cutting and home printers. */
export const MARGIN_MM = 3;
export const MAX_FIELDS = 30;

/** The only placeholders a field may show. Anything else is refused when the design is saved. */
export const PLACEHOLDERS: Record<string, string> = {
  'voucher.code': 'SAMPLE-1234',
  'voucher.discount': '30% OFF',
  'voucher.expiry_date': '31 Dec 2026',
  'voucher.terms': 'Sample terms and conditions.',
  'voucher.serial_number': 'SN-0001',
  'voucher.qr': '',
  'campaign.name': 'Sample campaign',
  'restaurant.name': 'Sample Kitchen',
  'customer.name': 'Customer name',
};

const FIELD_TYPES = ['text', 'qr'];
const ALIGNS = ['left', 'center', 'right'];

export type Field = {
  id: string;
  type: 'text' | 'qr';
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSizePt: number;
  fontWeight: 400 | 700;
  align: 'left' | 'center' | 'right';
  color: string;
};

export type Layout = { widthMm: number; heightMm: number; backgroundMediaId: string | null; fields: Field[] };

function num(value: unknown, label: string, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new RuleError(`${label} must be a number from ${min} to ${max}.`, 'bad_input', 400);
  return Math.round(n * 10) / 10;
}

/** Checks a whole layout. Returns a clean copy; throws a readable error for the first thing wrong. */
export async function validateLayout(input: Record<string, unknown>): Promise<Layout> {
  const widthMm = num(input.widthMm, 'Width', PAGE_MIN_MM, PAGE_MAX_MM);
  const heightMm = num(input.heightMm, 'Height', PAGE_MIN_MM, PAGE_MAX_MM);
  const fieldsIn = Array.isArray(input.fields) ? input.fields : [];
  if (fieldsIn.length > MAX_FIELDS) throw new RuleError(`A design can have at most ${MAX_FIELDS} fields.`, 'bad_input', 400);
  const ids = new Set<string>();
  const fields: Field[] = fieldsIn.map((raw, i) => {
    const f = raw as Record<string, unknown>;
    const id = String(f.id ?? '');
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new RuleError(`Field ${i + 1} needs an id of lowercase letters, digits or dashes.`, 'bad_input', 400);
    if (ids.has(id)) throw new RuleError(`Field ids must be unique (${id} appears twice).`, 'bad_input', 400);
    ids.add(id);
    const type = String(f.type ?? 'text');
    if (!FIELD_TYPES.includes(type)) throw new RuleError('A field is text or a QR code.', 'bad_input', 400);
    const x = num(f.x, 'Position x', 0, widthMm);
    const y = num(f.y, 'Position y', 0, heightMm);
    const w = num(f.w, 'Width of a field', 4, widthMm);
    const h = num(f.h, 'Height of a field', 4, heightMm);
    if (x < MARGIN_MM || y < MARGIN_MM || x + w > widthMm - MARGIN_MM || y + h > heightMm - MARGIN_MM) {
      throw new RuleError(`Field ${id} is outside the ${MARGIN_MM} mm print margin.`, 'outside_margin', 400);
    }
    const content = type === 'qr' ? '{{voucher.qr}}' : String(f.content ?? '');
    if (type === 'text' && (content.length < 1 || content.length > 200)) throw new RuleError(`Field ${id} needs 1 to 200 characters.`, 'bad_input', 400);
    for (const match of content.matchAll(/\{\{([^}]*)\}\}/g)) {
      if (!(match[1] in PLACEHOLDERS)) throw new RuleError(`{{${match[1]}}} is not a placeholder this design can use.`, 'bad_placeholder', 400);
    }
    const align = String(f.align ?? 'left');
    if (!ALIGNS.includes(align)) throw new RuleError('Alignment is left, center or right.', 'bad_input', 400);
    const color = String(f.color ?? '#1C1917');
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new RuleError('Colour must be a hex value like #1C1917.', 'bad_input', 400);
    const weight = Number(f.fontWeight ?? 400);
    if (weight !== 400 && weight !== 700) throw new RuleError('Font weight is 400 or 700.', 'bad_input', 400);
    return {
      id, type: type as Field['type'], content, x, y, w, h,
      fontSizePt: num(f.fontSizePt ?? 12, 'Font size', 6, 72),
      fontWeight: weight as 400 | 700,
      align: align as Field['align'],
      color,
    };
  });
  const backgroundMediaId = input.backgroundMediaId ? String(input.backgroundMediaId) : null;
  if (backgroundMediaId) {
    const { rows } = await pool.query(`select 1 from media where id = $1 and kind = 'image'`, [backgroundMediaId]);
    if (!rows[0]) throw new RuleError('The background must be an uploaded picture.', 'bad_input', 400);
  }
  return { widthMm, heightMm, backgroundMediaId, fields };
}

/** A published design must show the code somewhere, or a voucher could not be redeemed from its print. */
export function assertShowsCode(layout: Layout) {
  const shows = layout.fields.some((f) => f.type === 'qr' || f.content.includes('{{voucher.code}}'));
  if (!shows) throw new RuleError('Add the voucher code or a QR code before publishing.', 'no_code_field', 409);
}

export function templateView(row: Record<string, any>) {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as string,
    currentVersion: row.current_version as number | null,
    draft: row.draft as Layout,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listTemplates() {
  const { rows } = await pool.query(`select * from voucher_templates where restaurant_id = $1 order by updated_at desc`, [RESTAURANT_ID]);
  return rows.map(templateView);
}

export async function createTemplate(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  if (name.length < 1 || name.length > 120) throw new RuleError('Name the template (1 to 120 characters).', 'bad_input', 400);
  const draft = await validateLayout({ widthMm: body.widthMm ?? 85, heightMm: body.heightMm ?? 55, fields: [] });
  const { rows } = await pool.query(
    `insert into voucher_templates (restaurant_id, name, draft) values ($1,$2,$3) returning *`,
    [RESTAURANT_ID, name, JSON.stringify(draft)],
  );
  return templateView(rows[0]);
}

async function lockTemplate(c: any, id: string) {
  const { rows } = await c.query(`select * from voucher_templates where id = $1 and restaurant_id = $2 for update`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Template not found.', 'not_found', 404);
  return rows[0];
}

export async function getTemplate(id: string) {
  const { rows } = await pool.query(`select * from voucher_templates where id = $1 and restaurant_id = $2`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Template not found.', 'not_found', 404);
  const versions = await pool.query(`select version, published_at from voucher_template_versions where template_id = $1 order by version desc`, [id]);
  return { template: templateView(rows[0]), versions: versions.rows.map((v) => ({ version: v.version, publishedAt: new Date(v.published_at).toISOString() })) };
}

/** Saves the draft. Archived templates cannot change. Published ones keep their versions and take a new draft. */
export async function updateDraft(id: string, body: Record<string, unknown>) {
  return withTx(async (c) => {
    const current = await lockTemplate(c, id);
    if (current.status === 'archived') throw new RuleError('An archived template cannot be changed.', 'not_editable', 409);
    const old = current.draft as Layout;
    const layout = await validateLayout({
      widthMm: body.widthMm ?? old.widthMm,
      heightMm: body.heightMm ?? old.heightMm,
      backgroundMediaId: body.backgroundMediaId === undefined ? old.backgroundMediaId : body.backgroundMediaId,
      fields: body.fields ?? old.fields,
    });
    const name = body.name === undefined ? current.name : String(body.name).trim();
    if (name.length < 1 || name.length > 120) throw new RuleError('Name the template (1 to 120 characters).', 'bad_input', 400);
    const { rows } = await c.query(
      `update voucher_templates set name = $2, draft = $3, updated_at = now() where id = $1 returning *`,
      [id, name, JSON.stringify(layout)],
    );
    return templateView(rows[0]);
  });
}

/** Publishes the draft as the next version. The version is a copy; later edits to the draft do not change it. */
export async function publishTemplate(id: string) {
  return withTx(async (c) => {
    const current = await lockTemplate(c, id);
    if (current.status === 'archived') throw new RuleError('An archived template cannot be published.', 'not_editable', 409);
    const layout = current.draft as Layout;
    assertShowsCode(layout);
    const next = (current.current_version ?? 0) + 1;
    await c.query(`insert into voucher_template_versions (template_id, version, layout) values ($1,$2,$3)`, [id, next, JSON.stringify(layout)]);
    const { rows } = await c.query(
      `update voucher_templates set status = 'published', current_version = $2, updated_at = now() where id = $1 returning *`,
      [id, next],
    );
    return templateView(rows[0]);
  });
}

export async function archiveTemplate(id: string) {
  return withTx(async (c) => {
    await lockTemplate(c, id);
    const { rows } = await c.query(`update voucher_templates set status = 'archived', updated_at = now() where id = $1 returning *`, [id]);
    return templateView(rows[0]);
  });
}

/** Copies the draft into a new draft with no versions, so the copy can be edited and published on its own. */
export async function duplicateTemplate(id: string) {
  const { rows } = await pool.query(`select * from voucher_templates where id = $1 and restaurant_id = $2`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Template not found.', 'not_found', 404);
  const copy = await pool.query(
    `insert into voucher_templates (restaurant_id, name, draft) values ($1,$2,$3) returning *`,
    [RESTAURANT_ID, `${rows[0].name} (copy)`.slice(0, 120), JSON.stringify(rows[0].draft)],
  );
  return templateView(copy.rows[0]);
}

/** Stores a background picture. Only pictures are accepted, checked by their bytes and size, like product pictures. */
export async function setBackground(id: string, bytes: Buffer) {
  const kind = sniff(bytes);
  if (kind.kind !== 'image') throw new RuleError('A background must be a picture.', 'bad_file_type', 415);
  checkSize(kind, bytes.length);
  const key = `${randomUUID()}.${kind.ext}`;
  mkdirSync(storageDir(), { recursive: true });
  writeFileSync(join(storageDir(), key), bytes);
  return withTx(async (c) => {
    const current = await lockTemplate(c, id);
    if (current.status === 'archived') throw new RuleError('An archived template cannot be changed.', 'not_editable', 409);
    const media = await c.query(
      `insert into media (kind, storage_key, mime, alt_en, alt_ar, size_bytes) values ('image',$1,$2,'','',$3) returning id`,
      [key, kind.mime, bytes.length],
    );
    const draft = { ...(current.draft as Layout), backgroundMediaId: media.rows[0].id };
    const { rows } = await c.query(`update voucher_templates set draft = $2, updated_at = now() where id = $1 returning *`, [id, JSON.stringify(draft)]);
    return templateView(rows[0]);
  });
}

/** The draft or the published version, with every placeholder filled by its sample value. */
export async function previewTemplate(id: string, which: 'draft' | 'current') {
  const { rows } = await pool.query(`select * from voucher_templates where id = $1 and restaurant_id = $2`, [id, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Template not found.', 'not_found', 404);
  let layout = rows[0].draft as Layout;
  if (which === 'current') {
    if (!rows[0].current_version) throw new RuleError('This template has no published version yet.', 'not_published', 409);
    const v = await pool.query(`select layout from voucher_template_versions where template_id = $1 and version = $2`, [id, rows[0].current_version]);
    layout = v.rows[0].layout as Layout;
  }
  return {
    widthMm: layout.widthMm,
    heightMm: layout.heightMm,
    backgroundMediaId: layout.backgroundMediaId,
    fields: layout.fields.map((f) => ({ ...f, text: f.type === 'qr' ? 'QR' : fill(f.content) })),
    sample: true,
  };
}

/** Fills the placeholders in a text. Only the known placeholders reach here, because the layout was checked. */
export function fill(content: string): string {
  return content.replace(/\{\{([^}]*)\}\}/g, (_m, key: string) => PLACEHOLDERS[key] ?? '');
}

/** The issued version of a template for a new voucher: the current published one, or none if unpublished. */
export async function currentVersionId(c: any, templateId: string | null): Promise<string | null> {
  if (!templateId) return null;
  const { rows } = await c.query(
    `select v.id from voucher_template_versions v join voucher_templates t on t.id = v.template_id
     where t.id = $1 and v.version = t.current_version and t.status = 'published'`,
    [templateId],
  );
  return rows[0]?.id ?? null;
}
