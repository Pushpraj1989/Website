// Take a real screenshot of a running app or page, ready to drop into the film's public/shots/.
//   node capture.mjs --url https://app.example --out public/shots/app-home.png [--device phone|desktop] [--wait 6000]
//        [--click "195,620"] [--click2 "40,318"] [--host-map "app.example=127.0.0.1"] [--full]
// phone   = 390x844 at 3x (an iPhone 13), touch, so the file is 1170x2532: what the Phone frame in the film expects.
// desktop = 1600x1000 at 2x.
// --click / --click2 tap a point after the wait (close a welcome pop-up, choose "continue as guest"), then wait again.
// Shoot the real product with real or clearly demo data. Never retouch a screenshot to show something the product can't do.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : acc), []));
if (!args.url || !args.out) { console.error('Need --url and --out'); process.exit(1); }
const phone = (args.device ?? 'phone') === 'phone';
const launch = { args: [] };
if (args['host-map']) { const [h, ip] = String(args['host-map']).split('='); launch.args.push(`--host-resolver-rules=MAP ${h} ${ip}`, '--ignore-certificate-errors'); }
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({
  viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
  deviceScaleFactor: phone ? 3 : 2, isMobile: phone, hasTouch: phone, locale: 'en-US', ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(String(args.url));
await page.waitForTimeout(Number(args.wait ?? 6000));
for (const key of ['click', 'click2']) {
  if (args[key]) { const [x, y] = String(args[key]).split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(3500); }
}
await page.screenshot({ path: String(args.out), fullPage: Boolean(args.full) });
console.log(`saved ${args.out}; page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
await browser.close();
