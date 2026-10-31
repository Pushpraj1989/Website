// Fills the sample restaurant with the demo pictures and videos the app ships with, so the website, the app and the
// console all show the same food, and makes a demo customer account. Run after pilot-setup.ts and home-setup.ts, on
// a database that still has the sample menu (deploy/load-demo.sh runs all three):
//   DATABASE_URL=... node --experimental-strip-types scripts/demo-setup.ts [demo-customer@example.com]
// - Each sample dish gets its category's photo; Grilled chicken plate and Mint lemonade get a video behind them.
// - Two hero slides with cooking videos and a spotlight, as in the app.
// - With an email: a demo customer account (email already confirmed) holding one printed voucher. Signing in sends
//   a code to that email, so it must be a mailbox you can read.
// Everything can be changed or removed in the console afterwards. Running it again changes nothing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from '../lib/db.ts';
import { RESTAURANT_ID, updateCategory } from '../lib/catalog.ts';
import { addProductMedia, addPromotionMedia, createPromotion } from '../lib/gallery.ts';
import { accountByEmail, createAccountWithEmail } from '../lib/accounts.ts';
import { saveVoucher } from '../lib/wallet.ts';
import { codeOf } from '../lib/print.ts';

const asset = (path: string) => readFileSync(fileURLToPath(new URL(`../../mobile/assets/${path}`, import.meta.url)));
const PHOTO: Record<string, string> = { starters: 'images/photo/dish-starters.webp', mains: 'images/photo/dish-mains.webp', drinks: 'images/photo/dish-drinks.webp', desserts: 'images/photo/dish-desserts.webp' };
const SAMPLE_DISH = '00000000-0000-4000-8000-000000000101';
const MARK = 'Hungry? Order now';

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const sample = await pool.query('select 1 from menu_items where id = $1', [SAMPLE_DISH]);
  if (!sample.rows[0]) {
    console.log('The sample menu is not here any more, so the demo was not loaded (it would mix with your own dishes).');
    return;
  }

  const done = await pool.query(`select 1 from promotions where placement = 'hero' and title_en = $1 limit 1`, [MARK]);
  if (done.rows[0]) {
    console.log('Demo pictures and videos are already loaded.');
  } else {
    // Category pictures, from the category's English name.
    const cats = await pool.query('select id, lower(name_en) as name from categories where restaurant_id = $1', [RESTAURANT_ID]);
    const keyOf = (name: string) => Object.keys(PHOTO).find((k) => name.includes(k.replace(/s$/, ''))) ?? 'mains';
    for (const c of cats.rows) await updateCategory(c.id, { illustration: keyOf(c.name) });

    // Each dish without a picture gets its category's photo.
    const dishes = await pool.query(
      `select i.id, i.name_en, i.name_ar, lower(c.name_en) as category from menu_items i join categories c on c.id = i.category_id
       where c.restaurant_id = $1 and not exists (select 1 from product_media pm where pm.menu_item_id = i.id)`,
      [RESTAURANT_ID],
    );
    for (const d of dishes.rows) await addProductMedia(d.id, asset(PHOTO[keyOf(d.category)]), d.name_en, d.name_ar, null);

    const window = { startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString() };
    const video = async (file: string) => (await addPromotionMedia(asset(file), null)).id;
    await createPromotion({
      placement: 'hero', mediaId: await video('video/lemon-chicken.mp4'), position: 1, durationSeconds: 7,
      titleEn: MARK, titleAr: 'جائع؟ اطلب الآن', bodyEn: 'Browse the menu and order in a few taps.', bodyAr: 'تصفح القائمة واطلب بضع نقرات.',
      ctaEn: 'Menu', ctaAr: 'القائمة', ...window,
    });
    await createPromotion({
      placement: 'hero', mediaId: await video('video/garlic-butter-pan.mp4'), position: 2, durationSeconds: 7,
      kickerEn: 'Cooked to order', kickerAr: 'يُطهى عند الطلب', titleEn: 'Hot from the pan', titleAr: 'ساخن من المقلاة',
      bodyEn: 'Every dish is made when you order it.', bodyAr: 'كل طبق يُحضّر عند طلبك.', ctaEn: 'Order now', ctaAr: 'اطلب الآن', ...window,
    });
    await createPromotion({
      placement: 'mid_feed', mediaId: await video('video/chef-prep.mp4'), position: 1, size: 'standard', frame: 'rounded',
      kickerEn: 'From our kitchen', kickerAr: 'من مطبخنا', titleEn: 'Made fresh, every order', titleAr: 'طازج في كل طلب',
      bodyEn: 'Prepared by hand, right before it leaves.', bodyAr: 'يُحضّر يدوياً قبل خروجه مباشرة.', ctaEn: 'See the menu', ctaAr: 'القائمة', ...window,
    });
    // Videos behind two dishes on their pages.
    const behind = await pool.query(`select id, name_en from menu_items where name_en in ('Grilled chicken plate', 'Mint lemonade')`);
    for (const d of behind.rows) {
      const file = d.name_en === 'Mint lemonade' ? 'video/mint-lemonade.mp4' : 'video/lemon-chicken.mp4';
      await createPromotion({ placement: 'product_background', menuItemId: d.id, mediaId: await video(file), titleEn: d.name_en, titleAr: d.name_en, ...window });
    }
    console.log(`Loaded: photos for ${dishes.rows.length} dishes and ${cats.rows.length} categories, two hero videos, a spotlight and two dish videos.`);
  }

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That is not an email address.');
    let account = await accountByEmail(email);
    if (account) {
      console.log(`The demo account ${email} already exists.`);
    } else {
      const phone = `+9715${String(Date.now()).slice(-8)}`;
      account = await createAccountWithEmail('Demo Customer', phone, email);
      console.log(`Demo customer account made for ${email} (email already confirmed).`);
    }
    // One printed voucher in its wallet, so the vouchers screens have something to show (once).
    const held = await pool.query('select 1 from voucher_wallet where customer_id = $1 limit 1', [account.id]);
    const v = held.rows[0] ? { rows: [] as Record<string, string>[] } : await pool.query(
      `select v.id, v.code_ciphertext, v.code_hash from vouchers v where v.status = 'available' and v.expires_at > now()
         and not exists (select 1 from voucher_wallet w where w.voucher_id = v.id) order by v.id limit 1`,
    ).catch(() => ({ rows: [] as Record<string, string>[] }));
    if (v.rows[0]) {
      try {
        await saveVoucher(account.id, codeOf(v.rows[0] as { code_ciphertext: string; code_hash: string }));
        console.log('Saved one AED 5 voucher to its wallet.');
      } catch (e) {
        console.log(`No voucher saved: ${(e as Error).message}`);
      }
    }
    console.log(`Sign in on the website or the app with ${email}; the code goes to that mailbox.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
