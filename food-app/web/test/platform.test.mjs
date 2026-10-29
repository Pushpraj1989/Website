// Gallery (many pictures and videos per product), promotions, public endpoints and video ranges, over HTTP,
// against a real server. Videos are minimal MP4 files: the server checks the signature, not the content.
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:3100';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
const ADMIN_PASSWORD = 'slice-test-password-1';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d9b2640000000049454e44ae426082', 'hex');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(24, 1)]);
const MP4_BIG_RANGE = Buffer.concat([MP4, Buffer.alloc(4000, 9)]);

let server;
before(async () => {
  const reset = spawnSync(process.execPath, [`${ROOT}db/migrate.mjs`, '--reset'], { env: { ...process.env, DATABASE_URL }, encoding: 'utf8' });
  assert.equal(reset.status, 0, reset.stderr);
  server = spawn(process.execPath, [`${ROOT}node_modules/next/dist/bin/next`, 'start', '-p', '3100'], {
    cwd: ROOT, detached: true, stdio: 'ignore',
    env: { ...process.env, DATABASE_URL, ADMIN_PASSWORD, OTP_DELIVERY: 'outbox', OTP_SECRET: 'test-otp-secret-value', APP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'), STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', NEXT_TELEMETRY_DISABLED: '1' },
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/v1/menu`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
});
after(() => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} });

async function call(method, path, { body, staff, form, headers: extra = {} } = {}) {
  const headers = { ...extra };
  if (staff) headers.cookie = `staff=${staff}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, headers: response.headers };
}

async function staffCookie() {
  const r = await call('POST', '/v1/admin/session', { body: { password: ADMIN_PASSWORD } });
  return r.headers.getSetCookie().find((c) => c.startsWith('staff=')).split(';')[0].slice('staff='.length);
}

let staff;
let productId;
const media = [];

test('setup: a staff session and a product to work on', async () => {
  staff = await staffCookie();
  const cat = await call('GET', '/v1/admin/catalog', { staff });
  productId = cat.json.products.find((p) => p.name.en === 'Vegetable stew').id;
});

test('a product takes several pictures and a video, and the first picture is the cover', async () => {
  for (const [name, bytes, type] of [['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png'], ['clip.mp4', MP4, 'video/mp4']]) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    form.append('altEn', name);
    const r = await call('POST', `/v1/admin/products/${productId}/media`, { staff, form });
    assert.equal(r.status, 201, name);
    media.push(r.json.media);
  }
  assert.equal(media[2].kind, 'video');
  assert.equal(media[2].mime, 'video/mp4');
  const gallery = await call('GET', `/v1/admin/products/${productId}/media`, { staff });
  assert.equal(gallery.json.media.length, 3);
  assert.equal(gallery.json.media.filter((m) => m.primary).length, 1, 'exactly one cover');
  assert.equal(gallery.json.media.find((m) => m.primary).id, media[0].id);
});

test('a file that is not a picture or video is refused, whatever its name says', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('this is plain text, not media')], { type: 'video/mp4' }), 'fake.mp4');
  const r = await call('POST', `/v1/admin/products/${productId}/media`, { staff, form });
  assert.equal(r.status, 415);
});

test('the order of pictures and the cover can be changed, and must match the product exactly', async () => {
  const reversed = [media[2].id, media[1].id, media[0].id];
  const bad = await call('PATCH', `/v1/admin/products/${productId}/media`, { staff, body: { order: [media[0].id], primary: media[0].id } });
  assert.equal(bad.status, 400);
  const cover = await call('PATCH', `/v1/admin/products/${productId}/media`, { staff, body: { order: reversed, primary: media[1].id } });
  assert.equal(cover.status, 200);
  assert.equal(cover.json.media[0].id, media[1].id, 'the cover comes first');
  assert.equal(cover.json.media[0].primary, true);
});

test('removing the cover promotes the next picture; the customer product page lists the rest', async () => {
  const removed = await call('DELETE', `/v1/admin/products/${productId}/media/${media[1].id}`, { staff });
  assert.equal(removed.status, 200);
  const gallery = await call('GET', `/v1/admin/products/${productId}/media`, { staff });
  assert.equal(gallery.json.media.length, 2);
  assert.equal(gallery.json.media.filter((m) => m.primary).length, 1, 'a new cover was chosen');
  const product = await call('GET', `/v1/products/${productId}`);
  assert.equal(product.status, 200);
  assert.equal(product.json.media.length, 2);
  assert.equal(product.json.background, null, 'no background video yet');
});

test('a hero promotion shows on the home screen only while it is live', async () => {
  const now = Date.now();
  const day = 864e5;
  const live = await call('POST', '/v1/admin/promotions', { staff, body: { placement: 'hero', mediaId: media[2].id, titleEn: 'Stew of the week', titleAr: 'طبق الأسبوع', ctaEn: 'Order', ctaAr: 'اطلب', startsAt: new Date(now - day).toISOString(), endsAt: new Date(now + day).toISOString() } });
  assert.equal(live.status, 201);
  const later = await call('POST', '/v1/admin/promotions', { staff, body: { placement: 'mid_feed', mediaId: media[0].id, startsAt: new Date(now + day).toISOString(), endsAt: new Date(now + 2 * day).toISOString() } });
  assert.equal(later.status, 201);
  const home = await call('GET', '/v1/home');
  assert.equal(home.json.hero.length, 1, 'the live hero shows');
  assert.equal(home.json.hero[0].title.en, 'Stew of the week');
  assert.equal(home.json.hero[0].media.kind, 'video');
  assert.equal(home.json.midFeed.length, 0, 'the scheduled one does not show yet');
});

test('a product background video plays behind the product only when it is live', async () => {
  const now = Date.now();
  const day = 864e5;
  const noTarget = await call('POST', '/v1/admin/promotions', { staff, body: { placement: 'product_background', mediaId: media[2].id, startsAt: new Date(now - day).toISOString(), endsAt: new Date(now + day).toISOString() } });
  assert.equal(noTarget.status, 400, 'a background must name its product');
  const made = await call('POST', '/v1/admin/promotions', { staff, body: { placement: 'product_background', menuItemId: productId, mediaId: media[2].id, titleEn: 'How the stew is made', startsAt: new Date(now - day).toISOString(), endsAt: new Date(now + day).toISOString() } });
  assert.equal(made.status, 201);
  const product = await call('GET', `/v1/products/${productId}`);
  assert.equal(product.json.background.media.kind, 'video');
  assert.equal(product.json.background.title.en, 'How the stew is made');
});

test('a video is served in byte ranges, so a phone can seek', async () => {
  const form = new FormData();
  form.append('file', new Blob([MP4_BIG_RANGE], { type: 'video/mp4' }), 'long.mp4');
  const up = await call('POST', `/v1/admin/products/${productId}/media`, { staff, form });
  const url = up.json.media.url;
  const full = await fetch(`${BASE}${url}`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  const part = await fetch(`${BASE}${url}`, { headers: { range: 'bytes=0-99' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-length'), '100');
  assert.match(part.headers.get('content-range'), /^bytes 0-99\/\d+$/);
  const tail = await fetch(`${BASE}${url}`, { headers: { range: 'bytes=-50' } });
  assert.equal(tail.status, 206);
  const bad = await fetch(`${BASE}${url}`, { headers: { range: 'bytes=999999-' } });
  assert.equal(bad.status, 416);
});

test('promotions need a live window, and can be stopped or removed', async () => {
  const bad = await call('POST', '/v1/admin/promotions', { staff, body: { placement: 'hero', mediaId: media[0].id, startsAt: '2026-11-02T00:00:00Z', endsAt: '2026-11-01T00:00:00Z' } });
  assert.equal(bad.status, 400);
  const list = await call('GET', '/v1/admin/promotions', { staff });
  assert.ok(list.json.promotions.length >= 3);
  const id = list.json.promotions[0].id;
  const stopped = await call('PUT', `/v1/admin/promotions/${id}`, { staff, body: { placement: list.json.promotions[0].placement, menuItemId: list.json.promotions[0].menuItemId, mediaId: list.json.promotions[0].media.id, startsAt: list.json.promotions[0].startsAt, endsAt: list.json.promotions[0].endsAt, active: false } });
  assert.equal(stopped.status, 200);
  const gone = await call('DELETE', `/v1/admin/promotions/${id}`, { staff });
  assert.equal(gone.status, 200);
});

test('the public endpoints need no sign-in, and the admin ones do', async () => {
  assert.equal((await call('GET', `/v1/admin/products/${productId}/media`)).status, 401);
  assert.equal((await call('GET', '/v1/admin/promotions')).status, 401);
  assert.equal((await call('GET', '/v1/home')).status, 200);
});
