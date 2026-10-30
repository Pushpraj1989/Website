// Home promotions for the staging pilot. Run after pilot-setup.ts on the same database:
//   DATABASE_URL=... node --experimental-strip-types scripts/home-setup.ts
// It publishes, from the pilot's own offers: a welcome pop-up for WELCOME10, an offers carousel (WELCOME10, FREEDEL
// and the AED 5 printed voucher), and an offer strip for FREEDEL. None needs a picture, so the demo app can show them
// too. Staff change or replace all of it in the admin under Promotions. Running it again does nothing.
import { pool } from '../lib/db.ts';
import { createPromotion } from '../lib/gallery.ts';
import { RESTAURANT_ID } from '../lib/catalog.ts';

async function main() {
  const existing = await pool.query(`select 1 from promotions where placement in ('welcome','carousel','strip') limit 1`);
  if (existing.rows[0]) {
    console.log('Home promotions are already set up. Nothing was changed.');
    return;
  }
  const offer = async (where: string, value: string) => {
    const { rows } = await pool.query(`select id, ends_at from offers where restaurant_id = $1 and ${where} = $2 limit 1`, [RESTAURANT_ID, value]);
    if (!rows[0]) throw new Error(`Run pilot-setup.ts first: no offer with ${where} ${value}.`);
    return rows[0] as { id: string; ends_at: Date };
  };
  const welcome = await offer('code', 'WELCOME10');
  const delivery = await offer('code', 'FREEDEL');
  const printed = await offer('name_en', 'AED 5 off');
  const window = (o: { ends_at: Date }) => ({ startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(o.ends_at).toISOString() });

  await createPromotion({
    placement: 'welcome', offerId: welcome.id, animation: 'slide_up', size: 'tall', frame: 'ticket', frequency: 'once_per_day',
    titleEn: 'A little treat for you', titleAr: 'هدية صغيرة لك', ctaEn: 'Order now', ctaAr: 'اطلب الآن', ...window(welcome),
  });
  await createPromotion({
    placement: 'carousel', offerId: welcome.id, position: 1, durationSeconds: 5, animation: 'slide_left',
    kickerEn: 'First order', kickerAr: 'أول طلب', titleEn: '10% off your first order', titleAr: 'خصم 10% على طلبك الأول',
    bodyEn: 'Up to AED 20 on orders of AED 30 or more.', bodyAr: 'حتى 20 درهماً للطلبات من 30 درهماً.', ...window(welcome),
  });
  await createPromotion({
    placement: 'carousel', offerId: delivery.id, position: 2, durationSeconds: 5, colour: '#0F766E', animation: 'slide_left',
    kickerEn: 'Delivery', kickerAr: 'التوصيل', titleEn: 'Free delivery', titleAr: 'توصيل مجاني', bodyEn: 'With code FREEDEL at checkout.', bodyAr: 'بالرمز FREEDEL عند الدفع.', ...window(delivery),
  });
  await createPromotion({
    placement: 'carousel', offerId: printed.id, position: 3, durationSeconds: 5, colour: '#6D28D9', animation: 'slide_left',
    kickerEn: 'Printed vouchers', kickerAr: 'قسائم مطبوعة', titleEn: 'AED 5 off with your voucher', titleAr: 'خصم 5 دراهم بقسيمتك',
    bodyEn: 'On orders of AED 25 or more.', bodyAr: 'للطلبات من 25 درهماً.', ...window(printed),
  });
  await createPromotion({
    placement: 'strip', offerId: delivery.id, animation: 'slide_up', titleEn: 'Free delivery with FREEDEL', titleAr: 'توصيل مجاني مع FREEDEL', ...window(delivery),
  });
  console.log('Published: welcome pop-up, 3 carousel offers and the offer strip.');
}

main().finally(() => pool.end());
