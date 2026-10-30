// Exports the data the customer app's demo mode runs on, from a database, using the same functions the API serves
// from. Nothing in the demo is typed by hand: the menu, prices, delivery areas, offers and their rules, the membership
// plans and a few voucher codes all come from here.
//   DATABASE_URL=... APP_ENCRYPTION_KEY=... VOUCHER_CODE_SECRET=... node --experimental-strip-types scripts/export-demo-snapshot.ts
// Export from a test or staging database that has run scripts/pilot-setup.ts, never from production: the voucher codes
// in the snapshot are real codes of the database they came from, and the snapshot ships inside the demo app.
import { livePromotions } from '../lib/gallery.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../lib/db.ts';
import * as data from '../lib/data.ts';
import { offerRules } from '../lib/discounts.ts';
import { listPlans } from '../lib/membership.ts';
import { codeOf, discountText } from '../lib/print.ts';
import { publicBrand } from '../lib/restaurant-settings.ts';

const OUT = fileURLToPath(new URL('../../mobile/assets/demo/snapshot.json', import.meta.url));
const VOUCHERS = Number(process.env.DEMO_VOUCHERS ?? 3);

async function main() {
  const restaurant = await data.getRestaurant();
  const categories = await data.getMenu();
  const menuOffers = await data.activeOffers();

  const zones = await pool.query(
    `select id, name_en, name_ar, fee_minor, min_order_minor, active, ST_AsGeoJSON(polygon::geometry) as shape
     from delivery_zones where restaurant_id = $1 and active order by name_en`,
    [data.restaurantId],
  );

  // Every running offer that a customer can type: shared codes, plus the rules behind the exported vouchers.
  const coded = await pool.query(
    `select o.id, o.code, o.name_en, o.name_ar, cm.name as campaign
     from offers o left join campaigns cm on cm.id = o.campaign_id
     where o.restaurant_id = $1 and o.active and o.code is not null and now() between o.starts_at and o.ends_at
     order by o.code`,
    [data.restaurantId],
  );

  // A few usable vouchers from printed or issued batches, read back from their encrypted copies.
  const vouchers = await pool.query(
    `select v.code_hash, v.code_ciphertext, v.expires_at, v.offer_id, o.offer_type, o.value_int, o.min_subtotal_minor,
            cm.name as campaign
     from vouchers v join offers o on o.id = v.offer_id join voucher_pools p on p.id = v.pool_id join campaigns cm on cm.id = p.campaign_id
     where cm.restaurant_id = $1 and v.status = 'available' and v.expires_at > now() and v.assigned_customer_id is null
       and v.code_ciphertext is not null and o.active
     order by v.created_at, v.id limit $2`,
    [data.restaurantId, VOUCHERS],
  );

  const offerIds = new Set<string>([...coded.rows.map((r) => r.id), ...vouchers.rows.map((r) => r.offer_id)]);
  const rules: Record<string, unknown> = {};
  for (const id of offerIds) {
    const r = await offerRules(pool, id);
    if (r) rules[id] = { ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() };
  }

  // The demo runs with no server, so it cannot load the logo file; it shows the name, in the brand's colour.
  const brand = { ...(await publicBrand()), logoUrl: null };

  // The published home promotions. The demo has no server to load pictures from, so promotions that need one are
  // left out; those that run on colour, words and an offer's terms are kept.
  const live = await livePromotions();
  const noMedia = <T extends { media: unknown }>(p: T | null) => (p && p.media === null ? p : null);
  const home = {
    hero: [],
    midFeed: [],
    carousel: live.carousel.filter((p) => p.media === null),
    welcome: noMedia(live.welcome),
    strip: noMedia(live.strip),
  };

  const snapshot = {
    source: {
      exportedAt: new Date().toISOString(),
      by: 'food-app/web/scripts/export-demo-snapshot.ts',
      note: 'Read from the database with the functions the API uses. Do not edit by hand; export again instead.',
    },
    restaurant: {
      name: restaurant.name,
      currency: restaurant.currency,
      taxLabel: restaurant.taxLabel,
      taxBasisPoints: restaurant.taxBasisPoints,
      serviceFeeMinor: restaurant.serviceFeeMinor,
      cashLimitMinor: restaurant.cashLimitMinor,
      // Card needs a payment provider, which the demo does not have, so it is off whatever the database says.
      payments: { cod: restaurant.payments.cod, payOnArrival: restaurant.payments.payOnArrival, card: false },
    },
    brand,
    home,
    categories: categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, imageUrl: null })) })),
    menuOffers,
    zones: zones.rows.map((z) => ({
      id: z.id,
      name: { en: z.name_en, ar: z.name_ar },
      feeMinor: z.fee_minor,
      minOrderMinor: z.min_order_minor,
      active: z.active,
      // Outer ring of the area, as [longitude, latitude] pairs.
      polygon: (JSON.parse(z.shape).coordinates[0] as number[][]).map(([lng, lat]) => [lng, lat]),
    })),
    offers: coded.rows.map((o) => ({ id: o.id, code: o.code, name: { en: o.name_en, ar: o.name_ar }, campaign: o.campaign })),
    rules,
    vouchers: vouchers.rows.map((v) => ({
      code: codeOf(v),
      offerId: v.offer_id,
      campaign: v.campaign,
      discount: discountText(v),
      minOrderMinor: Number(v.min_subtotal_minor),
      currency: restaurant.currency,
      expiresAt: new Date(v.expires_at).toISOString(),
    })),
    membership: await listPlans(null),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
  const items = snapshot.categories.reduce((n, c) => n + c.items.length, 0);
  console.log(`Wrote ${OUT}`);
  console.log(`${snapshot.categories.length} categories, ${items} dishes, ${snapshot.zones.length} delivery areas, ${snapshot.offers.length} codes, ${snapshot.vouchers.length} vouchers, ${snapshot.membership.plans.length} membership plans.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
