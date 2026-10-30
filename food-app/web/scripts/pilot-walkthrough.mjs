// The pilot walkthrough over HTTP: a customer, the partner and staff go through the pilot's offers end to end, against a
// running API that was set up with scripts/pilot-setup.ts. Each step prints what was sent and what came back.
// Usage: BASE=http://127.0.0.1:3100 ADMIN_PASSWORD=... PILOT_PARTNER_KEY=... node scripts/pilot-walkthrough.mjs
// Customer sign-up reads the one-time code from data/outbox.jsonl, so the API must run with OTP_DELIVERY=outbox.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const KEY = process.env.PILOT_PARTNER_KEY;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!KEY || !PASSWORD) throw new Error('Set PILOT_PARTNER_KEY and ADMIN_PASSWORD');
const SALAD = '00000000-0000-4000-8000-000000000101';
const MAIN = '00000000-0000-4000-8000-000000000201';
const aed = (minor) => (minor == null ? '—' : `AED ${(minor / 100).toFixed(2)}`);
let failed = 0;

function client() {
  const jar = {};
  let token = null;
  const c = {
    jar,
    set token(t) { token = t; },
    async call(method, path, body, headers = {}) {
      const h = { ...headers };
      const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookie) h.cookie = cookie;
      if (token && !h.authorization) h.authorization = `Bearer ${token}`;
      if (body !== undefined) h['content-type'] = 'application/json';
      const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const raw of r.headers.getSetCookie()) {
        const [k, ...v] = raw.split(';')[0].split('=');
        jar[k] = v.join('=');
      }
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, json, headers: r.headers };
    },
  };
  return c;
}

function step(title, expect, actual, detail) {
  const ok = expect === actual;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}`);
  console.log(`      ${detail}${ok ? '' : `  (expected ${expect}, got ${actual})`}`);
}
const reason = (r) => r.json?.error?.message ?? r.json?.offer?.reason ?? '';
const partner = (method, path, body, key) => fetch(`${BASE}${path}`, {
  method,
  headers: { authorization: `Bearer ${KEY}`, ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, json: await r.json(), replayed: r.headers.get('idempotent-replayed') }));

console.log(`Pilot walkthrough against ${BASE}\n`);

// The customer
console.log('— Customer —');
const menu = await (await fetch(`${BASE}/v1/menu`)).json();
const pay = menu.restaurant?.payments ?? menu.payments;
step('Card payment is off for the pilot; cash on delivery and pay on arrival are on', 'false/true/true', `${pay?.card}/${pay?.cod}/${pay?.payOnArrival}`, `payments: ${JSON.stringify(pay)}`);

const sara = client();
const phone = `+97150${String(Date.now()).slice(-7)}`;
const signup = await sara.call('POST', '/v1/auth/signup/phone', { name: 'Pilot Customer', phone });
const outbox = readFileSync(join(process.cwd(), 'data', 'outbox.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const otp = outbox.filter((m) => m.to === phone.replace(/\s/g, '') && m.purpose === 'signup_phone').at(-1)?.code;
const verified = await sara.call('POST', '/v1/auth/signup/phone/verify', { challengeId: signup.json?.challengeId, code: otp });
sara.token = verified.json?.token;
step('A customer signs up with a phone number', 201, verified.status, `account "${verified.json?.account?.name}"`);

const address = await sara.call('POST', '/v1/addresses', { label: 'Home', line1: '12 Example Street, Dubai', line2: 'Flat 4', notes: '', lat: 25.1, lng: 55.3 });
step('The customer saves a delivery address inside the delivery area', 201, address.status, `zone: ${address.json?.address?.zone?.name?.en ?? address.json?.address?.zone?.id}`);
const addressId = address.json?.address?.id;

await sara.call('PUT', '/v1/cart', { channel: 'delivery', items: [{ itemId: MAIN, qty: 2, note: '' }, { itemId: SALAD, qty: 1, note: '' }] });
const before = (await sara.call('POST', '/v1/checkout/quote', { channel: 'delivery', addressId })).json?.quote ?? {};
console.log(`      cart: subtotal ${aed(before.subtotalMinor)}, delivery ${aed(before.deliveryFeeMinor)}, total ${aed(before.totalMinor)}`);

const applied = await sara.call('PUT', '/v1/cart/offer', { code: 'welcome10' });
step('WELCOME10 applies (typed in lower case)', 200, applied.status, `offer: ${applied.json?.offer?.label ?? reason(applied)}`);
const quote = (await sara.call('POST', '/v1/checkout/quote', { channel: 'delivery', addressId })).json?.quote ?? {};
const tenPct = Math.min(Math.round(before.subtotalMinor * 0.1), 2000);
step('The quote takes 10% off the food, capped at AED 20', tenPct, quote.discountMinor, `subtotal ${aed(quote.subtotalMinor)} − ${aed(quote.discountMinor)} + delivery ${aed(quote.deliveryFeeMinor)} = ${aed(quote.totalMinor)}`);

const card = await sara.call('POST', '/v1/orders', { channel: 'delivery', method: 'card', addressId, idempotencyKey: `walk-card-${Date.now()}` });
step('Paying by card is refused during the pilot', false, card.status < 300, `${card.status}: ${reason(card)}`);
const first = await sara.call('POST', '/v1/orders', { channel: 'delivery', method: 'cod', addressId, idempotencyKey: `walk-cod-${Date.now()}` });
step('Cash on delivery order is placed with the discount', 'placed', first.json?.order?.status, `order ${first.json?.order?.id?.slice(0, 8)} total ${aed(first.json?.order?.quote?.totalMinor)}, discount ${aed(first.json?.order?.quote?.discountMinor)}`);
const firstId = first.json?.order?.id;

await sara.call('PUT', '/v1/cart', { channel: 'delivery', items: [{ itemId: MAIN, qty: 2, note: '' }] });
const again = await sara.call('PUT', '/v1/cart/offer', { code: 'WELCOME10' });
step('WELCOME10 a second time is refused (once per customer)', false, again.status === 200 && again.json?.offer?.applied === true, `${again.status}: ${reason(again)}`);
await sara.call('DELETE', '/v1/cart/offer');

const small = client();
await small.call('PUT', '/v1/cart', { channel: 'pickup', items: [{ itemId: SALAD, qty: 1, note: '' }] });
const tooSmall = await small.call('PUT', '/v1/cart/offer', { code: 'WELCOME10' });
step('WELCOME10 on a guest cart under AED 30 does not apply, and says why', false, tooSmall.json?.offer?.applied === true, `${tooSmall.status}: ${reason(tooSmall)}`);

// The partner
console.log('\n— Partner —');
const campaigns = await partner('GET', '/v1/partner/campaigns');
const allowed = campaigns.json?.campaigns ?? [];
step('The partner sees only the campaign it is allowed', 1, allowed.length, allowed.map((c) => c.name).join(', '));
const issueKey = `walk-issue-${Date.now()}`;
const issued = await partner('POST', '/v1/partner/vouchers/issue', { campaignId: allowed[0]?.id, quantity: 2 }, issueKey);
step('The partner issues two AED 5 vouchers', 201, issued.status, `codes: ${(issued.json?.vouchers ?? []).map((v) => v.code).join(', ')}`);
const replay = await partner('POST', '/v1/partner/vouchers/issue', { campaignId: allowed[0]?.id, quantity: 2 }, issueKey);
step('Sending the same request again returns the same codes, not new ones', true, replay.replayed === 'true' && replay.json?.vouchers?.[0]?.code === issued.json?.vouchers?.[0]?.code, `Idempotent-Replayed: ${replay.replayed}`);
const other = await partner('POST', '/v1/partner/vouchers/issue', { campaignId: '00000000-0000-4000-8000-000000000000', quantity: 1 }, `walk-other-${Date.now()}`);
step('Issuing from a campaign it is not allowed is refused', true, other.status >= 400, `${other.status}: ${other.json?.error?.message}`);
const codesList = await partner('GET', `/v1/partner/voucher-batches/${issued.json?.batch?.id}/codes`);
step('Reading a code list is refused (no codes:read scope)', 403, codesList.status, codesList.json?.error?.message);
const voucherCode = issued.json?.vouchers?.[0]?.code;
const check1 = await partner('POST', '/v1/partner/vouchers/validate', { code: voucherCode });
step('The partner checks a code: valid and unused', 'available', check1.json?.state, JSON.stringify(check1.json));

// The customer uses the partner voucher
console.log('\n— Customer uses the voucher —');
const saved = await sara.call('POST', '/v1/me/vouchers', { code: voucherCode });
step('The customer saves the voucher to their wallet', 201, saved.status, `wallet: ${saved.json?.voucher?.title ?? ""} (${saved.json?.voucher?.state})`);
const wallet = await sara.call('GET', '/v1/me/vouchers');
console.log(`      wallet: ${(wallet.json?.available ?? []).length} available, ${(wallet.json?.used ?? []).length} used`);
await sara.call('PUT', '/v1/cart', { channel: 'pickup', items: [{ itemId: MAIN, qty: 2, note: '' }] });
const vApplied = await sara.call('PUT', '/v1/cart/offer', { code: voucherCode });
step('The voucher applies to a pickup cart', 200, vApplied.status, `offer: ${vApplied.json?.offer?.label ?? reason(vApplied)}`);
const pickup = await sara.call('POST', '/v1/orders', { channel: 'pickup', method: 'pay_on_arrival', idempotencyKey: `walk-poa-${Date.now()}` });
step('Pay on arrival pickup order is placed with AED 5 off', 500, pickup.json?.order?.quote?.discountMinor, `order ${pickup.json?.order?.id?.slice(0, 8)} ${pickup.json?.order?.status}, total ${aed(pickup.json?.order?.quote?.totalMinor)}`);
const check2 = await partner('POST', '/v1/partner/vouchers/validate', { code: voucherCode });
step('The partner now sees the code as used', 'used', check2.json?.state, JSON.stringify(check2.json));
const wallet2 = await sara.call('GET', '/v1/me/vouchers');
console.log(`      wallet: ${(wallet2.json?.available ?? []).length} available, ${(wallet2.json?.used ?? []).length} used`);

const guest = client();
await guest.call('PUT', '/v1/cart', { channel: 'pickup', items: [{ itemId: MAIN, qty: 2, note: '' }] });
const reuse = await guest.call('PUT', '/v1/cart/offer', { code: voucherCode });
step('Someone else trying the used voucher is refused', false, reuse.json?.offer?.applied === true, `${reuse.status}: ${reason(reuse)}`);

// Free delivery, then staff cancel it
console.log('\n— Free delivery, cancelled by staff —');
const dave = client();
const dAddr = await dave.call('POST', '/v1/addresses', { label: 'Home', line1: '7 Sample Road, Dubai', line2: '', notes: '', lat: 25.1, lng: 55.3 });
await dave.call('PUT', '/v1/cart', { channel: 'delivery', items: [{ itemId: MAIN, qty: 2, note: '' }] });
await dave.call('PUT', '/v1/cart/offer', { code: 'FREEDEL' });
const dq = (await dave.call('POST', '/v1/checkout/quote', { channel: 'delivery', addressId: dAddr.json?.address?.id })).json?.quote ?? {};
step('FREEDEL takes the delivery fee off', true, dq.discountMinor > 0 && dq.discountMinor === dq.deliveryFeeMinor, `delivery ${aed(dq.deliveryFeeMinor)}, discount ${aed(dq.discountMinor)}, total ${aed(dq.totalMinor)}`);
const dOrder = await dave.call('POST', '/v1/orders', { channel: 'delivery', method: 'cod', addressId: dAddr.json?.address?.id, idempotencyKey: `walk-fd-${Date.now()}` });
console.log(`      order ${dOrder.json?.order?.id?.slice(0, 8)} ${dOrder.json?.order?.status}, total ${aed(dOrder.json?.order?.quote?.totalMinor)}`);

console.log('\n— Staff —');
const staff = client();
const login = await staff.call('POST', '/v1/admin/session', { password: PASSWORD });
step('Staff sign in', 200, login.status, 'staff session set');
const accept = await staff.call('POST', `/v1/admin/orders/${firstId}/accept`, { etaMinutes: 30 });
step('Staff accept the WELCOME10 order', 200, accept.status, `ETA 30 minutes`);
for (const to of ['preparing', 'ready', 'out_for_delivery', 'delivered']) await staff.call('POST', `/v1/admin/orders/${firstId}/status`, { to });
const done = await sara.call('GET', `/v1/orders/${firstId}`);
step('…and move it through to delivered; the customer sees it', 'delivered', done.json?.order?.status, done.json?.order?.history?.map((h) => h.status).join(' → '));
const cancel = await staff.call('POST', `/v1/admin/orders/${dOrder.json?.order?.id}/status`, { to: 'cancelled' });
step('Staff cancel the free delivery order (its use of FREEDEL is given back)', 200, cancel.status, reason(cancel) || 'cancelled');
const report = await staff.call('GET', '/v1/admin/reports/promotions');
const s = report.json?.summary ?? {};
step('The promotions report is reconciled', true, report.json?.reconciled, `issued ${s.issued}, used ${s.redeemed}, redemptions ${s.redemptions}, discount ${aed(s.discountMinor)}`);
for (const c of report.json?.campaigns ?? []) console.log(`      ${c.name}: redemptions ${c.redemptions}, discount ${aed(c.discountMinor)}`);

console.log(failed ? `\n${failed} step(s) failed.` : '\nEvery step passed.');
process.exitCode = failed ? 1 : 0;
