// A walk through every staff form, as a person would use it: sign in (empty, wrong, right), then each editor in the
// console: fill it in, save, reload and check the value was kept; enter something wrong and check a clear message
// appears. Each open form is also checked for alignment (fields on one row line up and are the same height, nothing
// spills out of its card) and photographed. Uses the local test database: it creates records.
// Usage: ADMIN_URL=http://127.0.0.1:4173 OUT=/some/folder node test/ui-audit/form-walkthrough.mjs <file holding the staff password>
// APPEARANCE='{"mode":"dark","wallpaper":"ocean","glass":"clear"}' and WIDTH=390 run it in another look or width.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:4173';
const OUT = process.env.OUT ?? 'form-walkthrough';
const WIDTH = Number(process.env.WIDTH ?? 1280);
const TAG = `${WIDTH}${process.env.APPEARANCE ? '-' + JSON.parse(process.env.APPEARANCE).mode : ''}`;
const PW = readFileSync(process.argv[2], 'utf8').trim();
const RUN = Date.now().toString(36).slice(-4).toUpperCase();
mkdirSync(OUT, { recursive: true });

const results = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, locale: 'en-US' });
if (process.env.APPEARANCE) await page.addInitScript((a) => localStorage.setItem('console-appearance', a), process.env.APPEARANCE);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// Fields on the same row should share a top edge and a height; labels whose text wraps push their field down.
// Nothing inside a card or form may stick out of it, and every field must have a visible label or a name.
async function alignment(scope) {
  return page.evaluate((sel) => {
    const issues = [];
    const root = document.querySelector(sel) ?? document.querySelector('main');
    if (!root) return ['no form on screen'];
    const fields = [...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), select, textarea')]
      .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0);
    const rows = [];
    for (const el of fields) {
      const r = el.getBoundingClientRect();
      const row = rows.find((x) => Math.abs(x.mid - (r.top + r.height / 2)) < 14 && el.tagName !== 'TEXTAREA');
      if (row) row.items.push({ el, r }); else rows.push({ mid: r.top + r.height / 2, items: [{ el, r }] });
    }
    const name = (el) => el.labels?.[0]?.textContent.trim().slice(0, 30) || el.getAttribute('aria-label') || el.name || el.tagName;
    for (const row of rows) {
      if (row.items.length < 2) continue;
      const tops = row.items.map((i) => i.r.top), hs = row.items.filter((i) => i.el.tagName !== 'TEXTAREA').map((i) => i.r.height);
      if (Math.max(...tops) - Math.min(...tops) > 3) issues.push(`fields on one row do not line up: ${row.items.map((i) => `${name(i.el)}@${Math.round(i.r.top)}`).join(', ')}`);
      if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 2) issues.push(`fields on one row differ in height: ${row.items.map((i) => `${name(i.el)} ${Math.round(i.r.height)}px`).join(', ')}`);
    }
    for (const el of fields) {
      const box = el.closest('.card, form, dialog, .drawer') ?? root;
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.right > b.right + 1 || r.left < b.left - 1) issues.push(`field sticks out of its card: ${name(el)}`);
      if (!el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) issues.push(`field without a label: ${name(el)}`);
    }
    // The map's own zoom buttons are labelled and 29 px, above the 24 px minimum; they are left as the map draws them.
    for (const b of root.querySelectorAll('button:not(.maplibregl-ctrl button)')) {
      const r = b.getBoundingClientRect();
      if (r.width && (r.height < 32 || b.scrollWidth > b.clientWidth + 1)) issues.push(`button too small or its text cut off: ${b.textContent.trim().slice(0, 30)}`);
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push('the page scrolls sideways');
    return issues;
  }, scope);
}

async function step(name, fn) {
  const before = pageErrors.length;
  try {
    const note = await fn();
    const errs = pageErrors.slice(before);
    results.push({ name, ok: errs.length === 0, note: errs.length ? `page error: ${errs[0]}` : note ?? '' });
  } catch (e) {
    results.push({ name, ok: false, note: e.message.split('\n')[0] });
    await page.screenshot({ path: `${OUT}/FAIL-${TAG}-${name.replace(/\W+/g, '-').slice(0, 40)}.png` }).catch(() => {});
  }
}

async function shoot(name, scope = 'main') {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png`, fullPage: true });
  const issues = await alignment(scope);
  results.push({ name: `alignment: ${name}`, ok: issues.length === 0, note: issues.slice(0, 4).join('; ') });
}

// The result of pressing a save button: the green status line or the red alert, whichever appears.
async function outcome(timeout = 8000) {
  const ok = page.locator('[role=status].ok, main [role=status]:not(.live)').filter({ hasText: /\S/ }).first();
  const bad = page.locator('[role=alert]').filter({ hasText: /\S/ }).first();
  await Promise.race([ok.waitFor({ timeout }), bad.waitFor({ timeout })]).catch(() => {});
  if (await bad.isVisible().catch(() => false)) return { ok: false, text: (await bad.innerText()).trim() };
  if (await ok.isVisible().catch(() => false)) return { ok: true, text: (await ok.innerText()).trim() };
  return { ok: null, text: 'no message appeared' };
}
const expectSaved = async () => { const o = await outcome(); if (o.ok !== true) throw new Error(`not saved: ${o.text}`); return o.text; };
const expectRefused = async () => { const o = await outcome(); if (o.ok !== false) throw new Error(`a wrong value was accepted (${o.text})`); return `refused: "${o.text}"`; };

async function open(section) {
  await page.goto(`${ADMIN}/#/${section}`);
  await page.reload();
  await page.waitForSelector('.shell');
  await page.waitForTimeout(600);
}
const main = () => page.locator('main');
const field = (label) => main().getByLabel(label, { exact: false }).first();
const click = (text) => main().getByRole('button', { name: text, exact: false }).first().click();

// ---------------- Sign in ----------------
await page.goto(ADMIN);
await page.waitForSelector('input[type=password]');
await shoot('sign-in', '.login');
await step('sign-in: empty password is stopped by the form', async () => {
  await page.click('button[type=submit]');
  const invalid = await page.$eval('input[type=password]', (el) => !el.validity.valid);
  if (!invalid) throw new Error('an empty password was sent');
  if (await page.locator('.shell').count()) throw new Error('signed in with no password');
  return 'the browser asks for the password';
});
await step('sign-in: a wrong password shows a message', async () => {
  await page.fill('input[type=password]', 'not-the-password-123');
  await page.click('button[type=submit]');
  return expectRefused();
});
await shoot('sign-in-error', '.login');
await step('sign-in: the right password opens the console', async () => {
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForSelector('.shell', { timeout: 15000 });
  return 'console opened';
});

// ---------------- Restaurant settings ----------------
await open('restaurant');
await shoot('restaurant');
await step('restaurant: phone and tagline save and are still there after reload', async () => {
  await field('Phone').fill('+971 4 555 0101');
  await field('Tagline (English)').fill(`Fresh food, made daily ${RUN}`);
  await click('Save settings');
  const msg = await expectSaved();
  await open('restaurant');
  const phone = await field('Phone').inputValue(), tag = await field('Tagline (English)').inputValue();
  if (!phone.replace(/\s/g, '').includes('97145550101')) throw new Error(`phone after reload: ${phone}`);
  if (!tag.includes(RUN)) throw new Error(`tagline after reload: ${tag}`);
  return msg;
});
await step('restaurant: an empty name is refused', async () => {
  await field('Name (English)').fill('');
  await click('Save settings');
  const invalid = await main().locator('input:invalid').count();
  if (invalid) return 'the form marks the empty name as required';
  return expectRefused();
});

// ---------------- Categories ----------------
await open('categories');
await shoot('categories');
await step('categories: a new category saves and is listed after reload', async () => {
  await field('English name').fill(`Desserts ${RUN}`);
  await field('Arabic name').fill('حلويات');
  await click('Add category');
  const msg = await expectSaved();
  await open('categories');
  if (!(await main().locator(`input[value="Desserts ${RUN}"], td:has-text("Desserts ${RUN}")`).count()) && !(await main().getByText(`Desserts ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});

// ---------------- Dishes ----------------
await open('products');
await step('dishes: a new dish saves and is listed after reload', async () => {
  await click('Add product');
  await page.waitForTimeout(400);
  await shoot('dish-editor');
  await field('Name (English)').fill(`Walkthrough wrap ${RUN}`);
  await field('Name (Arabic)').fill('لفافة');
  await field('Price').fill('24.50');
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  const msg = await expectSaved();
  await open('products');
  if (!(await main().getByText(`Walkthrough wrap ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});
await step('dishes: changing the price is kept', async () => {
  const row = main().locator('tr', { hasText: `Walkthrough wrap ${RUN}` }).first();
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.waitForTimeout(300);
  await field('Price').fill('26');
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  await expectSaved();
  await open('products');
  const text = await main().locator('tr', { hasText: `Walkthrough wrap ${RUN}` }).first().innerText();
  if (!text.includes('26.00')) throw new Error(`row after reload: ${text.replace(/\s+/g, ' ')}`);
  return 'price now 26.00';
});
await step('dishes: a price that is not a number is refused', async () => {
  await click('Add product');
  await field('Name (English)').fill('Bad price');
  await field('Name (Arabic)').fill('سعر');
  await field('Price').fill('abc');
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  if (await main().locator('input:invalid').count()) return 'the form marks the price as wrong';
  return expectRefused();
});

// ---------------- Offers ----------------
await open('offers');
await step('offers: a 15% code saves and is listed after reload', async () => {
  await click('Add offer');
  await page.waitForTimeout(400);
  await shoot('offer-editor');
  await field('Name (English)').fill(`Walk ${RUN}`);
  await field('Name (Arabic)').fill('عرض');
  const type = field('Type');
  const opts = await type.locator('option').allInnerTexts();
  const pctOpt = opts.find((o) => /percent|%/i.test(o));
  if (pctOpt) await type.selectOption({ label: pctOpt });
  await main().locator('input[name=percent]').fill('15');
  await main().locator('input[name=code]').fill(`WALK${RUN}`);
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  const msg = await expectSaved();
  await open('offers');
  if (!(await main().getByText(`WALK${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});
await step('offers: 150% off is refused', async () => {
  await click('Add offer');
  await field('Name (English)').fill(`Too much ${RUN}`);
  await field('Name (Arabic)').fill('كثير');
  const type = field('Type');
  const opts = await type.locator('option').allInnerTexts();
  const pctOpt = opts.find((o) => /percent|%/i.test(o));
  if (pctOpt) await type.selectOption({ label: pctOpt });
  await main().locator('input[name=percent]').fill('150');
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  if (await main().locator('input:invalid').count()) return 'the form marks 150 as out of range';
  return expectRefused();
});

// ---------------- Promotions ----------------
await open('promotions');
await step('promotions: a carousel card saves and is listed after reload', async () => {
  await click('Add promotion');
  await page.waitForTimeout(500);
  await shoot('promotion-editor');
  const where = field('Where it shows');
  const opts = await where.locator('option').allInnerTexts();
  const carousel = opts.find((o) => /carousel/i.test(o));
  if (carousel) await where.selectOption({ label: carousel });
  await page.waitForTimeout(200);
  await field('Title (English)').fill(`Weekend treat ${RUN}`);
  await field('Title (Arabic)').fill('عرض نهاية الأسبوع');
  await main().getByRole('button', { name: /^(Save|Saving…)$/ }).first().click();
  const msg = await expectSaved();
  await open('promotions');
  if (!(await main().getByText(`Weekend treat ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});

// ---------------- Delivery areas ----------------
await open('zones');
await step('delivery areas: changing a fee is kept', async () => {
  await main().getByRole('button', { name: 'Edit' }).first().click();
  await page.waitForTimeout(500);
  await shoot('zone-editor');
  const fee = main().getByLabel(/Delivery fee/).first();
  await fee.fill('9');
  await click('Save area');
  const msg = await expectSaved();
  await open('zones');
  if (!(await main().getByText(/9\.00/).count())) throw new Error('new fee not shown after reload');
  return msg;
});

// ---------------- Assistant ----------------
await open('assistant');
await shoot('assistant');
await step('assistant: a key is checked with the provider, with a clear message when it cannot be used', async () => {
  // Save stays off until "Load models" has read the provider's model list with the key, so a key that does not work is
  // never stored. This test machine cannot reach the providers, so the check expects a message, not a model list.
  const save = main().getByRole('button', { name: /^(Save|Saving…)$/ }).first();
  if (!(await save.isDisabled())) throw new Error('Save is on before the key was checked');
  await field('Provider key').fill('sk-walkthrough-not-a-real-key-123456');
  await main().getByRole('button', { name: /Load models/i }).first().click();
  const o = await outcome(20000);
  if (o.ok === null) throw new Error('no message after Load models');
  await open('assistant');
  if ((await field('Provider key').inputValue()).includes('walkthrough')) throw new Error('the key is shown again after reload');
  return `${o.ok ? 'models loaded' : 'message'}: "${o.text}"`;
});

// ---------------- Campaigns, partners, voucher designs ----------------
await open('campaigns');
await step('campaigns: a draft campaign saves and is listed after reload', async () => {
  await click('New campaign');
  await page.waitForTimeout(400);
  await shoot('campaign-editor');
  await main().getByLabel('Name', { exact: true }).first().fill(`Walk campaign ${RUN}`);
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 16);
  await main().locator('input[name=startsAt]').first().fill(day(1));
  await main().locator('input[name=endsAt]').first().fill(day(30));
  await click('Create as draft');
  const msg = await expectSaved();
  await open('campaigns');
  if (!(await main().getByText(`Walk campaign ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});
await open('partners');
await shoot('partners');
await step('partners: a new partner gets a key once, then is listed', async () => {
  await main().getByLabel('Name', { exact: true }).first().fill(`Walk partner ${RUN}`);
  await click('Create partner and key');
  const msg = await expectSaved();
  const copied = main().getByRole('button', { name: 'I have copied it' });
  if (await copied.count()) await copied.click();
  await open('partners');
  if (!(await main().getByText(`Walk partner ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});
await open('designs');
await step('voucher designs: a new design is created', async () => {
  await click('New design');
  await page.waitForTimeout(400);
  await shoot('design-editor');
  await main().getByLabel('Name', { exact: true }).first().fill(`Walk design ${RUN}`);
  await click('Create design');
  const msg = await expectSaved();
  await open('designs');
  if (!(await main().getByText(`Walk design ${RUN}`).count())) throw new Error('not listed after reload');
  return msg;
});

await open('appearance');
await shoot('appearance');
await open('dashboard');
await shoot('dashboard');

await browser.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.note ? `  — ${r.note}` : ''}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed (${TAG})`);
process.exit(failed.length ? 1 : 0);
