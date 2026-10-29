import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://127.0.0.1:4173/#/orders');
await page.waitForTimeout(800);
// Sign in with the keyboard only: Tab to the password field, type, press Enter.
await page.keyboard.press('Tab');
const first = await page.evaluate(() => document.activeElement.outerHTML.slice(0, 60));
await page.locator('input[type=password]').focus();
await page.keyboard.type('slice-test-password-1');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const stops = [];
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    const visible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 40), outline: visible, label: !!(el.getAttribute('aria-label') || el.textContent.trim() || el.labels?.length) };
  });
  stops.push(info);
}
const unlabelled = stops.filter((s) => !s.label);
const noFocus = stops.filter((s) => !s.outline);
console.log(JSON.stringify({ stops: stops.length, unlabelled, noFocusRing: noFocus.map((s) => s.tag + ':' + s.text), sample: stops.slice(0, 10) }, null, 1));
await browser.close();
