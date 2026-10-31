// Product pictures and videos, and the promotions that place them on the customer app.
// A file is accepted by its first bytes (its signature), never by its name or declared type.
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';
import { RESTAURANT_ID, storageDir } from './catalog.ts';
import { dropPoster, makePoster, posterUrlFor } from './posters.ts';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
/** Animated GIFs run larger than stills; they are allowed more room, still far below a video. */
export const MAX_GIF_BYTES = 8 * 1024 * 1024;

type Kind = { kind: 'image' | 'video'; ext: string; mime: string };

/** The file type from its signature. Anything unknown is refused. */
export function sniff(bytes: Buffer): Kind {
  if (bytes.length < 12) throw new RuleError('That file is too small to be a picture or a video.', 'bad_file', 400);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: 'image', ext: 'jpg', mime: 'image/jpeg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', ext: 'png', mime: 'image/png' };
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return { kind: 'image', ext: 'webp', mime: 'image/webp' };
  const head = bytes.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return { kind: 'image', ext: 'gif', mime: 'image/gif' };
  // MP4 and MOV both carry an 'ftyp' box at byte 4. The brand tells them apart.
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return { kind: 'video', ext: 'mov', mime: 'video/quicktime' };
    return { kind: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: 'video', ext: 'webm', mime: 'video/webm' };
  throw new RuleError('Upload a JPEG, PNG, WebP or GIF picture, or an MP4, MOV or WebM video.', 'bad_file_type', 415);
}

export function checkSize(kind: Kind, size: number) {
  const limit = kind.kind === 'video' ? MAX_VIDEO_BYTES : kind.ext === 'gif' ? MAX_GIF_BYTES : MAX_IMAGE_BYTES;
  if (size > limit) {
    const message = kind.kind === 'video' ? 'The video is larger than 60 MB. Use a shorter or smaller file.'
      : kind.ext === 'gif' ? 'The GIF is larger than 8 MB. Use a shorter or smaller one.' : 'The picture is larger than 3 MB. Use a smaller file.';
    throw new RuleError(message, 'too_large', 413);
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
  if (kind.kind === 'video') await makePoster(key);
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
  return { id: m.id, kind: m.kind, url: urlFor(m.storage_key), posterUrl: posterUrlFor(m.storage_key), mime: m.mime, position, primary };
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
      if (gone.rows[0]) dropPoster(gone.rows[0].storage_key);
    }
  });
}

// ---------- promotions ----------

export const PLACEMENTS = ['hero', 'mid_feed', 'product_background', 'carousel', 'welcome', 'strip'] as const;
/** Places that can run on colour and words alone. The others need a picture or a video. */
const MEDIA_OPTIONAL = ['carousel', 'welcome', 'strip'];
export const ANIMATIONS = ['slide_up', 'slide_down', 'slide_left', 'slide_right', 'zoom', 'fade'] as const;
export const SIZES = ['compact', 'standard', 'tall', 'full'] as const;
export const FRAMES = ['rounded', 'square', 'ticket', 'circle'] as const;
export const FREQUENCIES = ['every_open', 'once_per_day', 'once'] as const;

// Built when used, not when the file loads: RESTAURANT_ID comes from a module that imports this one.
const promoSelect = () => `select p.*, m.kind, m.storage_key, m.mime,
    o.offer_type, o.value_int, o.code as offer_code, o.min_subtotal_minor, o.max_discount_minor, o.ends_at as offer_ends_at,
    o.applies_to, o.name_en as offer_name_en, o.name_ar as offer_name_ar, r.currency_code
  from promotions p
  left join media m on m.id = p.media_id
  left join offers o on o.id = p.offer_id
  cross join (select currency_code from restaurant where id = '${RESTAURANT_ID}') r`;

export async function listPromotions() {
  const { rows } = await pool.query(`${promoSelect()} order by p.placement, p.position, p.starts_at`);
  return rows.map(promotionView);
}

/** The terms a customer sees for the linked offer: the headline, the code, the minimum, the cap and the last day. */
function offerFacts(r: Record<string, any>) {
  if (!r.offer_id || !r.offer_type) return null;
  const currency = r.currency_code ?? 'AED';
  const headline = r.offer_type === 'percent' ? { en: `${r.value_int / 100}% OFF`, ar: `خصم ${r.value_int / 100}%` }
    : r.offer_type === 'fixed' ? { en: `${currency} ${r.value_int / 100} OFF`, ar: `خصم ${r.value_int / 100} ${currency}` }
      : r.offer_type === 'free_delivery' ? { en: 'FREE DELIVERY', ar: 'توصيل مجاني' }
        : { en: 'SPECIAL OFFER', ar: 'عرض خاص' };
  const ends = new Date(r.offer_ends_at);
  return {
    offerId: r.offer_id,
    name: { en: r.offer_name_en, ar: r.offer_name_ar },
    headline,
    code: r.offer_code ?? null,
    appliesTo: r.applies_to,
    minSpendMinor: r.min_subtotal_minor ?? 0,
    maxSavingMinor: r.max_discount_minor ?? null,
    currency,
    endsAt: ends.toISOString(),
    daysLeft: Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86_400_000)),
  };
}

export function promotionView(r: Record<string, any>) {
  return {
    id: r.id,
    placement: r.placement,
    menuItemId: r.menu_item_id,
    media: r.media_id ? { id: r.media_id, kind: r.kind, url: urlFor(r.storage_key), posterUrl: posterUrlFor(r.storage_key), mime: r.mime } : null,
    kicker: { en: r.kicker_en ?? '', ar: r.kicker_ar ?? '' },
    title: { en: r.title_en, ar: r.title_ar },
    body: { en: r.body_en ?? '', ar: r.body_ar ?? '' },
    cta: { en: r.cta_en, ar: r.cta_ar },
    offer: offerFacts(r),
    look: {
      animation: r.animation ?? 'slide_up',
      size: r.size ?? 'standard',
      frame: r.frame ?? 'rounded',
      colour: r.colour ?? null,
      durationSeconds: r.duration_seconds ?? 5,
      frequency: r.frequency ?? 'once_per_day',
    },
    position: r.position,
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: new Date(r.ends_at).toISOString(),
    active: r.active,
  };
}

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number], label: string): T[number] {
  if (value === undefined || value === null || value === '') return fallback;
  if (!(allowed as readonly string[]).includes(String(value))) throw new RuleError(`Choose one of the listed ${label}.`, 'bad_input', 400);
  return String(value) as T[number];
}

function validatePromotion(body: Record<string, unknown>) {
  const placement = String(body.placement ?? '');
  if (!(PLACEMENTS as readonly string[]).includes(placement)) throw new RuleError('Choose where the promotion shows.', 'bad_input', 400);
  const menuItemId = body.menuItemId ? String(body.menuItemId) : null;
  if (placement === 'product_background' && !menuItemId) throw new RuleError('Choose the product this plays behind.', 'bad_input', 400);
  const mediaId = body.mediaId ? String(body.mediaId) : null;
  if (!mediaId && !MEDIA_OPTIONAL.includes(placement)) throw new RuleError('Choose a picture or a video.', 'bad_input', 400);
  const starts = new Date(String(body.startsAt ?? ''));
  const ends = new Date(String(body.endsAt ?? ''));
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    throw new RuleError('The end must be after the start.', 'bad_input', 400);
  }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const titleEn = text(body.titleEn, 120);
  if (MEDIA_OPTIONAL.includes(placement) && !mediaId && !titleEn && !body.offerId) {
    throw new RuleError('Without a picture, give it a title or link an offer, so there is something to show.', 'bad_input', 400);
  }
  const colour = body.colour ? String(body.colour).trim().toUpperCase() : null;
  if (colour && !/^#[0-9A-F]{6}$/.test(colour)) throw new RuleError('Enter the colour as # and six hex digits.', 'bad_input', 400);
  // White words sit on this colour, so it needs the same 4.5:1 as the brand colour.
  if (colour && 1.05 / (lum(colour) + 0.05) < 4.5) throw new RuleError('That colour is too light for white words on it. Choose a darker shade.', 'low_contrast', 400);
  const duration = body.durationSeconds === undefined ? 5 : Number(body.durationSeconds);
  if (!Number.isInteger(duration) || duration < 3 || duration > 20) throw new RuleError('Each slide stays from 3 to 20 seconds.', 'bad_input', 400);
  return {
    placement,
    menuItemId,
    mediaId,
    kickerEn: text(body.kickerEn, 40),
    kickerAr: text(body.kickerAr, 40),
    titleEn,
    titleAr: text(body.titleAr, 120),
    bodyEn: text(body.bodyEn, 200),
    bodyAr: text(body.bodyAr, 200),
    ctaEn: text(body.ctaEn, 40),
    ctaAr: text(body.ctaAr, 40),
    offerId: body.offerId ? String(body.offerId) : null,
    animation: pick(body.animation, ANIMATIONS, 'slide_up', 'animations'),
    size: pick(body.size, SIZES, 'standard', 'sizes'),
    frame: pick(body.frame, FRAMES, placement === 'welcome' ? 'ticket' : 'rounded', 'frames'),
    colour,
    duration,
    frequency: pick(body.frequency, FREQUENCIES, 'once_per_day', 'frequencies'),
    position: Number.isInteger(body.position) ? (body.position as number) : 0,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    active: body.active !== false,
  };
}

function lum(hex: string) {
  const c = (i: number) => { const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(0) + 0.7152 * c(1) + 0.0722 * c(2);
}

const PROMO_COLUMNS = `placement, menu_item_id, media_id, kicker_en, kicker_ar, title_en, title_ar, body_en, body_ar, cta_en, cta_ar,
  offer_id, animation, size, frame, colour, duration_seconds, frequency, position, starts_at, ends_at, active`;
const promoValues = (v: ReturnType<typeof validatePromotion>) => [v.placement, v.menuItemId, v.mediaId, v.kickerEn, v.kickerAr, v.titleEn, v.titleAr,
  v.bodyEn, v.bodyAr, v.ctaEn, v.ctaAr, v.offerId, v.animation, v.size, v.frame, v.colour, v.duration, v.frequency, v.position, v.startsAt, v.endsAt, v.active];

async function assertRefs(v: ReturnType<typeof validatePromotion>) {
  if (v.mediaId && !(await pool.query('select 1 from media where id = $1', [v.mediaId])).rows[0]) throw new RuleError('That picture or video does not exist.', 'not_found', 404);
  if (v.offerId && !(await pool.query('select 1 from offers where id = $1 and restaurant_id = $2', [v.offerId, RESTAURANT_ID])).rows[0]) throw new RuleError('That offer does not exist.', 'not_found', 404);
  if (v.menuItemId) await assertProduct(v.menuItemId);
}

export async function createPromotion(body: Record<string, unknown>) {
  const v = validatePromotion(body);
  await assertRefs(v);
  const { rows } = await pool.query(
    `insert into promotions (${PROMO_COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id`,
    promoValues(v),
  );
  return rows[0].id as string;
}

export async function updatePromotion(id: string, body: Record<string, unknown>) {
  const v = validatePromotion(body);
  await assertRefs(v);
  const { rowCount } = await pool.query(
    `update promotions set (${PROMO_COLUMNS}) = ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) where id = $1`,
    [id, ...promoValues(v)],
  );
  if (!rowCount) throw new RuleError('Promotion not found.', 'not_found', 404);
}

export async function deletePromotion(id: string) {
  await withTx(async (c) => {
    const gone = await c.query('delete from promotions where id = $1 returning media_id', [id]);
    if (!gone.rows[0]) throw new RuleError('Promotion not found.', 'not_found', 404);
    await dropIfUnused(c, gone.rows[0].media_id);
  });
}

/** Removes a picture or video, and its file, once nothing uses it any more. */
async function dropIfUnused(c: { query: (q: string, v: unknown[]) => Promise<{ rows: any[] }> }, mediaId: string | null) {
  if (!mediaId) return;
  const used = await c.query('select 1 from product_media where media_id = $1 union all select 1 from promotions where media_id = $1 limit 1', [mediaId]);
  if (used.rows[0]) return;
  const gone = await c.query('delete from media where id = $1 returning storage_key', [mediaId]);
  const file = gone.rows[0] && join(storageDir(), gone.rows[0].storage_key);
  if (file && existsSync(file)) unlinkSync(file);
  if (gone.rows[0]) dropPoster(gone.rows[0].storage_key);
}

/** A picture, GIF or video uploaded for a promotion rather than for a product. */
export async function addPromotionMedia(bytes: Buffer, uploadedBy: string | null) {
  const kind = sniff(bytes);
  checkSize(kind, bytes.length);
  const key = `${randomUUID()}.${kind.ext}`;
  mkdirSync(storageDir(), { recursive: true });
  writeFileSync(join(storageDir(), key), bytes);
  if (kind.kind === 'video') await makePoster(key);
  const { rows } = await pool.query(
    `insert into media (kind, storage_key, mime, alt_en, alt_ar, size_bytes, uploaded_by) values ($1,$2,$3,'','',$4,$5) returning id, kind, storage_key, mime`,
    [kind.kind, key, kind.mime, bytes.length, uploadedBy],
  );
  const m = rows[0];
  return { id: m.id as string, kind: m.kind as string, url: urlFor(m.storage_key), posterUrl: posterUrlFor(m.storage_key), mime: m.mime as string };
}

/** What the customer app shows now, grouped by place. The welcome pop-up and the strip show one each: the first by position. */
export async function livePromotions() {
  const { rows } = await pool.query(
    `${promoSelect()}
     where p.active and now() between p.starts_at and p.ends_at and p.placement in ('hero','mid_feed','carousel','welcome','strip')
       and (p.offer_id is null or (o.active and now() between o.starts_at and o.ends_at))
     order by p.placement, p.position, p.starts_at`,
  );
  const views = rows.map(promotionView);
  const of = (placement: string) => views.filter((v) => v.placement === placement);
  return { hero: of('hero'), midFeed: of('mid_feed'), carousel: of('carousel'), welcome: of('welcome')[0] ?? null, strip: of('strip')[0] ?? null };
}

/** The video that plays behind a product, if one is live for it. */
export async function productBackground(productId: string) {
  const { rows } = await pool.query(
    `${promoSelect()}
     where p.active and p.placement = 'product_background' and p.menu_item_id = $1 and now() between p.starts_at and p.ends_at
     order by p.position, p.starts_at limit 1`,
    [productId],
  );
  return rows[0] ? promotionView(rows[0]) : null;
}
