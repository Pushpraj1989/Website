// Staging pilot setup. Run once on a fresh staging database, after migrations:
//   DATABASE_URL=... VOUCHER_CODE_SECRET=... PARTNER_KEY_SECRET=... APP_ENCRYPTION_KEY=... \
//     node --experimental-strip-types scripts/pilot-setup.ts
// It switches card payment off, creates three pilot campaigns, a printed voucher design, 50 printed vouchers, and one
// partner. The partner key is printed once, here; store it in the partner's secret store. Running it again does nothing.
import { pool } from '../lib/db.ts';
import * as c from '../lib/campaigns.ts';
import * as t from '../lib/templates.ts';
import { createPartnerClient } from '../lib/partners.ts';
import { recordAudit } from '../lib/audit.ts';
import { RESTAURANT_ID } from '../lib/catalog.ts';

const ACTOR = 'pilot-setup';
const DAY = 24 * 60 * 60 * 1000;
const start = new Date(Date.now() - 60 * 60 * 1000);
const end = new Date(Date.now() + 30 * DAY);
const ruleEnd = new Date(end.getTime() - 60 * 60 * 1000);

async function main() {
  const existing = await pool.query(`select 1 from campaigns where name like 'Pilot:%' and restaurant_id = $1 limit 1`, [RESTAURANT_ID]);
  if (existing.rows[0]) {
    console.log('The pilot is already set up. Nothing was changed.');
    return;
  }

  // 1. Card payment off for the pilot: cash on delivery and pay on arrival only.
  await pool.query(`update restaurant set accepts_card = false where id = $1`, [RESTAURANT_ID]);
  await recordAudit(pool, ACTOR, 'card_payment_off', 'campaign', null, { reason: 'staging pilot: cash and pay on arrival only' });

  // 2. A shared welcome code: 10% off, at most AED 20, on orders of AED 30 or more, once per customer, 500 uses.
  const welcome = await c.createCampaign({ name: 'Pilot: Welcome 10%', startsAt: start, endsAt: end, fundingSource: 'restaurant', budgetMinor: 200000 });
  await c.createCampaignOffer(welcome.id, {
    name: { en: 'Welcome 10% off', ar: 'خصم ترحيبي 10%' }, type: 'percent', value: 1000, code: 'WELCOME10',
    minSubtotalMinor: 3000, maxDiscountMinor: 2000, usageLimit: 500, perCustomerLimit: 1, startsAt: start, endsAt: ruleEnd,
  });
  await c.transitionCampaign(welcome.id, 'activate', ACTOR, 'pilot launch');

  // 3. Printed vouchers: AED 5 off orders of AED 25 or more, single use, with a printed design.
  const printed = await c.createCampaign({ name: 'Pilot: AED 5 vouchers', startsAt: start, endsAt: end, fundingSource: 'restaurant', budgetMinor: 100000, maxIssuance: 200 });
  const printedRule = await c.createCampaignOffer(printed.id, {
    name: { en: 'AED 5 off', ar: 'خصم 5 دراهم' }, type: 'fixed', value: 500, minSubtotalMinor: 2500, startsAt: start, endsAt: ruleEnd,
  });
  await c.transitionCampaign(printed.id, 'activate', ACTOR, 'pilot launch');
  const design = await t.createTemplate({ name: 'Pilot card', widthMm: 85, heightMm: 55 });
  await t.updateDraft(design.id, {
    fields: [
      { id: 'restaurant', type: 'text', content: '{{restaurant.name}}', x: 6, y: 6, w: 46, h: 7, fontSizePt: 12, fontWeight: 700, align: 'left', color: '#B45309' },
      { id: 'discount', type: 'text', content: '{{voucher.discount}}', x: 6, y: 15, w: 50, h: 12, fontSizePt: 16, fontWeight: 700, align: 'left', color: '#1C1917' },
      { id: 'code', type: 'text', content: '{{voucher.code}}', x: 6, y: 31, w: 46, h: 6, fontSizePt: 11, fontWeight: 700, align: 'left', color: '#1C1917' },
      { id: 'expiry', type: 'text', content: '{{voucher.expiry_date}}', x: 6, y: 39, w: 46, h: 5, fontSizePt: 7, fontWeight: 400, align: 'left', color: '#57534E' },
      { id: 'terms', type: 'text', content: '{{voucher.terms}}', x: 6, y: 46, w: 73, h: 6, fontSizePt: 6, fontWeight: 400, align: 'left', color: '#57534E' },
      { id: 'qr', type: 'qr', content: '{{voucher.qr}}', x: 60, y: 15, w: 20, h: 20, fontSizePt: 12, fontWeight: 400, align: 'left', color: '#1C1917' },
    ],
  });
  await t.publishTemplate(design.id);
  const printedPool = await c.createPool(printed.id, { offerId: printedRule.id, codePattern: 'PLT-####-@@', quantityLimit: 200, templateId: design.id });
  const batch = await c.createBatch(printedPool.id, { quantity: 50, expiresAt: ruleEnd }, 'pilot-print-batch-0001');

  // 4. Free delivery with a shared code, 200 uses.
  const delivery = await c.createCampaign({ name: 'Pilot: Free delivery', startsAt: start, endsAt: end, fundingSource: 'shared', budgetMinor: 100000 });
  await c.createCampaignOffer(delivery.id, {
    name: { en: 'Free delivery', ar: 'توصيل مجاني' }, type: 'free_delivery', value: 0, code: 'FREEDEL', usageLimit: 200, startsAt: start, endsAt: ruleEnd,
  });
  await c.transitionCampaign(delivery.id, 'activate', ACTOR, 'pilot launch');

  // 5. One partner, allowed to issue from the AED 5 vouchers campaign only. It cannot read code lists.
  const partner = await createPartnerClient({
    name: 'Pilot partner', scopes: ['vouchers:issue', 'vouchers:read', 'vouchers:validate', 'campaigns:read'],
    campaignIds: [printed.id], dailyIssueLimit: 100, requestsPerMinute: 30,
  }, ACTOR);

  console.log(JSON.stringify({
    cardPayment: 'off',
    campaigns: [
      { name: welcome.name, code: 'WELCOME10', rule: '10% off, max AED 20, min order AED 30, once per customer, 500 uses' },
      { name: printed.name, rule: 'AED 5 off, min order AED 25, single-use vouchers', printed: batch.generatedQuantity, poolId: printedPool.id, design: 'Pilot card v1' },
      { name: delivery.name, code: 'FREEDEL', rule: 'free delivery, 200 uses' },
    ],
    partner: { id: partner.client.id, name: partner.client.name, campaigns: 1, dailyIssueLimit: 100 },
  }, null, 2));
  console.log('\nPartner key (shown once; store it now): ' + partner.apiKey);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
