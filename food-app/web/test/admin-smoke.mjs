// Browser smoke test for the admin console: every section opens, shows no page errors, and does not scroll sideways
// at phone width (390 px) or desktop width (1280 px). Needs a running admin (ADMIN_URL) and its API, and the password.
// Usage: ADMIN_URL=http://127.0.0.1:4173 ADMIN_PASSWORD=... node test/admin-smoke.mjs
import { chromium } from 'playwright';

const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:4173';
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) throw new Error('Set ADMIN_PASSWORD');
const SECTIONS = ['orders', 'products', 'categories', 'offers', 'campaigns', 'designs', 'partners', 'reports', 'promotions', 'zones', 'assistant'];
const WIDTHS = [390, 1280];

const browser = await chromium.launch();
const failures = [];
try {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      // The sign-in check fails with 401 before anyone has signed in; that is expected and not a page error.
      if (m.type() === 'error' && !m.text().includes('401')) pageErrors.push(m.text());
    });
    await page.goto(`${ADMIN}/#/orders`);
    await page.fill('input[type=password]', PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.shell', { timeout: 20000 });
    for (const section of SECTIONS) {
      await page.goto(`${ADMIN}/#/${section}`);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) failures.push(`${section} at ${width}px scrolls sideways by ${overflow}px`);
      const heading = await page.locator('h1').first().textContent().catch(() => null);
      if (!heading) failures.push(`${section} at ${width}px has no heading`);
      console.log(`${width}px  ${section.padEnd(11)} heading="${heading?.trim() ?? '—'}" overflow=${overflow}px`);
    }
    for (const e of pageErrors) failures.push(`page error at ${width}px: ${e.slice(0, 160)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.log('\nFAILURES');
  for (const f of failures) console.log(' -', f);
  process.exit(1);
}
console.log('\nAll admin sections open at both widths with no page errors and no sideways scrolling.');
