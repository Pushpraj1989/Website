// White-label settings: a restaurant renames itself, sets its colour and logo, and the public brand follows.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as s from '../lib/restaurant-settings.ts';
import { RuleError } from '../lib/orders.ts';
import { pool } from '../lib/db.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (e: unknown) => e instanceof RuleError && e.code === code);
}

// A real 1×1 PNG.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cfc0f01f0005000201a3c4ae7a0000000049454e44ae426082', 'hex');

test('a restaurant renames itself and sets its colour; the public brand follows', async () => {
  const saved = await s.updateSettings({ name: { en: 'Al Noor Grill', ar: 'مشويات النور' }, tagline: { en: 'Charcoal grill since 1998', ar: 'مشويات على الفحم منذ 1998' }, brandColor: '#0f5132' }, 'staff');
  assert.equal(saved.name.en, 'Al Noor Grill');
  assert.equal(saved.brandColor, '#0F5132');
  const brand = await s.publicBrand();
  assert.equal(brand.name.ar, 'مشويات النور');
  assert.equal(brand.color, '#0F5132');
  const audit = await db.query(`select action from promotion_audit_log where target_type = 'restaurant' order by id desc limit 1`);
  assert.equal(audit.rows[0].action, 'restaurant_settings_changed');
});

test('a colour too light for white button text is refused, and so is a malformed one', async () => {
  await expectRule(s.updateSettings({ brandColor: '#FFD966' }, 'staff'), 'low_contrast');
  await expectRule(s.updateSettings({ brandColor: 'orange' }, 'staff'), 'bad_input');
  assert.ok(s.contrastWithWhite('#B45309') >= 4.5);
});

test('names have limits, at least one way to pay stays on, and card needs the payment provider', async () => {
  await expectRule(s.updateSettings({ name: { en: 'A' } }, 'staff'), 'bad_input');
  await expectRule(s.updateSettings({ payments: { cod: false, payOnArrival: false, card: false } }, 'staff'), 'bad_input');
  const off = await s.updateSettings({ payments: { cod: false, card: false } }, 'staff');
  assert.deepEqual(off.payments, { cod: false, payOnArrival: true, card: false });
  if (!process.env.STRIPE_SECRET_KEY) await expectRule(s.updateSettings({ payments: { card: true } }, 'staff'), 'card_unavailable');
});

test('the restaurant chooses a theme; the public brand carries it, and an unknown theme is refused', async () => {
  assert.equal((await s.getSettings()).theme, 'classic');
  await s.updateSettings({ theme: 'glass_night' }, 'staff');
  assert.equal((await s.publicBrand()).theme, 'glass_night');
  await expectRule(s.updateSettings({ theme: 'neon' }, 'staff'), 'bad_input');
  assert.equal((await s.getSettings()).theme, 'glass_night');
  await s.updateSettings({ theme: 'classic' }, 'staff');
});


test('the logo is a checked picture; replacing it removes the old one, and it can be removed', async () => {
  await expectRule(s.setLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'staff'), 'bad_file_type');
  await expectRule(s.setLogo(Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]), 'staff'), 'too_large');
  const first = await s.setLogo(PNG, 'staff');
  assert.match(first.logoUrl ?? '', /^\/media\/.+\.png$/);
  const second = await s.setLogo(PNG, 'staff');
  assert.notEqual(second.logoUrl, first.logoUrl);
  const media = await db.query(`select count(*)::int as n from media where alt_en = 'Logo'`);
  assert.equal(media.rows[0].n, 1, 'the old logo is gone');
  const none = await s.removeLogo('staff');
  assert.equal(none.logoUrl, null);
  await db.end();
  await pool.end();
});
