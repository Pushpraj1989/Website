// The restaurant's own settings: who it is (name, tagline, logo, colour, contact) and how it takes orders (payments,
// cash limit, service fee). Staff edit them in the admin; the customer app and the admin read them from the API, so
// one build serves any restaurant.
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pool, withTx } from './db.ts';
import { RuleError } from './orders.ts';
import { RESTAURANT_ID, storageDir } from './catalog.ts';
import { sniff, urlFor } from './gallery.ts';
import { recordAudit } from './audit.ts';
import { stripeConfigured } from './payments/stripe.ts';

export const MAX_LOGO_BYTES = 1024 * 1024;
/** The looks a restaurant can choose. Each works with any brand colour the settings accept. */
export const THEMES = ['classic', 'midnight', 'glass', 'glass_night'] as const;
export type Theme = (typeof THEMES)[number];

export type RestaurantSettings = {
  name: { en: string; ar: string };
  tagline: { en: string; ar: string };
  phone: string;
  address: { en: string; ar: string };
  brandColor: string;
  theme: Theme;
  logoUrl: string | null;
  currency: string;
  taxLabel: string;
  taxBasisPoints: number;
  serviceFeeMinor: number;
  cashLimitMinor: number;
  payments: { cod: boolean; payOnArrival: boolean; card: boolean };
  cardAvailable: boolean;
};

const SQL = `
  select r.name_en, r.name_ar, r.tagline_en, r.tagline_ar, r.phone, r.address_en, r.address_ar, r.brand_color, r.theme,
         r.currency_code, r.tax_label, r.tax_basis_points, r.service_fee_minor, r.cash_limit_minor,
         r.accepts_cod, r.accepts_pay_on_arrival, r.accepts_card, m.storage_key as logo_key
  from restaurant r left join media m on m.id = r.logo_media_id
  where r.id = $1`;

export async function getSettings(): Promise<RestaurantSettings> {
  const { rows } = await pool.query(SQL, [RESTAURANT_ID]);
  const r = rows[0];
  if (!r) throw new RuleError('The restaurant is not set up yet.', 'not_found', 404);
  return {
    name: { en: r.name_en, ar: r.name_ar },
    tagline: { en: r.tagline_en, ar: r.tagline_ar },
    phone: r.phone,
    address: { en: r.address_en, ar: r.address_ar },
    brandColor: r.brand_color,
    theme: r.theme,
    logoUrl: r.logo_key ? urlFor(r.logo_key) : null,
    currency: r.currency_code,
    taxLabel: r.tax_label,
    taxBasisPoints: r.tax_basis_points,
    serviceFeeMinor: r.service_fee_minor,
    cashLimitMinor: r.cash_limit_minor,
    payments: { cod: r.accepts_cod, payOnArrival: r.accepts_pay_on_arrival, card: r.accepts_card },
    cardAvailable: stripeConfigured(),
  };
}

/** What the customer app needs to look like this restaurant. Public. */
export async function publicBrand() {
  const s = await getSettings();
  return { name: s.name, tagline: s.tagline, logoUrl: s.logoUrl, color: s.brandColor, theme: s.theme, phone: s.phone, address: s.address };
}

/** Relative luminance of a #RRGGBB colour (WCAG 2.2 definition). */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Contrast ratio between white text and the colour. Buttons use white text on the brand colour. */
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

function text(value: unknown, label: string, min: number, max: number): string {
  const s = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (s.length < min || s.length > max) {
    throw new RuleError(min > 0 ? `${label} must be ${min} to ${max} characters.` : `${label} can be up to ${max} characters.`, 'bad_input', 400);
  }
  return s;
}

function minor(value: unknown, label: string, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new RuleError(`${label} must be a whole amount from 0 to ${max / 100}.`, 'bad_input', 400);
  return n;
}

export async function updateSettings(body: Record<string, unknown>, actor: string): Promise<RestaurantSettings> {
  const current = await getSettings();
  const name = body.name as { en?: unknown; ar?: unknown } | undefined;
  const tagline = body.tagline as { en?: unknown; ar?: unknown } | undefined;
  const address = body.address as { en?: unknown; ar?: unknown } | undefined;
  const payments = body.payments as { cod?: unknown; payOnArrival?: unknown; card?: unknown } | undefined;
  const next = {
    nameEn: name?.en === undefined ? current.name.en : text(name.en, 'The English name', 2, 80),
    nameAr: name?.ar === undefined ? current.name.ar : text(name.ar, 'The Arabic name', 2, 80),
    taglineEn: tagline?.en === undefined ? current.tagline.en : text(tagline.en, 'The English tagline', 0, 120),
    taglineAr: tagline?.ar === undefined ? current.tagline.ar : text(tagline.ar, 'The Arabic tagline', 0, 120),
    phone: body.phone === undefined ? current.phone : text(body.phone, 'The phone number', 6, 30),
    addressEn: address?.en === undefined ? current.address.en : text(address.en, 'The English address', 0, 200),
    addressAr: address?.ar === undefined ? current.address.ar : text(address.ar, 'The Arabic address', 0, 200),
    brandColor: body.brandColor === undefined ? current.brandColor : String(body.brandColor).trim().toUpperCase(),
    theme: (body.theme === undefined ? current.theme : body.theme) as Theme,
    serviceFeeMinor: body.serviceFeeMinor === undefined ? current.serviceFeeMinor : minor(body.serviceFeeMinor, 'The service fee', 100_000),
    cashLimitMinor: body.cashLimitMinor === undefined ? current.cashLimitMinor : minor(body.cashLimitMinor, 'The cash limit', 10_000_000),
    cod: payments?.cod === undefined ? current.payments.cod : payments.cod === true,
    payOnArrival: payments?.payOnArrival === undefined ? current.payments.payOnArrival : payments.payOnArrival === true,
    card: payments?.card === undefined ? current.payments.card : payments.card === true,
  };
  if (!/^#[0-9A-F]{6}$/.test(next.brandColor)) throw new RuleError('Enter the colour as # and six hex digits, like #B45309.', 'bad_input', 400);
  // Buttons put white text on the brand colour; below 4.5:1 that text is hard to read (WCAG 2.2 AA).
  if (contrastWithWhite(next.brandColor) < 4.5) {
    throw new RuleError('That colour is too light for white button text. Choose a darker shade.', 'low_contrast', 400);
  }
  if (!THEMES.includes(next.theme)) throw new RuleError('Choose one of the themes.', 'bad_input', 400);
  if (payments?.card === true && !current.payments.card && !stripeConfigured()) throw new RuleError('Card payment needs the payment provider set up first.', 'card_unavailable', 422);
  if (!next.cod && !next.payOnArrival && !next.card) throw new RuleError('Keep at least one way to pay switched on.', 'bad_input', 400);

  await withTx(async (c) => {
    await c.query(
      `update restaurant set name_en=$2, name_ar=$3, tagline_en=$4, tagline_ar=$5, phone=$6, address_en=$7, address_ar=$8,
         brand_color=$9, service_fee_minor=$10, cash_limit_minor=$11, accepts_cod=$12, accepts_pay_on_arrival=$13,
         accepts_card=$14, theme=$15, updated_at=now()
       where id=$1`,
      [RESTAURANT_ID, next.nameEn, next.nameAr, next.taglineEn, next.taglineAr, next.phone, next.addressEn, next.addressAr,
        next.brandColor, next.serviceFeeMinor, next.cashLimitMinor, next.cod, next.payOnArrival, next.card, next.theme],
    );
    const changed = Object.keys(body).filter((k) => ['name', 'tagline', 'phone', 'address', 'brandColor', 'theme', 'serviceFeeMinor', 'cashLimitMinor', 'payments'].includes(k));
    await recordAudit(c, actor, 'restaurant_settings_changed', 'restaurant', RESTAURANT_ID, { fields: changed });
  });
  return getSettings();
}

/** Sets the logo from an uploaded picture. The old logo file is removed. */
export async function setLogo(bytes: Buffer, actor: string): Promise<RestaurantSettings> {
  const kind = sniff(bytes);
  if (kind.kind !== 'image') throw new RuleError('Upload the logo as a PNG, JPEG or WebP picture.', 'bad_file_type', 415);
  if (bytes.length > MAX_LOGO_BYTES) throw new RuleError('The logo is larger than 1 MB. Use a smaller file.', 'too_large', 413);
  const key = `${randomUUID()}.${kind.ext}`;
  mkdirSync(storageDir(), { recursive: true });
  writeFileSync(join(storageDir(), key), bytes);
  const old = await withTx(async (c) => {
    const media = await c.query(
      `insert into media (kind, storage_key, mime, alt_en, alt_ar, size_bytes) values ('image', $1, $2, 'Logo', 'الشعار', $3) returning id`,
      [key, kind.mime, bytes.length],
    );
    const prev = await c.query(`select m.id, m.storage_key from restaurant r join media m on m.id = r.logo_media_id where r.id = $1`, [RESTAURANT_ID]);
    await c.query('update restaurant set logo_media_id = $2, updated_at = now() where id = $1', [RESTAURANT_ID, media.rows[0].id]);
    if (prev.rows[0]) await c.query('delete from media where id = $1', [prev.rows[0].id]);
    await recordAudit(c, actor, 'restaurant_logo_changed', 'restaurant', RESTAURANT_ID);
    return prev.rows[0]?.storage_key as string | undefined;
  });
  removeFile(old);
  return getSettings();
}

export async function removeLogo(actor: string): Promise<RestaurantSettings> {
  const old = await withTx(async (c) => {
    const prev = await c.query(`select m.id, m.storage_key from restaurant r join media m on m.id = r.logo_media_id where r.id = $1`, [RESTAURANT_ID]);
    await c.query('update restaurant set logo_media_id = null, updated_at = now() where id = $1', [RESTAURANT_ID]);
    if (prev.rows[0]) await c.query('delete from media where id = $1', [prev.rows[0].id]);
    await recordAudit(c, actor, 'restaurant_logo_removed', 'restaurant', RESTAURANT_ID);
    return prev.rows[0]?.storage_key as string | undefined;
  });
  removeFile(old);
  return getSettings();
}

function removeFile(key: string | undefined) {
  if (!key) return;
  const file = join(storageDir(), key);
  if (existsSync(file)) unlinkSync(file);
}
