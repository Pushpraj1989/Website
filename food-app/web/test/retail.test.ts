// Retail mode: the restaurant/shop switch, product variants and counted stock, through the same functions the API
// uses. Runs against the test database and resets it first. Run: node --test test/retail.test.ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import * as data from '../lib/data.ts';
import { adminCatalog, createProduct, saveVariants, updateProduct } from '../lib/catalog.ts';
import { getSettings, publicBrand, updateSettings } from '../lib/restaurant-settings.ts';
import { hashToken, placeOrder, quoteFor, setOrderStatus, validateCart } from '../lib/orders.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const MAINS = '00000000-0000-4000-8000-000000000020';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
let key = 0;

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string, message?: RegExp) {
  try {
    await promise;
  } catch (err) {
    assert.equal((err as { code?: string }).code, code, (err as Error).message);
    if (message) assert.match((err as Error).message, message);
    return;
  }
  assert.fail(`expected a ${code} error`);
}

async function guest(lines: { itemId: string; variantId?: string; qty: number }[]) {
  const id = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
  await data.setCart(id, validateCart(lines.map((l) => ({ ...l, note: '' }))));
  return id;
}

const order = (guestId: string) =>
  placeOrder({ guestId, idempotencyKey: `retail-${++key}-${Date.now()}`, channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });

/** A T-shirt in three sizes: S and M counted, L not counted. */
async function tshirt() {
  const { id } = await createProduct({ categoryId: MAINS, nameEn: 'Classic T-shirt', nameAr: 'تيشيرت كلاسيك', priceMinor: 5000 });
  const variants = await saveVariants(id, [
    { name: { en: 'S', ar: 'صغير' }, sku: 'TS-S', priceMinor: 4500, stock: 2 },
    { name: { en: 'M', ar: 'وسط' }, sku: 'TS-M', priceMinor: 5000, stock: 1 },
    { name: { en: 'L', ar: 'كبير' }, sku: 'TS-L', priceMinor: 5500, stock: null },
  ]);
  return { id, s: variants[0], m: variants[1], l: variants[2] };
}

const variantStock = async (id: string) => (await db.query('select stock from product_variants where id = $1', [id])).rows[0].stock;
const itemStock = async (id: string) => (await db.query('select stock from menu_items where id = $1', [id])).rows[0].stock;

test('the switch: restaurant by default, shop on request, anything else refused', async () => {
  assert.equal((await getSettings()).businessType, 'restaurant');
  await updateSettings({ businessType: 'shop' }, 'test');
  assert.equal((await publicBrand()).businessType, 'shop');
  await expectRule(updateSettings({ businessType: 'garage' }, 'test'), 'bad_input');
  await updateSettings({ businessType: 'restaurant' }, 'test');
  assert.equal((await getSettings()).businessType, 'restaurant');
});

test('variants: saved in order, shown "from" the lowest price, names must differ', async () => {
  const t = await tshirt();
  const item = (await data.getMenu()).flatMap((c) => c.items).find((i) => i.id === t.id)!;
  assert.deepEqual(item.variants.map((v) => v.name.en), ['S', 'M', 'L']);
  assert.equal(item.priceMinor, 4500, 'the lowest variant price');
  assert.equal(item.soldOut, false);
  await expectRule(saveVariants(t.id, [{ name: { en: 'S', ar: 'a' }, priceMinor: 1 }, { name: { en: 's', ar: 'b' }, priceMinor: 1 }]), 'bad_input', /different name/);
  await expectRule(saveVariants(t.id, [{ name: { en: 'S', ar: 'a' }, priceMinor: -5 }]), 'bad_input');
  await expectRule(saveVariants('00000000-0000-4000-8000-00000000ffff', []), 'not_found');
  const catalogue = await adminCatalog();
  assert.equal(catalogue.products.find((p) => p.id === t.id)!.variants.length, 3);
});

test('pricing: a product in versions needs a variant, and is priced and named by it', async () => {
  const t = await tshirt();
  await expectRule(quoteFor(await guest([{ itemId: t.id, qty: 1 }]), 'pickup'), 'variant_required');
  const g = await guest([{ itemId: t.id, variantId: t.l.id, qty: 2 }]);
  const { quote } = await quoteFor(g, 'pickup');
  assert.equal(quote.subtotalMinor, 11000);
  const placed = await order(g);
  assert.equal(placed.lines[0].name.en, 'Classic T-shirt · L');
  assert.equal(placed.subtotalMinor, 11000);
  // Someone else's variant id on this product is refused, as is a variant on a product without variants.
  const other = await tshirt();
  await expectRule(quoteFor(await guest([{ itemId: t.id, variantId: other.s.id, qty: 1 }]), 'pickup'), 'variant_required');
  await expectRule(quoteFor(await guest([{ itemId: '00000000-0000-4000-8000-000000000101', variantId: t.s.id, qty: 1 }]), 'pickup'), 'item_missing');
  assert.throws(() => validateCart([{ itemId: t.id, variantId: 'not-a-uuid', qty: 1, note: '' }]), /not valid/);
});

test('stock: taken by an order, refused beyond what is left, sold out at zero, given back on cancel', async () => {
  const t = await tshirt();
  await expectRule(order(await guest([{ itemId: t.id, variantId: t.s.id, qty: 3 }])), 'out_of_stock', /Only 2 left/);
  const first = await order(await guest([{ itemId: t.id, variantId: t.s.id, qty: 2 }]));
  assert.equal(await variantStock(t.s.id), 0);
  await expectRule(order(await guest([{ itemId: t.id, variantId: t.s.id, qty: 1 }])), 'sold_out');
  const shown = (await data.getItems([t.id])).get(t.id)!;
  assert.equal(shown.variants.find((v) => v.id === t.s.id)!.soldOut, true);
  assert.equal(shown.soldOut, false, 'other sizes are still in stock');
  // The uncounted size is never limited.
  await order(await guest([{ itemId: t.id, variantId: t.l.id, qty: 5 }]));
  assert.equal(await variantStock(t.l.id), null);
  // Cancelling gives the two back.
  await setOrderStatus(first.id, 'cancelled');
  assert.equal(await variantStock(t.s.id), 2);
});

test('stock: a product without variants counts down and shows sold out at zero', async () => {
  const { id } = await createProduct({ categoryId: MAINS, nameEn: 'Whey protein 1 kg', nameAr: 'بروتين', priceMinor: 12000, stock: 1 });
  assert.equal(await itemStock(id), 1);
  await order(await guest([{ itemId: id, qty: 1 }]));
  assert.equal(await itemStock(id), 0);
  assert.equal((await data.getItems([id])).get(id)!.soldOut, true);
  await expectRule(order(await guest([{ itemId: id, qty: 1 }])), 'sold_out');
  // Restocking from the console brings it back; empty stock means "not counted".
  await updateProduct(id, { stock: 5 });
  assert.equal((await data.getItems([id])).get(id)!.soldOut, false);
  await updateProduct(id, { stock: null });
  assert.equal(await itemStock(id), null);
  await updateProduct(id, { priceMinor: 12500 });
  assert.equal(await itemStock(id), null, 'an edit that does not send stock leaves it alone');
});

test('stock: two customers racing for the last one, only one gets it', async () => {
  const t = await tshirt();
  const [a, b] = [await guest([{ itemId: t.id, variantId: t.m.id, qty: 1 }]), await guest([{ itemId: t.id, variantId: t.m.id, qty: 1 }])];
  const results = await Promise.allSettled([order(a), order(b)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code, 'sold_out');
  assert.equal(await variantStock(t.m.id), 0);
});

test('variants: one that was ordered is switched off, not deleted, when removed', async () => {
  const t = await tshirt();
  await order(await guest([{ itemId: t.id, variantId: t.l.id, qty: 1 }]));
  const kept = await saveVariants(t.id, [{ id: t.s.id, name: { en: 'Small', ar: 'صغير' }, priceMinor: 4000, stock: 9 }]);
  const all = (await db.query('select name_en, active from product_variants where item_id = $1 order by position', [t.id])).rows;
  assert.deepEqual(kept.map((v) => [v.name.en, v.active]), [['Small', true], ['L', false]], 'staff still see the switched-off size');
  assert.ok(all.some((v) => v.name_en === 'L' && v.active === false), 'the ordered size stays for order history');
  assert.ok(!all.some((v) => v.name_en === 'M'), 'the never-ordered size is deleted');
  const item = (await data.getItems([t.id])).get(t.id)!;
  assert.deepEqual(item.variants.map((v) => v.name.en), ['Small'], 'customers only see active variants');
});
