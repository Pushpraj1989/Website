import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require2 = createRequire(import.meta.url);
const { chromium } = require2('playwright');
const AXE = readFileSync(process.env.AXE, 'utf8');
const OUT = process.env.OUT;
const pages = ['orders', 'products', 'categories', 'offers', 'promotions', 'zones', 'assistant'];
const browser = await chromium.launch();
const results = {};
for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto('http://127.0.0.1:4173/#/orders');
  await page.fill('input[type=password]', 'slice-test-password-1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  for (const route of pages) {
    await page.evaluate((r) => { window.location.hash = '#/' + r; }, route);
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    results[`${width}/${route}`] = { violations: axe, pageOverflowPx: overflow };
    await page.screenshot({ path: `${OUT}/a11y-${width}-${route}.png`, fullPage: false });
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
