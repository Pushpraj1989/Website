// Product pictures and videos, and the promotions that place them on the customer app.
// A file is accepted by its first bytes (its signature), never by its name or declared type.
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';
import { RESTAURANT_ID, storageDir } from './catalog.ts';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

type Kind = { kind: 'image' | 'video'; ext: string; mime: string };

/** The file type from its signature. Anything unknown is refused. */
export function sniff(bytes: Buffer): Kind {
  if (bytes.length < 12) throw new RuleError('That file is too small to be a picture or a video.', 'bad_file', 400);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', ext: 'png', mime: 'image/png' };
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  // MP4 and MOV both carry an 'ftyp' box at byte 4. The brand tells them apart.
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  throw new RuleError('Upload a JPEG, PNG or WebP picture, or an MP4, MOV or WebM video.', 'bad_file_type', 415);
}

export function checkSize(kind: Kind, size: number) {
  const limit = kind.kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size > limit) {
    throw new RuleError(kind.kind === 'video' ? 'The video is larger than 60 MB. Use a shorter or smaller file.' : 'The picture is larger than 3 MB. Use a smaller file.', 'too_large', 413);
  }
}

export const urlFor = (storageKey: string) => `/media/${storageKey}`;

async function assertProduct(productId: string) {
  const { rows } = await pool.query('select 1 from menu_items i join categories c on c.id = i.category_id where i.id = $1 and c.restaurant_id = $2', [productId, RESTAURANT_ID]);
  if (!rows[0]) throw new RuleError('Product not found.', 'not_found', 404);
}

/** Adds a picture or video to a product's gallery at the end. The first one becomes the cover. */
export async function addProductMedia(productId: string, bytes: Buffer, altEn: string, altAr: string, uploadedBy: string | null) {
  await assertProduct(productId);
  const kind = sniff(bytes);
  checkSize(kind, bytes.length);
  const key = `${randomUUID()}.${kind.ext}`;
  mkdirSync(storageDir(), { recursive: true });
  writeFileSync(join(storageDir(), key), bytes);
  return withTx(async (c) => {
    const media = await c.query(
      `insert into media (kind, storage_key, mime, alt_en, alt_ar, size_bytes, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id, kind, storage_key, mime`,
      [kind.kind, key, kind.mime, altEn, altAr, bytes.length, uploadedBy],
    );
    const next = await c.query('select coalesce(max(position), -1) + 1 as p, count(*)::int as n from product_media where menu_item_id = $1', [productId]);
    const isFirst = next.rows[0].n === 0;
    await c.query(
      'insert into product_media (menu_item_id, media_id, position, is_primary) values ($1,$2,$3,$4)',
      [productId, media.rows[0].id, next.rows[0].p, isFirst],
    );
    return galleryItem(media.rows[0], next.rows[0].p, isFirst);
  });
}

function galleryItem(m: { id: string; kind: string; storage_key: string; mime: string | null }, position: number, primary: boolean) {
  return { id: m.id, kind: m.kind, url: urlFor(m.storage_key), mime: m.mime, position, primary };
}

export async function productGallery(productId: string) {
  const { rows } = await pool.query(
    `select m.id, m.kind, m.storage_key, m.mime, pm.position, pm.is_primary
     from product_media pm join media m on m.id = pm.media_id
     where pm.menu_item_id = $1 order by pm.is_primary desc, pm.position`,
    [productId],
  );
  return rows.map((r) => galleryItem(r, r.position, r.is_primary));
}

/** Sets the order and the cover. The list must contain every item in the gallery, exactly once. */
export async function arrangeGallery(productId: string, order: unknown, primary: unknown) {
  await assertProduct(productId);
  if (!Array.isArray(order) || !order.every((x) => typeof x === 'string')) throw new RuleError('Send the pictures in order.', 'bad_input', 400);
  await withTx(async (c) => {
    const current = await c.query('select media_id from product_media where menu_item_id = $1 for update', [productId]);
    const have = new Set(current.rows.map((r) => r.media_id as string));
    if (order.length !== have.size || !order.every((id) => have.has(id)) || new Set(order).size !== order.length) {
      throw new RuleError('The order does not match the pictures on this product.', 'bad_input', 400);
    }
    if (typeof primary !== 'string' || !have.has(primary)) throw new RuleError('Choose a cover that is on this product.', 'bad_input', 400);
    // Two statements: clear the cover first so the one-cover index never sees two.
    await c.query('update product_media set is_primary = false where menu_item_id = $1', [productId]);
    for (let i = 0; i < order.length; i++) {
      await c.query('update product_media set position = $3, is_primary = $4 where menu_item_id = $1 and media_id = $2', [productId, order[i], i, order[i] === primary]);
    }
  });
  return productGallery(productId);
}

/** Removes an item from a product. The file goes too, unless a promotion or another product still uses it. */
export async function removeProductMedia(productId: string, mediaId: string) {
  await assertProduct(productId);
  await withTx(async (c) => {
    const link = await c.query('delete from product_media where menu_item_id = $1 and media_id = $2 returning is_primary', [productId, mediaId]);
    if (!link.rows[0]) throw new RuleError('That picture is not on this product.', 'not_found', 404);
    // Promote the next picture if the cover was removed.
    if (link.rows[0].is_primary) {
      await c.query(
        `update product_media set is_primary = true where menu_item_id = $1 and media_id = (
           select media_id from product_media where menu_item_id = $1 order by position limit 1)`,
        [productId],
      );
    }
    const stillUsed = await c.query('select 1 from product_media where media_id = $1 union all select 1 from promotions where media_id = $1 limit 1', [mediaId]);
    if (!stillUsed.rows[0]) {
      const gone = await c.query('delete from media where id = $1 returning storage_key', [mediaId]);
      const file = gone.rows[0] && join(storageDir(), gone.rows[0].storage_key);
      if (file && existsSync(file)) unlinkSync(file);
    }
  });
}

// ---------- promotions ----------

const PLACEMENTS = ['hero', 'mid_feed', 'product_background'] as const;

export async function listPromotions() {
  const { rows } = await pool.query(
    `select p.*, m.kind, m.storage_key, m.mime from promotions p join media m on m.id = p.media_id
     order by p.placement, p.position, p.starts_at`,
  );
  return rows.map(promotionView);
}

export function promotionView(r: Record<string, any>) {
  return {
    id: r.id,
    placement: r.placement,
    menuItemId: r.menu_item_id,
    media: { id: r.media_id, kind: r.kind, url: urlFor(r.storage_key), mime: r.mime },
    title: { en: r.title_en, ar: r.title_ar },
    cta: { en: r.cta_en, ar: r.cta_ar },
    position: r.position,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    active: r.active,
  };
}

function validatePromotion(body: Record<string, unknown>) {
  const placement = String(body.placement ?? '');
  if (!(PLACEMENTS as readonly string[]).includes(placement)) throw new RuleError('Choose where the promotion shows.', 'bad_input', 400);
  const menuItemId = body.menuItemId ? String(body.menuItemId) : null;
  if (placement === 'product_background' && !menuItemId) throw new RuleError('Choose the product this plays behind.', 'bad_input', 400);
  if (placement !== 'product_background' && menuItemId) throw new RuleError('Only a product background is tied to one product.', 'bad_input', 400);
  const mediaId = String(body.mediaId ?? '');
  if (!mediaId) throw new RuleError('Choose a picture or a video.', 'bad_input', 400);
  const starts = new Date(String(body.startsAt ?? ''));
  const ends = new Date(String(body.endsAt ?? ''));
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    throw new RuleError('The end must be after the start.', 'bad_input', 400);
  }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    placement,
    menuItemId,
    mediaId,
    titleEn: text(body.titleEn, 120),
    titleAr: text(body.titleAr, 120),
    ctaEn: text(body.ctaEn, 40),
    ctaAr: text(body.ctaAr, 40),
    position: Number.isInteger(body.position) ? (body.position as number) : 0,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    active: body.active !== false,
  };
}

export async function createPromotion(body: Record<string, unknown>) {
  const v = validatePromotion(body);
  const { rows } = await pool.query(
    `insert into promotions (placement, menu_item_id, media_id, title_en, title_ar, cta_en, cta_ar, position, starts_at, ends_at, active)
     select $1,$2,m.id,$4,$5,$6,$7,$8,$9,$10,$11 from media m where m.id = $3 returning id`,
    [v.placement, v.menuItemId, v.mediaId, v.titleEn, v.titleAr, v.ctaEn, v.ctaAr, v.position, v.startsAt, v.endsAt, v.active],
  );
  if (!rows[0]) throw new RuleError('That picture or video does not exist.', 'not_found', 404);
  return rows[0].id as string;
}

export async function updatePromotion(id: string, body: Record<string, unknown>) {
  const v = validatePromotion(body);
  const { rowCount } = await pool.query(
    `update promotions set placement=$2, menu_item_id=$3, media_id=$4, title_en=$5, title_ar=$6, cta_en=$7, cta_ar=$8,
       position=$9, starts_at=$10, ends_at=$11, active=$12 where id=$1`,
    [id, v.placement, v.menuItemId, v.mediaId, v.titleEn, v.titleAr, v.ctaEn, v.ctaAr, v.position, v.startsAt, v.endsAt, v.active],
  );
  if (!rowCount) throw new RuleError('Promotion not found.', 'not_found', 404);
}

export async function deletePromotion(id: string) {
  const { rowCount } = await pool.query('delete from promotions where id = $1', [id]);
  if (!rowCount) throw new RuleError('Promotion not found.', 'not_found', 404);
}

/** What the customer app shows now: live promotions for the home screen, grouped by where they go. */
export async function livePromotions() {
  const { rows } = await pool.query(
    `select p.*, m.kind, m.storage_key, m.mime from promotions p join media m on m.id = p.media_id
     where p.active and now() between p.starts_at and p.ends_at and p.placement in ('hero','mid_feed')
     order by p.placement, p.position, p.starts_at`,
  );
  const views = rows.map(promotionView);
  return { hero: views.filter((v) => v.placement === 'hero'), midFeed: views.filter((v) => v.placement === 'mid_feed') };
}

/** The video that plays behind a product, if one is live for it. */
export async function productBackground(productId: string) {
  const { rows } = await pool.query(
    `select p.*, m.kind, m.storage_key, m.mime from promotions p join media m on m.id = p.media_id
     where p.active and p.placement = 'product_background' and p.menu_item_id = $1 and now() between p.starts_at and p.ends_at
     order by p.position, p.starts_at limit 1`,
    [productId],
  );
  return rows[0] ? promotionView(rows[0]) : null;
}
