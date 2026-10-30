// Customer web pages audit at 320, 390 and 1280 px: the same checks as the admin audit, empty and with a cart.
// Usage: WEB_URL=http://127.0.0.1:3100 node test/ui-audit/web-audit.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { probe } from './probe.mjs';
const AXE = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const BASE = process.env.WEB_URL ?? 'http://127.0.0.1:3100';
const out = [];
const b = await chromium.launch();
for (const width of [320, 390, 1280]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type()==='error' && !/401/.test(m.text())) errs.push(m.text()); });
  const audit = async (where) => {
    await page.waitForTimeout(900);
    const issues = await page.evaluate(probe);
    await page.addScriptTag({ content: AXE });
    const ax = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0,2).map(n=>n.target).join(' | ')}`));
    for (const i of new Set([...issues, ...ax.map(a=>'axe '+a)])) out.push(`${width} ${where}: ${i}`);
  };
  for (const path of ['/', '/menu', '/cart', '/checkout', '/admin/login']) { await page.goto(BASE + path); await audit(path); }
  await page.goto(BASE + '/menu'); await page.waitForTimeout(800);
  const add = page.locator('button', { hasText: /^add/i }).first();
  if (await add.count()) { await add.click(); await page.waitForTimeout(600); await page.goto(BASE + '/cart'); await audit('/cart (filled)'); await page.goto(BASE + '/checkout'); await audit('/checkout (filled)'); }
  for (const e of new Set(errs)) out.push(`${width} console: ${e.slice(0,200)}`);
  await ctx.close();
}
await b.close();
console.log(out.length ? out.join('\n') : 'No problems found.');
