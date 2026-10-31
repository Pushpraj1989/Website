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
  const [categories, items, offers, variants] = await Promise.all([
    pool.query('select id, name_en, name_ar, sort_order, active, illustration from categories where restaurant_id = $1 order by sort_order, name_en', [RESTAURANT_ID]),
    pool.query(
      `select i.*, cover.storage_key from menu_items i
       join categories c on c.id = i.category_id
       left join lateral (select m.storage_key from product_media pm join media m on m.id = pm.media_id
         where pm.menu_item_id = i.id and pm.is_primary limit 1) cover on true
       where c.restaurant_id = $1 order by i.sort_order, i.name_en`,
      [RESTAURANT_ID],
    ),
    pool.query('select * from offers where restaurant_id = $1 order by active desc, starts_at desc', [RESTAURANT_ID]),
    pool.query('select * from product_variants order by position, created_at'),
  ]);
  const variantsOf = (itemId: string) => variants.rows.filter((v) => v.item_id === itemId).map(variantView);
  return {
    categories: categories.rows.map((c) => ({ id: c.id, name: { en: c.name_en, ar: c.name_ar }, sortOrder: c.sort_order, active: c.active, illustration: c.illustration })),
    products: items.rows.map((i) => ({
      id: i.id,
      categoryId: i.category_id,
      name: { en: i.name_en, ar: i.name_ar },
      description: { en: i.description_en, ar: i.description_ar },
      priceMinor: i.base_price_minor,
      available: i.available,
      sortOrder: i.sort_order,
      imageUrl: imageUrl(i.storage_key),
      stock: i.stock,
      variants: variantsOf(i.id),
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
    perCustomerLimit: o.per_customer_limit ?? null,
    usedCount: o.used_count,
    maxDiscountMinor: o.max_discount_minor,
    active: o.active,
  };
}

// The bundled illustrations a category can show. The admin chooses one; the app only maps the key to its picture.
const ILLUSTRATIONS = ['dish', 'starters', 'mains', 'drinks', 'desserts'];

function illustrationKey(value: unknown): string {
  if (typeof value !== 'string' || !ILLUSTRATIONS.includes(value)) {
    throw new RuleError('Choose one of the category pictures.', 'bad_input', 400);
  }
  return value;
}

export async function createCategory(body: Record<string, unknown>) {
  const { rows } = await pool.query(
    `insert into categories (restaurant_id, name_en, name_ar, sort_order, active, illustration) values ($1,$2,$3,$4,$5,$6)
     returning id, name_en, name_ar, sort_order, active, illustration`,
    [RESTAURANT_ID, text(body.nameEn, 'English name', 60), text(body.nameAr, 'Arabic name', 60), int(body.sortOrder ?? 0, 'Sort order', 0, 999), bool(body.active, true), body.illustration === undefined ? 'dish' : illustrationKey(body.illustration)],
  );
  return rows[0];
}

export async function updateCategory(id: string, body: Record<string, unknown>) {
  const { rows } = await pool.query(
    `update categories set name_en = coalesce($2, name_en), name_ar = coalesce($3, name_ar),
       sort_order = coalesce($4, sort_order), active = coalesce($5, active), illustration = coalesce($7, illustration)
     where id = $1 and restaurant_id = $6 returning id`,
    [
      id,
      body.nameEn === undefined ? null : text(body.nameEn, 'English name', 60),
      body.nameAr === undefined ? null : text(body.nameAr, 'Arabic name', 60),
      body.sortOrder === undefined ? null : int(body.sortOrder, 'Sort order', 0, 999),
      typeof body.active === 'boolean' ? body.active : null,
      RESTAURANT_ID,
      body.illustration === undefined ? null : illustrationKey(body.illustration),
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
  // Stock left: a whole number, or empty (null) for "not counted".
  stock: body.stock === undefined ? undefined : body.stock === null || body.stock === '' ? null : int(body.stock, 'Stock', 0, 1_000_000),
});

export async function createProduct(body: Record<string, unknown>) {
  const f = productFields(body, false);
  const category = await pool.query('select 1 from categories where id = $1 and restaurant_id = $2', [f.categoryId, RESTAURANT_ID]);
  if (!category.rows[0]) throw new RuleError('Choose a category that exists.', 'bad_input', 400);
  const { rows } = await pool.query(
    `insert into menu_items (category_id, name_en, name_ar, description_en, description_ar, base_price_minor, available, sort_order, stock)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [f.categoryId, f.nameEn, f.nameAr, f.descEn, f.descAr, f.priceMinor, f.available, f.sortOrder, f.stock ?? null],
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
       available = coalesce($8, available), sort_order = coalesce($9, sort_order),
       stock = case when $10 then $11::int else stock end, updated_at = now()
     where id = $1`,
    [id, f.categoryId ?? null, f.nameEn ?? null, f.nameAr ?? null, f.descEn ?? null, f.descAr ?? null, f.priceMinor ?? null, f.available ?? null, f.sortOrder ?? null, f.stock !== undefined, f.stock ?? null],
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
       code, starts_at, ends_at, usage_limit, max_discount_minor, active, per_customer_limit)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
    [RESTAURANT_ID, v.nameEn, v.nameAr, v.type, v.value, v.appliesTo, v.audience, v.minSubtotalMinor, v.code, v.startsAt, v.endsAt, v.usageLimit, v.maxDiscountMinor, v.active, v.perCustomerLimit],
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
       active=$14, per_customer_limit=$15, updated_at=now() where id=$1 returning *`,
    [id, v.nameEn, v.nameAr, v.type, v.value, v.appliesTo, v.audience, v.minSubtotalMinor, v.code, v.startsAt, v.endsAt, v.usageLimit, v.maxDiscountMinor, v.active, v.perCustomerLimit],
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
  // How many times one customer may use it; empty means no limit per customer.
  const perCustomerLimit = body.perCustomerLimit === undefined || body.perCustomerLimit === null || body.perCustomerLimit === '' ? null : int(body.perCustomerLimit, 'Uses per customer', 1, 1000);
  if (perCustomerLimit !== null && usageLimit !== null && perCustomerLimit > usageLimit) {
    throw new RuleError('Uses per customer cannot be more than the uses in total.', 'bad_input', 400);
  }
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
    perCustomerLimit,
    maxDiscountMinor: maxDiscount,
    active: bool(body.active, true),
  };
}

// ---------- Variants (retail mode): one product in versions, each with its own price and stock ----------

export const MAX_VARIANTS = 50;

export function variantView(v: Record<string, any>) {
  return { id: v.id, name: { en: v.name_en, ar: v.name_ar }, sku: v.sku, priceMinor: v.price_minor, stock: v.stock, active: v.active, position: v.position };
}

/**
 * Replaces a product's variants with the list sent, in that order. Variants sent with an id are updated; without one,
 * added; left out, removed (or switched off when they have been ordered, so order history keeps them).
 */
export async function saveVariants(itemId: string, raw: unknown) {
  if (!Array.isArray(raw)) throw new RuleError('Send the variants as a list.', 'bad_input', 400);
  if (raw.length > MAX_VARIANTS) throw new RuleError(`A product can have up to ${MAX_VARIANTS} variants.`, 'bad_input', 400);
  const list = raw.map((r, i) => {
    const v = (r ?? {}) as Record<string, unknown>;
    const name = (v.name ?? {}) as { en?: unknown; ar?: unknown };
    return {
      id: typeof v.id === 'string' && /^[0-9a-f-]{36}$/.test(v.id) ? v.id : null,
      nameEn: text(name.en ?? v.nameEn, `Variant ${i + 1}: English name`, 60),
      nameAr: text(name.ar ?? v.nameAr, `Variant ${i + 1}: Arabic name`, 60),
      sku: text(v.sku ?? '', `Variant ${i + 1}: SKU`, 40, false),
      priceMinor: int(v.priceMinor, `Variant ${i + 1}: Price`, 0, 1_000_000_000),
      stock: v.stock === null || v.stock === undefined || v.stock === '' ? null : int(v.stock, `Variant ${i + 1}: Stock`, 0, 1_000_000),
      active: bool(v.active, true),
    };
  });
  const names = new Set<string>();
  for (const v of list) {
    const key = v.nameEn.toLowerCase();
    if (names.has(key)) throw new RuleError(`Two variants are both called "${v.nameEn}". Give each a different name.`, 'bad_input', 400);
    names.add(key);
  }
  return withTx(async (c) => {
    const item = await c.query('select 1 from menu_items i join categories c on c.id = i.category_id where i.id = $1 and c.restaurant_id = $2 for update', [itemId, RESTAURANT_ID]);
    if (!item.rows[0]) throw new RuleError('Product not found.', 'not_found', 404);
    const existing = await c.query('select id from product_variants where item_id = $1', [itemId]);
    const keep = new Set(list.map((v) => v.id).filter(Boolean));
    for (const row of existing.rows) {
      if (keep.has(row.id)) continue;
      const used = await c.query('select 1 from order_lines where variant_id = $1 limit 1', [row.id]);
      if (used.rows[0]) await c.query('update product_variants set active = false, position = 9999 where id = $1', [row.id]);
      else await c.query('delete from product_variants where id = $1', [row.id]);
    }
    for (const [position, v] of list.entries()) {
      if (v.id && existing.rows.some((r) => r.id === v.id)) {
        await c.query(
          'update product_variants set name_en=$2, name_ar=$3, sku=$4, price_minor=$5, stock=$6, active=$7, position=$8 where id=$1',
          [v.id, v.nameEn, v.nameAr, v.sku, v.priceMinor, v.stock, v.active, position],
        );
      } else {
        await c.query(
          'insert into product_variants (item_id, name_en, name_ar, sku, price_minor, stock, active, position) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [itemId, v.nameEn, v.nameAr, v.sku, v.priceMinor, v.stock, v.active, position],
        );
      }
    }
    const saved = await c.query('select * from product_variants where item_id = $1 order by position, created_at', [itemId]);
    return saved.rows.map(variantView);
  });
}
