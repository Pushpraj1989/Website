import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
await page.goto('http://127.0.0.1:4173/#/orders');
await page.fill('input[type=password]', 'slice-test-password-1');
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
for (const r of ['products', 'offers', 'promotions', 'zones']) {
  await page.evaluate((x) => { window.location.hash = '#/' + x; }, r);
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'hidden' || o === 'scroll') return true; } return false; };
    return [...document.body.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > vw + 2 && !clipped(e))
      .slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 36)} right=${Math.round(e.getBoundingClientRect().right)}`);
  });
  console.log(r, JSON.stringify(out));
}
await browser.close();
