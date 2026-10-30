// The managed home: the new promotion places and their look, GIF uploads, the linked offer's terms, and ratings.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import * as g from '../lib/gallery.ts';
import * as data from '../lib/data.ts';
import { createOffer } from '../lib/catalog.ts';
import { placeOrder, hashToken, setOrderStatus, RuleError } from '../lib/orders.ts';
import { rateOrder, ratingOf } from '../lib/ratings.ts';
import { updateSettings } from '../lib/restaurant-settings.ts';
import { pool } from '../lib/db.ts';

const SALAD = '00000000-0000-4000-8000-000000000101';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const day = 86_400_000;
const now = () => new Date();
const GIF = Buffer.from('474946383961010001000000002c00000000010001000002024401003b', 'hex');

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: process.env, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => e instanceof RuleError && e.code === code);
}
const window = () => ({ startsAt: new Date(Date.now() - day).toISOString(), endsAt: new Date(Date.now() + 10 * day).toISOString() });

test('a GIF is accepted as a picture for a promotion; an unknown file is refused', async () => {
  const media = await g.addPromotionMedia(GIF, null);
  assert.equal(media.mime, 'image/gif');
  assert.match(media.url, /\.gif$/);
  await expectRule(g.addPromotionMedia(Buffer.from('this is not a picture at all'), null), 'bad_file_type');
});

test('the welcome pop-up can run on a linked offer alone, and shows its terms worked out from the offer', async () => {
  const offer = await createOffer({ nameEn: 'Welcome', nameAr: 'أهلاً', type: 'percent', value: 1000, code: 'HELLO10', minSubtotalMinor: 4000, maxDiscountMinor: 2000, ...window() });
  await g.createPromotion({ placement: 'welcome', offerId: offer.id, titleEn: 'A little treat for you', animation: 'zoom', frequency: 'once', ...window() });
  const live = await g.livePromotions();
  assert.equal(live.welcome?.look.animation, 'zoom');
  assert.equal(live.welcome?.look.frame, 'ticket', 'a welcome pop-up is a ticket unless staff choose otherwise');
  assert.equal(live.welcome?.offer?.headline.en, '10% OFF');
  assert.equal(live.welcome?.offer?.code, 'HELLO10');
  assert.equal(live.welcome?.offer?.minSpendMinor, 4000);
  assert.equal(live.welcome?.offer?.maxSavingMinor, 2000);
  assert.ok((live.welcome?.offer?.daysLeft ?? 0) >= 9);
  assert.equal(live.welcome?.media, null);
});

test('carousel slides keep their order, colour and time on screen', async () => {
  const gif = await g.addPromotionMedia(GIF, null);
  await g.createPromotion({ placement: 'carousel', titleEn: 'Free delivery over AED 60', colour: '#0f766e', durationSeconds: 4, position: 2, ...window() });
  await g.createPromotion({ placement: 'carousel', titleEn: 'Trays 20% off', mediaId: gif.id, animation: 'slide_left', position: 1, ...window() });
  const live = await g.livePromotions();
  assert.deepEqual(live.carousel.map((p) => p.title.en), ['Trays 20% off', 'Free delivery over AED 60']);
  assert.equal(live.carousel[1].look.colour, '#0F766E');
  assert.equal(live.carousel[1].look.durationSeconds, 4);
  assert.equal(live.carousel[0].media?.mime, 'image/gif');
});

test('the look settings are checked: known values, a readable colour, a sensible time, and something to show', async () => {
  await expectRule(g.createPromotion({ placement: 'carousel', titleEn: 'x', animation: 'spin', ...window() }), 'bad_input');
  await expectRule(g.createPromotion({ placement: 'carousel', titleEn: 'x', colour: '#FDE68A', ...window() }), 'low_contrast');
  await expectRule(g.createPromotion({ placement: 'carousel', titleEn: 'x', durationSeconds: 1, ...window() }), 'bad_input');
  await expectRule(g.createPromotion({ placement: 'strip', ...window() }), 'bad_input');
  await expectRule(g.createPromotion({ placement: 'hero', titleEn: 'No picture', ...window() }), 'bad_input');
});

test('a promotion tied to an offer stops showing when the offer ends', async () => {
  const offer = await createOffer({ nameEn: 'Short', nameAr: 'قصير', type: 'free_delivery', ...window() });
  await g.createPromotion({ placement: 'strip', offerId: offer.id, titleEn: 'Free delivery today', ...window() });
  assert.equal((await g.livePromotions()).strip?.offer?.headline.en, 'FREE DELIVERY');
  await pool.query(`update offers set active = false where id = $1`, [offer.id]);
  assert.equal((await g.livePromotions()).strip, null);
});

test('a customer rates their own order once it has reached them; the dish shows its score after the minimum', async () => {
  await updateSettings({ ratingMinCount: 2 }, 'staff');
  const orders = [];
  for (let i = 0; i < 2; i++) {
    const guest = await data.createGuestSession(hashToken(randomBytes(16).toString('hex')));
    await data.setCart(guest, [{ itemId: SALAD, qty: 1, note: '' }]);
    const order = await placeOrder({ guestId: guest, accountId: null, idempotencyKey: `rate-order-${i}-x`, channel: 'pickup', method: 'pay_on_arrival', addressId: null, locale: 'en' });
    orders.push({ guest, order });
  }
  const [a, b] = orders;
  await expectRule(rateOrder(a.order.id, a.guest, { stars: 5 }), 'not_finished');
  for (const { order } of orders) for (const to of ['accepted', 'preparing', 'ready', 'collected'] as const) await setOrderStatus(order.id, to);
  await expectRule(rateOrder(a.order.id, b.guest, { stars: 1 }), 'not_found');
  await expectRule(rateOrder(a.order.id, a.guest, { stars: 6 }), 'bad_input');
  await rateOrder(a.order.id, a.guest, { stars: 5, comment: 'Lovely' });
  const salad = () => data.getMenu().then((m) => m.flatMap((c) => c.items).find((i) => i.id === SALAD)!);
  assert.equal((await salad()).rating, null, 'one rating is below the minimum of two');
  await rateOrder(b.order.id, b.guest, { stars: 4 });
  assert.deepEqual((await salad()).rating, { average: 4.5, count: 2 });
  await rateOrder(b.order.id, b.guest, { stars: 2 });
  assert.deepEqual((await ratingOf(b.order.id)), { stars: 2, comment: '' }, 'a second rating replaces the first');
  assert.deepEqual((await salad()).rating, { average: 3.5, count: 2 });
});

test('button and icon style are restaurant settings, carried to the app', async () => {
  const { publicBrand } = await import('../lib/restaurant-settings.ts');
  await updateSettings({ buttonStyle: 'tonal', iconStyle: 'neutral' }, 'staff');
  const brand = await publicBrand();
  assert.equal(brand.buttonStyle, 'tonal');
  assert.equal(brand.iconStyle, 'neutral');
  await expectRule(updateSettings({ buttonStyle: 'neon' }, 'staff'), 'bad_input');
  await pool.end();
});
