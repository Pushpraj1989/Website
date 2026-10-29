// Accounts (phone code, email code, sessions) and admin catalogue (products, images, offers) over HTTP,
// against a real `next start` server. Codes are read from the dev outbox, the same file a provider would replace.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import { test, before, after } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://127.0.0.1:3100';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
const ADMIN_PASSWORD = 'slice-test-password-1';
const PHONE = '+971501234567';
const EMAIL = 'Sara.Tester@example.com';
const OUTBOX = `${ROOT}data/outbox.jsonl`;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d9b2640000000049454e44ae426082', 'hex');

let server;

before(async () => {
  const reset = spawnSync(process.execPath, [`${ROOT}db/migrate.mjs`, '--reset'], { env: { ...process.env, DATABASE_URL }, encoding: 'utf8' });
  assert.equal(reset.status, 0, reset.stderr);
  if (existsSync(OUTBOX)) rmSync(OUTBOX);
  server = spawn(process.execPath, [`${ROOT}node_modules/next/dist/bin/next`, 'start', '-p', '3100'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL, ADMIN_PASSWORD, OTP_DELIVERY: 'outbox', OTP_SECRET: 'test-otp-secret-value', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', NEXT_TELEMETRY_DISABLED: '1' },
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/v1/menu`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
});

after(() => {
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
});

/** The most recent code sent to a target for a purpose. Stands in for reading the SMS or the inbox. */
function codeFor(to, purpose) {
  const lines = readFileSync(OUTBOX, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const match = lines.filter((m) => m.to === to && m.purpose === purpose).at(-1);
  assert.ok(match, `a code was sent to ${to}`);
  return match.code;
}

async function call(method, path, { body, token, staff, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (staff) headers.cookie = `staff=${staff}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: response.status, json, text, headers: response.headers };
}

async function staffCookie() {
  const r = await call('POST', '/v1/admin/session', { body: { password: ADMIN_PASSWORD } });
  assert.equal(r.status, 200);
  const raw = r.headers.getSetCookie().find((c) => c.startsWith('staff='));
  return raw.split(';')[0].slice('staff='.length);
}

let token;
let challengeId;

test('sign-up step 1: a number without a country code is refused, and a valid one gets a code', async () => {
  const bad = await call('POST', '/v1/auth/signup/phone', { body: { name: 'Sara', phone: '0501234567' } });
  assert.equal(bad.status, 400);
  const ok = await call('POST', '/v1/auth/signup/phone', { body: { name: 'Sara Tester', phone: '+971 50 123 4567' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.sentTo.endsWith('567'), true, 'only the last digits are shown');
  challengeId = ok.json.challengeId;
  assert.ok(codeFor(PHONE, 'signup_phone'));
});

test('a second code within 30 seconds is refused', async () => {
  const again = await call('POST', '/v1/auth/signup/phone', { body: { name: 'Sara Tester', phone: PHONE } });
  assert.equal(again.status, 429);
  assert.equal(again.json.error.code, 'cooldown');
});

test('a wrong code says how many tries are left, and the right one creates the account', async () => {
  const wrong = await call('POST', '/v1/auth/signup/phone/verify', { body: { challengeId, code: '000000' } });
  assert.equal(wrong.status, 422);
  assert.match(wrong.json.error.message, /4 tries left/);
  const right = await call('POST', '/v1/auth/signup/phone/verify', { body: { challengeId, code: codeFor(PHONE, 'signup_phone') } });
  assert.equal(right.status, 201);
  assert.equal(right.json.account.name, 'Sara Tester');
  assert.equal(right.json.account.emailVerified, false);
  token = right.json.token;
});

test('a used code cannot be used again, and the same number cannot sign up twice', async () => {
  const reused = await call('POST', '/v1/auth/signup/phone/verify', { body: { challengeId, code: codeFor(PHONE, 'signup_phone') } });
  assert.equal(reused.status, 410);
  const dup = await call('POST', '/v1/auth/signup/phone', { body: { name: 'Someone', phone: PHONE } });
  assert.equal(dup.status, 409);
});

test('the session identifies the account, and a bad token is refused', async () => {
  const me = await call('GET', '/v1/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.account.phone, PHONE);
  const bad = await call('GET', '/v1/auth/me', { token: 'not-a-real-token' });
  assert.equal(bad.status, 401);
});

test('verify email: the address needs a session, then its own code', async () => {
  const anon = await call('POST', '/v1/auth/email/start', { body: { email: EMAIL } });
  assert.equal(anon.status, 401);
  const bad = await call('POST', '/v1/auth/email/start', { body: { email: 'not-an-email' }, token });
  assert.equal(bad.status, 400);
  const sent = await call('POST', '/v1/auth/email/start', { body: { email: EMAIL }, token });
  assert.equal(sent.status, 200);
  const emailChallenge = sent.json.challengeId;
  const verified = await call('POST', '/v1/auth/email/verify', { body: { challengeId: emailChallenge, code: codeFor('sara.tester@example.com', 'verify_email') }, token });
  assert.equal(verified.status, 200);
  assert.equal(verified.json.account.email, 'sara.tester@example.com', 'the address is stored in lower case');
  assert.equal(verified.json.account.emailVerified, true);
});

test('sign-in by phone: an unknown number is told so, and the right code gives a new session', async () => {
  const unknown = await call('POST', '/v1/auth/login/phone', { body: { phone: '+971509999999' } });
  assert.equal(unknown.status, 404);
  const start = await call('POST', '/v1/auth/login/phone', { body: { phone: PHONE } });
  assert.equal(start.status, 200);
  const login = await call('POST', '/v1/auth/login/phone/verify', { body: { challengeId: start.json.challengeId, code: codeFor(PHONE, 'login_phone') } });
  assert.equal(login.status, 200);
  assert.ok(login.json.token);
  assert.notEqual(login.json.token, token, 'each sign-in gets its own token');
});

// Changes the database directly, to skip the 30 second cooldown and to make a code expire.
async function withDb(sql, params) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try { return await client.query(sql, params); } finally { await client.end(); }
}

test('five wrong codes lock the challenge, even the right one', async () => {
  await withDb(`update otp_challenges set created_at = created_at - interval '5 minutes' where target = $1`, [PHONE]);
  const start = await call('POST', '/v1/auth/login/phone', { body: { phone: PHONE } });
  assert.equal(start.status, 200);
  const id = start.json.challengeId;
  const right = codeFor(PHONE, 'login_phone');
  const wrong = right === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', '/v1/auth/login/phone/verify', { body: { challengeId: id, code: wrong } });
    assert.equal(r.status, 422, `wrong try ${i + 1}`);
  }
  const locked = await call('POST', '/v1/auth/login/phone/verify', { body: { challengeId: id, code: right } });
  assert.equal(locked.status, 429);
  assert.equal(locked.json.error.code, 'too_many_attempts');
});

test('an expired code is refused, even when it is right', async () => {
  await withDb(`update otp_challenges set created_at = created_at - interval '5 minutes' where target = $1`, [PHONE]);
  const start = await call('POST', '/v1/auth/login/phone', { body: { phone: PHONE } });
  await withDb(`update otp_challenges set expires_at = now() - interval '1 minute' where id = $1`, [start.json.challengeId]);
  const r = await call('POST', '/v1/auth/login/phone/verify', { body: { challengeId: start.json.challengeId, code: codeFor(PHONE, 'login_phone') } });
  assert.equal(r.status, 410);
  assert.equal(r.json.error.code, 'code_expired');
});

test('sign out revokes the token', async () => {
  const out = await call('POST', '/v1/auth/logout', { token });
  assert.equal(out.status, 200);
  const me = await call('GET', '/v1/auth/me', { token });
  assert.equal(me.status, 401);
});

test('admin: the catalogue needs a staff session', async () => {
  const r = await call('GET', '/v1/admin/catalog');
  assert.equal(r.status, 401);
});

test('admin: create and change a product; a bad price is refused', async () => {
  const staff = await staffCookie();
  const cat = await call('GET', '/v1/admin/catalog', { staff });
  assert.equal(cat.status, 200);
  const categoryId = cat.json.categories[0].id;
  const bad = await call('POST', '/v1/admin/products', { staff, body: { categoryId, nameEn: 'Test dish', nameAr: 'طبق', priceMinor: -5 } });
  assert.equal(bad.status, 400);
  const made = await call('POST', '/v1/admin/products', { staff, body: { categoryId, nameEn: 'Test dish', nameAr: 'طبق', priceMinor: 2500, descriptionEn: 'Fresh', descriptionAr: 'طازج' } });
  assert.equal(made.status, 201);
  const id = made.json.product.id;
  const edited = await call('PATCH', `/v1/admin/products/${id}`, { staff, body: { priceMinor: 2750, available: false } });
  assert.equal(edited.status, 200);
  const after2 = await call('GET', '/v1/admin/catalog', { staff });
  const p = after2.json.products.find((x) => x.id === id);
  assert.equal(p.priceMinor, 2750);
  assert.equal(p.available, false);
});

test('admin: a product image is checked by its bytes; a text file named .png is refused', async () => {
  const staff = await staffCookie();
  const cat = await call('GET', '/v1/admin/catalog', { staff });
  const id = cat.json.products[0].id;
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'dish.png');
  form.append('altEn', 'A plate of food');
  const ok = await call('POST', `/v1/admin/products/${id}/media`, { staff, form });
  assert.equal(ok.status, 201);
  assert.match(ok.json.media.url, /^\/media\/[0-9a-f-]{36}\.png$/);
  const served = await fetch(`${BASE}${ok.json.media.url}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');

  const fake = new FormData();
  fake.append('file', new Blob([Buffer.from('hello, this is text')], { type: 'image/png' }), 'virus.png');
  const refused = await call('POST', `/v1/admin/products/${id}/media`, { staff, form: fake });
  assert.equal(refused.status, 415);

  const traversal = await fetch(`${BASE}/media/..%2F..%2Fpackage.json`);
  assert.equal(traversal.status, 404);
});

test('the customer menu shows the product image and the live offers', async () => {
  const menu = await call('GET', '/v1/menu');
  const withImage = menu.json.categories.flatMap((c) => c.items).find((i) => i.imageUrl);
  assert.ok(withImage, 'one product has a picture');
  assert.ok(Array.isArray(menu.json.offers));
});

test('admin: offers are checked (percent cap, dates) and can be stopped or deleted', async () => {
  const staff = await staffCookie();
  const base = { nameEn: 'Weekend', nameAr: 'عطلة', type: 'percent', value: 1000, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T00:00:00Z', audience: 'any' };
  const tooBig = await call('POST', '/v1/admin/offers', { staff, body: { ...base, value: 11000 } });
  assert.equal(tooBig.status, 400);
  const backwards = await call('POST', '/v1/admin/offers', { staff, body: { ...base, endsAt: '2026-10-01T00:00:00Z' } });
  assert.equal(backwards.status, 400);
  const made = await call('POST', '/v1/admin/offers', { staff, body: { ...base, code: 'weekend 10' } });
  assert.equal(made.status, 201);
  assert.equal(made.json.offer.code, 'WEEKEND10', 'codes are stored in capitals without spaces');
  const id = made.json.offer.id;
  const changed = await call('PATCH', `/v1/admin/offers/${id}`, { staff, body: { value: 1500 } });
  assert.equal(changed.status, 200);
  assert.equal(changed.json.offer.value, 1500);
  const gone = await call('DELETE', `/v1/admin/offers/${id}`, { staff });
  assert.equal(gone.json.result, 'deleted', 'an unused offer is deleted');
});
