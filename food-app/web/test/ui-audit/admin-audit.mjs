// Admin layout and accessibility audit: every section at 390 and 1280 px, plus each "new / add / edit" editor it opens.
// Checks sideways scroll, controls off-screen or out of their box, clipped and overlapping text, unnamed controls,
// console errors and axe (WCAG 2.2 AA). Uses the local test database: opening editors can create records.
// Usage: ADMIN_URL=http://127.0.0.1:4173 node test/ui-audit/admin-audit.mjs <file holding the staff password>
// APPEARANCE='{"mode":"dark","wallpaper":"ocean"}' runs it in another console look (see admin/src/appearance.js).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { probe } from './probe.mjs';
const AXE = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:4173';
const PW = readFileSync(process.argv[2], 'utf8').trim();
const SECTIONS = ['dashboard','orders','products','categories','offers','campaigns','designs','partners','reports','promotions','zones','assistant','restaurant','appearance'];
const out = [];
const browser = await chromium.launch();
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  if (process.env.APPEARANCE) await page.addInitScript((a) => localStorage.setItem('console-appearance', a), process.env.APPEARANCE);
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type()==='error' && !/401/.test(m.text())) errs.push(m.text()); });
  await page.goto(`${ADMIN}/#/orders`);
  const loginIssues = await page.evaluate(probe); await page.addScriptTag({ content: AXE });
  const la = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target}`));
  for (const i of [...loginIssues, ...la.map(a=>'axe '+a)]) out.push(`${width} login: ${i}`);
  await page.fill('input[type=password]', PW); await page.keyboard.press('Enter'); await page.waitForSelector('.shell', { timeout: 20000 });
  const audit = async (where) => {
    await page.waitForTimeout(700);
    const issues = await page.evaluate(probe);
    await page.addScriptTag({ content: AXE });
    const ax = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'], rules: { region: { enabled: false } } })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0,2).map(n=>n.target).join(' | ')}`));
    for (const i of new Set([...issues, ...ax.map(a=>'axe '+a)])) out.push(`${width} ${where}: ${i}`);
  };
  for (const s of SECTIONS) {
    await page.goto(`${ADMIN}/#/${s}`); await page.reload(); await page.waitForSelector('.shell');
    await audit(s);
    // Open each editor the section offers (new / add / edit first row), audit it, then go back.
    const labels = await page.locator('main button:visible').evaluateAll((bs) => [...new Set(bs.map(b => (b.getAttribute('aria-label') || b.textContent).trim()).filter(t => /^(new|add|edit|create|\+)/i.test(t)))].slice(0, 4));
    for (const l of labels) {
      await page.goto(`${ADMIN}/#/${s}`); await page.reload(); await page.waitForSelector('.shell'); await page.waitForTimeout(500);
      const b = page.locator('main button:visible', { hasText: l }).first();
      if (!(await b.count())) continue;
      await b.click().catch(() => {});
      await audit(`${s} › ${l.slice(0,24)}`);
    }
  }
  for (const e of new Set(errs)) out.push(`${width} console: ${e.slice(0,200)}`);
  await page.close();
}
await browser.close();
console.log(out.length ? out.join('\n') : 'No problems found.');
