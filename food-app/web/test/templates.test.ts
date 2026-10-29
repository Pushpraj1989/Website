// Phase 3 tests: voucher templates, immutable versions, placeholders, margins, backgrounds and what a voucher records.
// Runs against the real test database and resets it first. Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import * as t from '../lib/templates.ts';
import * as c from '../lib/campaigns.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const RESTAURANT = '00000000-0000-4000-8000-000000000001';
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
const hour = 60 * 60 * 1000;
const day = 24 * hour;
// A 1x1 transparent PNG: a real picture, small enough for a test.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

before(() => {
  execFileSync(process.execPath, [migrate, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'ignore' });
});

async function expectRule(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (err) {
    assert.equal((err as { code?: string }).code, code, (err as Error).message);
    return;
  }
  assert.fail(`expected a ${code} error`);
}

const codeField = (id = 'code', extra: Record<string, unknown> = {}) => ({
  id, type: 'text', content: '{{voucher.code}}', x: 10, y: 30, w: 60, h: 8, fontSizePt: 14, fontWeight: 700, align: 'center', color: '#1C1917', ...extra,
});

async function template(name: string) {
  return t.createTemplate({ name, widthMm: 85, heightMm: 55 });
}

test('a field may show only the known placeholders', async () => {
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a', { content: 'Hi {{customer.password}}' })] }), 'bad_placeholder');
  const ok = await t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a', { content: 'Hi {{customer.name}} {{voucher.code}}' })] });
  assert.equal(ok.fields.length, 1);
});

test('nothing is placed inside the 3 mm print margin or off the page', async () => {
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a', { x: 1 })] }), 'outside_margin');
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a', { x: 40, w: 60 })] }), 'outside_margin');
  await expectRule(t.validateLayout({ widthMm: 10, heightMm: 55, fields: [] }), 'bad_input');
});

test('field ids are unique, colours are hex, and a QR field is always the QR placeholder', async () => {
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a'), codeField('a')] }), 'bad_input');
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, fields: [codeField('a', { color: 'red' })] }), 'bad_input');
  const qr = await t.validateLayout({ widthMm: 85, heightMm: 55, fields: [{ id: 'qr', type: 'qr', content: 'anything', x: 60, y: 10, w: 20, h: 20, fontSizePt: 12, fontWeight: 400, align: 'left', color: '#000000' }] });
  assert.equal(qr.fields[0].content, '{{voucher.qr}}');
});

test('filling a placeholder uses only sample values', () => {
  assert.equal(t.fill('{{restaurant.name}} — {{voucher.code}}'), 'Sample Kitchen — SAMPLE-1234');
  assert.equal(t.fill('plain text'), 'plain text');
});

test('a design must show the code before it can be published', async () => {
  const tpl = await template('No code');
  await t.updateDraft(tpl.id, { fields: [{ ...codeField('name'), content: 'Hello {{customer.name}}' }] });
  await expectRule(t.publishTemplate(tpl.id), 'no_code_field');
});

test('publishing makes an immutable version, and later draft edits do not change it', async () => {
  const tpl = await template('Versions');
  await t.updateDraft(tpl.id, { fields: [codeField('code')] });
  const v1 = await t.publishTemplate(tpl.id);
  assert.equal(v1.currentVersion, 1);
  await t.updateDraft(tpl.id, { fields: [codeField('code', { content: '{{voucher.discount}} {{voucher.code}}' })] });
  const v2 = await t.publishTemplate(tpl.id);
  assert.equal(v2.currentVersion, 2);
  const { rows } = await db.query(`select version, layout from voucher_template_versions where template_id = $1 order by version`, [tpl.id]);
  assert.equal(rows[0].layout.fields[0].content, '{{voucher.code}}', 'version 1 keeps its design');
  assert.equal(rows[1].layout.fields[0].content, '{{voucher.discount}} {{voucher.code}}');
  await expectRule(db.query(`update voucher_template_versions set layout = '{}' where template_id = $1`, [tpl.id]).then(() => undefined), 'P0001');
});

test('an archived template cannot be edited or published', async () => {
  const tpl = await template('Archived');
  await t.updateDraft(tpl.id, { fields: [codeField('code')] });
  await t.archiveTemplate(tpl.id);
  await expectRule(t.updateDraft(tpl.id, { name: 'Renamed' }), 'not_editable');
  await expectRule(t.publishTemplate(tpl.id), 'not_editable');
});

test('a duplicate copies the draft and starts with no versions', async () => {
  const tpl = await template('Original');
  await t.updateDraft(tpl.id, { fields: [codeField('code')] });
  await t.publishTemplate(tpl.id);
  const copy = await t.duplicateTemplate(tpl.id);
  assert.equal(copy.name, 'Original (copy)');
  assert.equal(copy.currentVersion, null);
  assert.equal(copy.draft.fields.length, 1);
});

test('the preview shows the draft with sample values; the current version needs a publish first', async () => {
  const tpl = await template('Preview');
  await t.updateDraft(tpl.id, { fields: [codeField('code', { content: '{{restaurant.name}} {{voucher.code}}' })] });
  await expectRule(t.previewTemplate(tpl.id, 'current'), 'not_published');
  const draft = await t.previewTemplate(tpl.id, 'draft');
  assert.equal(draft.fields[0].text, 'Sample Kitchen SAMPLE-1234');
  assert.equal(draft.sample, true);
});

test('a background must be a picture, and a layout can only point at a stored picture', async () => {
  const tpl = await template('Background');
  await expectRule(t.setBackground(tpl.id, Buffer.from('this is not a picture at all, plainly')), 'bad_file_type');
  const withBg = await t.setBackground(tpl.id, PNG);
  assert.ok(withBg.draft.backgroundMediaId);
  await expectRule(t.validateLayout({ widthMm: 85, heightMm: 55, backgroundMediaId: '00000000-0000-4000-8000-0000000000ff', fields: [] }), 'bad_input');
});

test('a pool prints with a published template, and every voucher records the version it was made with', async () => {
  const tpl = await template('Pool design');
  await t.updateDraft(tpl.id, { fields: [codeField('code')] });
  const campaign = await c.createCampaign({ name: 'Designed', startsAt: new Date(Date.now() - hour), endsAt: new Date(Date.now() + 20 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'r', ar: 'ر' }, type: 'percent', value: 1000, startsAt: new Date(Date.now() - hour), endsAt: new Date(Date.now() + 19 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  await expectRule(c.createPool(campaign.id, { offerId: offers[0].id, codePattern: 'DSGN##@@', templateId: tpl.id }), 'not_published');
  await t.publishTemplate(tpl.id);
  const pool = await c.createPool(campaign.id, { offerId: offers[0].id, codePattern: 'DSGN##@@', templateId: tpl.id });
  assert.equal(pool.templateId, tpl.id);
  const exp = new Date(Date.now() + 10 * day);
  await c.createBatch(pool.id, { quantity: 5, expiresAt: exp }, 'design-batch-1');
  await t.updateDraft(tpl.id, { fields: [codeField('code', { content: '{{voucher.discount}} {{voucher.code}}' })] });
  await t.publishTemplate(tpl.id);
  await c.createBatch(pool.id, { quantity: 5, expiresAt: exp }, 'design-batch-2');
  const { rows } = await db.query(
    `select v.version as ver from vouchers x join voucher_template_versions v on v.id = x.template_version_id where x.pool_id = $1 order by v.version`,
    [pool.id],
  );
  assert.equal(rows.length, 10);
  assert.equal(rows.filter((r) => r.ver === 1).length, 5, 'first batch keeps version 1');
  assert.equal(rows.filter((r) => r.ver === 2).length, 5, 'second batch uses version 2');
});
