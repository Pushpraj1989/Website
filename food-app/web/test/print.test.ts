// Phase 4 tests: QR structure, the PDF file, printing and export rules, and the print log. Runs against the test
// database and resets it first. Run: npm run test:vouchers (or on its own).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import * as t from '../lib/templates.ts';
import * as c from '../lib/campaigns.ts';
import { printPdf, exportCsv } from '../lib/print.ts';
import { encode } from '../lib/qr.ts';
import { readImage, buildPdf, assertPrintable, PdfError } from '../lib/pdf.ts';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('Set DATABASE_URL');
const migrate = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
const day = 24 * 60 * 60 * 1000;
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

const codeField = (extra: Record<string, unknown> = {}) => ({
  id: 'code', type: 'text', content: '{{voucher.code}}', x: 6, y: 30, w: 46, h: 6, fontSizePt: 11, fontWeight: 700, align: 'left', color: '#1C1917', ...extra,
});
const qrField = (extra: Record<string, unknown> = {}) => ({
  id: 'qr', type: 'qr', content: 'x', x: 58, y: 8, w: 20, h: 20, fontSizePt: 12, fontWeight: 400, align: 'left', color: '#1C1917', ...extra,
});

async function publishedPool(name: string, fields: unknown[], pattern = 'PRT##-@@@') {
  const tpl = await t.createTemplate({ name: `${name} design`, widthMm: 85, heightMm: 55 });
  await t.updateDraft(tpl.id, { fields });
  await t.publishTemplate(tpl.id);
  const campaign = await c.createCampaign({ name, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'Ten off', ar: 'خصم' }, type: 'percent', value: 1000, minSubtotalMinor: 4000, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  return c.createPool(campaign.id, { offerId: offers[0].id, codePattern: pattern, templateId: tpl.id });
}

test('the QR format bits are a valid code word and carry the chosen level and mask', () => {
  // Read the first copy of the format information back from the matrix and check its BCH code.
  for (const text of ['A', 'hello world', 'x'.repeat(40)]) {
    const grid = encode(text);
    const n = grid.length;
    const bits = [0, 1, 2, 3, 4, 5].map((i) => (grid[i][8] ? 1 : 0));
    bits.push(grid[7][8] ? 1 : 0, grid[8][8] ? 1 : 0, grid[8][7] ? 1 : 0);
    for (let i = 9; i < 15; i++) bits.push(grid[8][14 - i] ? 1 : 0);
    let value = 0;
    for (let i = 0; i <= 14; i++) value |= bits[i] << i; // bit i of the format code word
    const raw = value ^ 0x5412;
    let rem = raw;
    for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    assert.equal(rem, 0, 'the format code word is valid');
    assert.equal((raw >>> 13) & 0b11, 0b00, 'error level M');
    assert.ok(n >= 21);
  }
});

test('a PDF has a valid cross-reference table and a single trailer', () => {
  const pdf = buildPdf([{ widthMm: 85, heightMm: 55, content: 'BT /F1 10 Tf 6 6 Td (Hi) Tj ET\n', images: [] }], [], 'Check');
  const text = pdf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.equal(text.slice(xrefAt, xrefAt + 4), 'xref');
  const entries = [...text.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  for (const offset of entries) assert.match(text.slice(offset, offset + 12), /^\d+ 0 obj/, `offset ${offset} starts an object`);
  assert.equal(text.match(/%%EOF/g)!.length, 1);
});

test('JPEG and PNG backgrounds are read; anything else is refused with a clear message', () => {
  assert.throws(() => readImage(Buffer.from('GIF89a not a real file')), PdfError);
  assert.equal(readImage(PNG).kind, 'png');
});

test('text that cannot be drawn with the print font is refused, and Latin text is accepted', () => {
  assert.doesNotThrow(() => assertPrintable('SPRING 10% OFF — Dubai (AED 5)'.replace('—', '-'), 'Test'));
  assert.throws(() => assertPrintable('مطبخ', 'Restaurant name'), /cannot draw yet/);
});

test('printing needs a design, and a design that is too small for its QR code is refused', async () => {
  const campaign = await c.createCampaign({ name: 'No design', startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'x', ar: 'x' }, type: 'percent', value: 500, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  const plain = await c.createPool(campaign.id, { offerId: offers[0].id, codePattern: 'NOD##-@@@' });
  await c.createBatch(plain.id, { quantity: 3, expiresAt: new Date(Date.now() + 20 * day) }, 'nodesign-0001');
  await expectRule(printPdf(plain.id, 'a4', null, 'staff'), 'no_design');

  const small = await publishedPool('Small QR', [codeField(), qrField({ w: 8, h: 8, x: 60, y: 8 })], 'SML##-@@@');
  await c.createBatch(small.id, { quantity: 2, expiresAt: new Date(Date.now() + 20 * day) }, 'smallqr-0001');
  await expectRule(printPdf(small.id, 'card', null, 'staff'), 'qr_too_small');
});

test('text that does not fit its box is refused, not cut off', async () => {
  const pool = await publishedPool('Overflow', [codeField({ h: 4, fontSizePt: 30, w: 20 })], 'OVF##-@@@');
  await c.createBatch(pool.id, { quantity: 2, expiresAt: new Date(Date.now() + 20 * day) }, 'overflow-0001');
  await expectRule(printPdf(pool.id, 'card', null, 'staff'), 'does_not_fit');
});

test('printing sends only usable vouchers, writes the print log, and the PDF has one page per card', async () => {
  const pool = await publishedPool('Cards', [codeField(), qrField()], 'CRD##-@@@');
  await c.createBatch(pool.id, { quantity: 5, expiresAt: new Date(Date.now() + 20 * day) }, 'cards-batch-01');
  const { rows } = await db.query(`select id from vouchers where pool_id = $1 order by created_at limit 1`, [pool.id]);
  await db.query(`update vouchers set status = 'revoked', revoked_at = now() where id = $1`, [rows[0].id]);
  const result = await printPdf(pool.id, 'card', null, 'staff');
  assert.equal(result.count, 4, 'the revoked voucher is not printed');
  assert.match(result.pdf.toString('latin1', 0, 8), /^%PDF-1\.4/);
  assert.equal((result.pdf.toString('latin1').match(/\/Type \/Page /g) ?? []).length, 4);
  const log = await db.query(`select kind, format, voucher_count from voucher_print_jobs where pool_id = $1`, [pool.id]);
  assert.deepEqual(log.rows, [{ kind: 'print', format: 'card', voucher_count: 4 }]);
});

test('an A4 sheet fits as many cards as the page allows, and the codes it prints are the stored codes', async () => {
  const pool = await publishedPool('Sheet', [codeField(), qrField()], 'SHT##-@@@');
  await c.createBatch(pool.id, { quantity: 9, expiresAt: new Date(Date.now() + 20 * day) }, 'sheet-batch-01');
  const sheet = await printPdf(pool.id, 'a4', null, 'staff');
  assert.equal(sheet.count, 9);
  const pages = (sheet.pdf.toString('latin1').match(/\/Type \/Page /g) ?? []).length;
  assert.equal(pages, 2, 'eight cards per A4 page: nine vouchers need two pages');
});

test('the export lists every code once with its serial, and each export is recorded', async () => {
  const pool = await publishedPool('Export', [codeField()], 'EXP##-@@@');
  await c.createBatch(pool.id, { quantity: 6, expiresAt: new Date(Date.now() + 20 * day) }, 'export-batch-1');
  const csv = await exportCsv(pool.id, null, 'staff');
  const lines = csv.csv.trim().split('\n');
  assert.equal(lines[0], 'code,serial,status,expires_at,batch_id');
  assert.equal(lines.length, 7);
  const codes = lines.slice(1).map((l) => l.split(',')[0]);
  assert.equal(new Set(codes).size, 6);
  for (const code of codes) assert.match(code, /^EXP\d\d-[A-Z]{3}$/);
  const log = await db.query(`select kind, format, voucher_count from voucher_print_jobs where pool_id = $1`, [pool.id]);
  assert.deepEqual(log.rows, [{ kind: 'export', format: 'csv', voucher_count: 6 }]);
});

test('a stored code that does not match its hash stops the print', async () => {
  const pool = await publishedPool('Tamper', [codeField()], 'TMP##-@@@');
  await c.createBatch(pool.id, { quantity: 2, expiresAt: new Date(Date.now() + 20 * day) }, 'tamper-batch-1');
  await db.query(`update vouchers set code_hash = repeat('0', 64) where pool_id = $1 and id = (select id from vouchers where pool_id = $1 limit 1)`, [pool.id]);
  await expectRule(printPdf(pool.id, 'card', null, 'staff'), 'integrity');
});

test('the background picture is read from its stored file when printing', async () => {
  const tpl = await t.createTemplate({ name: 'Background print', widthMm: 85, heightMm: 55 });
  await t.setBackground(tpl.id, PNG);
  await t.updateDraft(tpl.id, { fields: [codeField()] });
  await t.publishTemplate(tpl.id);
  const campaign = await c.createCampaign({ name: 'Background', startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 40 * day) });
  await c.createCampaignOffer(campaign.id, { name: { en: 'x', ar: 'x' }, type: 'fixed', value: 500, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 39 * day) });
  await c.transitionCampaign(campaign.id, 'activate');
  const { offers } = await c.getCampaign(campaign.id);
  const pool = await c.createPool(campaign.id, { offerId: offers[0].id, codePattern: 'BGP##-@@@', templateId: tpl.id });
  await c.createBatch(pool.id, { quantity: 1, expiresAt: new Date(Date.now() + 20 * day) }, 'bg-batch-0001');
  const result = await printPdf(pool.id, 'card', null, 'staff');
  assert.match(result.pdf.toString('latin1'), /\/Subtype \/Image/);
});
