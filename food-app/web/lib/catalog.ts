// Admin catalogue: categories, products, product images and offers. Staff only; the routes check the session.
import { pool, withTx } from './db.ts';
import { join } from 'node:path';

export const storageDir = () => join(process.cwd(), 'storage', 'media');
import { RuleError } from './orders.ts';

export const RESTAURANT_ID = '00000000-0000-4000-8000-000000000001';

export type Localised = { en: string; ar: string };

const text = (v: unknown, field: string, max: number, required = true): string => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && (s.length === 0 || s.length > max)) throw new RuleError(`${field} is required (up to ${max} characters).`, 'bad_input', 400);
  if (s.length > max) throw new RuleError(`${field} is too long (up to ${max} characters).`, 'bad_input', 400);
  return s;
};
const int = (v: unknown, field: string, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new RuleError(`${field} must be a whole number from ${min} to ${max}.`, 'bad_input', 400);
  return n;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export function imageUrl(storageKey: string | null): string | null {
  return storageKey ? `/media/${storageKey}` : null;
}

export async function adminCatalog() {
  const [categories, items, offers] = await Promise.all([
    pool.query('select id, name_en, name_ar, sort_order, active from categories where restaurant_id = $1 order by sort_order, name_en', [RESTAURANT_ID]),
    pool.query(
      `select i.*, cover.storage_key from menu_items i
       join categories c on c.id = i.category_id
       left join lateral (select m.storage_key from product_media pm join media m on m.id = pm.media_id
         where pm.menu_item_id = i.id and pm.is_primary limit 1) cover on true
       where c.restaurant_id = $1 order by i.sort_order, i.name_en`,
      [RESTAURANT_ID],
    ),
    pool.query('select * from offers where restaurant_id = $1 order by active desc, starts_at desc', [RESTAURANT_ID]),
  ]);
  return {
    categories: categories.rows.map((c) => ({ id: c.id, name: { en: c.name_en, ar: c.name_ar }, sortOrder: c.sort_order, active: c.active })),
    products: items.rows.map((i) => ({
      id: i.id,
      categoryId: i.category_id,
      name: { en: i.name_en, ar: i.name_ar },
      description: { en: i.description_en, ar: i.description_ar },
      priceMinor: i.base_price_minor,
      available: i.available,
      sortOrder: i.sort_order,
      imageUrl: imageUrl(i.storage_key),
    })),
    offers: offers.rows.map(offerView),
  };
}

export function offerView(o: Record<string, any>) {
  return {
    id: o.id,
    name: { en: o.name_en, ar: o.name_ar },
    type: o.offer_type,
    value: o.value_int,
    appliesTo: o.applies_to,
    audience: o.audience,
    minSubtotalMinor: o.min_subtotal_minor,
    code: o.code,
    startsAt: new Date(o.starts_at).toISOString(),
    endsAt: new Date(o.ends_at).toISOString(),
    usageLimit: o.usage_limit,
    usedCount: o.used_count,
    maxDiscountMinor: o.max_discount_minor,
    active: o.active,
  };
}

export async function createCategory(body: Record<string, unknown>) {
  const { rows } = await pool.query(
    `insert into categories (restaurant_id, name_en, name_ar, sort_order, active) values ($1,$2,$3,$4,$5)
     returning id, name_en, name_ar, sort_order, active`,
    [RESTAURANT_ID, text(body.nameEn, 'English name', 60), text(body.nameAr, 'Arabic name', 60), int(body.sortOrder ?? 0, 'Sort order', 0, 999), bool(body.active, true)],
  );
  return rows[0];
}

export async function updateCategory(id: string, body: Record<string, unknown>) {
  const { rows } = await pool.query(
    `update categories set name_en = coalesce($2, name_en), name_ar = coalesce($3, name_ar),
       sort_order = coalesce($4, sort_order), active = coalesce($5, active)
     where id = $1 and restaurant_id = $6 returning id`,
    [
      id,
      body.nameEn === undefined ? null : text(body.nameEn, 'English name', 60),
      body.nameAr === undefined ? null : text(body.nameAr, 'Arabic name', 60),
      body.sortOrder === undefined ? null : int(body.sortOrder, 'Sort order', 0, 999),
      typeof body.active === 'boolean' ? body.active : null,
      RESTAURANT_ID,
    ],
  );
  if (!rows[0]) throw new RuleError('Category not found.', 'not_found', 404);
  return rows[0];
}

const productFields = (body: Record<string, unknown>, partial: boolean) => ({
  categoryId: body.categoryId === undefined && partial ? undefined : text(body.categoryId, 'Category', 36),
  nameEn: body.nameEn === undefined && partial ? undefined : text(body.nameEn, 'English name', 80),
  nameAr: body.nameAr === undefined && partial ? undefined : text(body.nameAr, 'Arabic name', 80),
  descEn: body.descriptionEn === undefined && partial ? undefined : text(body.descriptionEn ?? '', 'English description', 300, false),
  descAr: body.descriptionAr === undefined && partial ? undefined : text(body.descriptionAr ?? '', 'Arabic description', 300, false),
  priceMinor: body.priceMinor === undefined && partial ? undefined : int(body.priceMinor, 'Price', 0, 1_000_000_000),
  available: body.available === undefined && partial ? undefined : bool(body.available, true),
  sortOrder: body.sortOrder === undefined && partial ? undefined : int(body.sortOrder ?? 0, 'Sort order', 0, 999),
});

export async function createProduct(body: Record<string, unknown>) {
  const f = productFields(body, false);
  const category = await pool.query('select 1 from categories where id = $1 and restaurant_id = $2', [f.categoryId, RESTAURANT_ID]);
  if (!category.rows[0]) throw new RuleError('Choose a category that exists.', 'bad_input', 400);
  const { rows } = await pool.query(
    `insert into menu_items (category_id, name_en, name_ar, description_en, description_ar, base_price_minor, available, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [f.categoryId, f.nameEn, f.nameAr, f.descEn, f.descAr, f.priceMinor, f.available, f.sortOrder],
  );
  return rows[0];
}

export async function updateProduct(id: string, body: Record<string, unknown>) {
  const f = productFields(body, true);
  if (f.categoryId !== undefined) {
    const category = await pool.query('select 1 from categories where id = $1 and restaurant_id = $2', [f.categoryId, RESTAURANT_ID]);
    if (!category.rows[0]) throw new RuleError('Choose a category that exists.', 'bad_input', 400);
  }
  const { rowCount } = await pool.query(
    `update menu_items set category_id = coalesce($2, category_id), name_en = coalesce($3, name_en),
       name_ar = coalesce($4, name_ar), description_en = coalesce($5, description_en),
       description_ar = coalesce($6, description_ar), base_price_minor = coalesce($7, base_price_minor),
       available = coalesce($8, available), sort_order = coalesce($9, sort_order), updated_at = now()
     where id = $1`,
    [id, f.categoryId ?? null, f.nameEn ?? null, f.nameAr ?? null, f.descEn ?? null, f.descAr ?? null, f.priceMinor ?? null, f.available ?? null, f.sortOrder ?? null],
  );
  if (!rowCount) throw new RuleError('Product not found.', 'not_found', 404);
}

/** A product that has ever been ordered is hidden, not deleted: order history must keep its lines. */
export async function deleteProduct(id: string): Promise<'deleted' | 'hidden'> {
  const used = await pool.query('select 1 from order_lines where menu_item_id = $1 limit 1', [id]);
  if (used.rows[0]) {
    await pool.query('update menu_items set available = false where id = $1', [id]);
    return 'hidden';
  }
  const { rowCount } = await pool.query('delete from menu_items where id = $1', [id]);
  if (!rowCount) throw new RuleError('Product not found.', 'not_found', 404);
  return 'deleted';
}

export async function createOffer(body: Record<string, unknown>) {
  const v = validateOffer(body);
  const { rows } = await pool.query(
    `insert into offers (restaurant_id, name_en, name_ar, offer_type, value_int, applies_to, audience, min_subtotal_minor,
       code, starts_at, ends_at, usage_limit, max_discount_minor, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
    [RESTAURANT_ID, v.nameEn, v.nameAr, v.type, v.value, v.appliesTo, v.audience, v.minSubtotalMinor, v.code, v.startsAt, v.endsAt, v.usageLimit, v.maxDiscountMinor, v.active],
  );
  return offerView(rows[0]);
}

export async function updateOffer(id: string, body: Record<string, unknown>) {
  const current = await pool.query('select * from offers where id = $1 and restaurant_id = $2', [id, RESTAURANT_ID]);
  if (!current.rows[0]) throw new RuleError('Offer not found.', 'not_found', 404);
  // Fields not sent keep their stored value; the merged result goes through the same checks as a create.
  const current_ = offerView(current.rows[0]);
  const merged = { ...current_, ...body };
  const v = validateOffer({ ...merged, nameEn: body.nameEn ?? current_.name.en, nameAr: body.nameAr ?? current_.name.ar });
  const { rows } = await pool.query(
    `update offers set name_en=$2, name_ar=$3, offer_type=$4, value_int=$5, applies_to=$6, audience=$7,
       min_subtotal_minor=$8, code=$9, starts_at=$10, ends_at=$11, usage_limit=$12, max_discount_minor=$13,
       active=$14, updated_at=now() where id=$1 returning *`,
    [id, v.nameEn, v.nameAr, v.type, v.value, v.appliesTo, v.audience, v.minSubtotalMinor, v.code, v.startsAt, v.endsAt, v.usageLimit, v.maxDiscountMinor, v.active],
  );
  return offerView(rows[0]);
}

export async function deleteOffer(id: string): Promise<'deleted' | 'stopped'> {
  const used = await pool.query('select used_count from offers where id = $1 and restaurant_id = $2', [id, RESTAURANT_ID]);
  if (!used.rows[0]) throw new RuleError('Offer not found.', 'not_found', 404);
  if (used.rows[0].used_count > 0) {
    await pool.query('update offers set active = false, updated_at = now() where id = $1', [id]);
    return 'stopped';
  }
  await pool.query('delete from offers where id = $1', [id]);
  return 'deleted';
}

/** Validates an offer the same way for create and update. Matches the table's checks, with a readable message. */
export function validateOffer(body: Record<string, unknown>) {
  const type = String(body.type ?? body.offerType ?? '');
  if (!['percent', 'fixed', 'free_delivery', 'item_free', 'bundle'].includes(type)) throw new RuleError('Choose an offer type.', 'bad_input', 400);
  const value = type === 'free_delivery' ? 0 : int(body.value ?? 0, 'Value', 0, 10_000_000);
  if (type === 'percent' && value > 10000) throw new RuleError('A percentage offer can be at most 100%.', 'bad_input', 400);
  const startsAt = new Date(String(body.startsAt ?? ''));
  const endsAt = new Date(String(body.endsAt ?? ''));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new RuleError('The end time must be after the start time.', 'bad_input', 400);
  }
  const appliesTo = String(body.appliesTo ?? 'order');
  if (!['order', 'category', 'item'].includes(appliesTo)) throw new RuleError('Choose what the offer applies to.', 'bad_input', 400);
  const audience = String(body.audience ?? 'any');
  if (!['guest', 'member', 'any'].includes(audience)) throw new RuleError('Choose who can use the offer.', 'bad_input', 400);
  const code = body.code === undefined || body.code === '' || body.code === null ? null : text(body.code, 'Code', 30).toUpperCase().replace(/\s+/g, '');
  const usageLimit = body.usageLimit === undefined || body.usageLimit === null || body.usageLimit === '' ? null : int(body.usageLimit, 'Usage limit', 0, 1_000_000);
  const maxDiscount = body.maxDiscountMinor === undefined || body.maxDiscountMinor === null || body.maxDiscountMinor === '' ? null : int(body.maxDiscountMinor, 'Maximum discount', 0, 1_000_000_000);
  return {
    nameEn: text(body.nameEn ?? (body.name as { en?: string } | undefined)?.en, 'English name', 80),
    nameAr: text(body.nameAr ?? (body.name as { ar?: string } | undefined)?.ar, 'Arabic name', 80),
    type,
    value,
    appliesTo,
    audience,
    minSubtotalMinor: int(body.minSubtotalMinor ?? 0, 'Minimum order', 0, 1_000_000_000),
    code,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    usageLimit,
    maxDiscountMinor: maxDiscount,
    active: bool(body.active, true),
  };
}
