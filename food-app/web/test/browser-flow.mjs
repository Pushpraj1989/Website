// Browser walkthrough at phone width (390px): customer orders, staff accepts, customer sees "Accepted".
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:3100'; // Secure cookies need a secure origin; localhost counts as one
const ADMIN_PASSWORD = 'slice-test-password-1';
const SHOTS = '/home/user/Website/replica/clone-screens';


// Fresh schema and seed for every run. The fake store is gone; the test database is the real one.
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
await new Promise((resolve, reject) => {
  const migrate = spawn(process.execPath, [`${ROOT}db/migrate.mjs`, '--reset'], { env: { ...process.env, DATABASE_URL }, stdio: 'inherit' });
  migrate.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('migrate failed'))));
});
const server = spawn(process.execPath, [`${ROOT}node_modules/next/dist/bin/next`, 'start', '-p', '3100'], {
  cwd: ROOT,
  detached: true,
  env: { ...process.env, DATABASE_URL, NEXT_TELEMETRY_DISABLED: '1', ADMIN_PASSWORD, STRIPE_SECRET_KEY: 'sk_test_slice_placeholder', STRIPE_WEBHOOK_SECRET: 'whsec_slice_test_secret', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_slice_placeholder' },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/v1/menu`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

const consoleErrors = [];
const browser = await chromium.launch();
try {
  await waitForServer();
  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: false };
  const customer = await browser.newContext(phone);
  const page = await customer.newPage();
  const watch = (p, who) => {
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${who}: ${m.text()}`); });
    p.on('pageerror', (e) => consoleErrors.push(`${who}: ${e.message}`));
  };
  watch(page, 'customer');

  await page.goto(`${BASE}/menu`);
  await page.getByRole('heading', { name: 'Menu' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/S02.png`, fullPage: true });

  // Keyboard only: tab to the first Add button and press Enter.
  await page.getByRole('button', { name: 'Add: Garden salad' }).focus();
  await page.keyboard.press('Enter');
  await page.getByText('✓').first().waitFor();
  await page.getByRole('button', { name: 'Add: Grilled chicken plate' }).click();
  await page.getByRole('button', { name: 'Add: Grilled chicken plate' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[role="status"]').length > 0);
  assert.ok(await page.getByText('Sold out').first().isVisible(), 'sold-out badge shows');

  await page.goto(`${BASE}/cart`);
  await page.getByText('Garden salad', { exact: true }).waitFor();
  await page.screenshot({ path: `${SHOTS}/S05.png`, fullPage: true });
  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.waitForURL('**/checkout');
  await page.getByRole('button', { name: 'Add a new address' }).click();
  await page.getByRole('textbox', { name: 'Street, building and area' }).fill('Flat 4, Example Tower, Al Barsha, Dubai');
  await page.getByRole('combobox', { name: 'Delivery area' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.getByRole('radio', { name: /Flat 4/ }).waitFor();
  await page.getByRole('button', { name: 'Place order' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/S06.png`, fullPage: true });
  await page.getByRole('button', { name: 'Place order' }).click();
  await page.waitForURL(/\/orders\//);
  await page.getByRole('status').filter({ hasText: 'Placed' }).waitFor();
  const orderUrl = page.url();
  await page.screenshot({ path: `${SHOTS}/S10.png`, fullPage: true });

  // Staff in a second browser.
  const staffContext = await browser.newContext(phone);
  const staff = await staffContext.newPage();
  watch(staff, 'staff');
  await staff.goto(`${BASE}/admin/login`);
  await staff.getByLabel('Password').fill(ADMIN_PASSWORD);
  await staff.getByRole('button', { name: 'Sign in' }).click();
  await staff.waitForURL('**/admin');
  await staff.getByRole('heading', { name: 'Live orders' }).waitFor();
  await staff.getByRole('button', { name: 'Accept' }).first().click();
  await staff.getByRole('button', { name: /Move to next step: Preparing/ }).first().waitFor();
  await staff.screenshot({ path: `${SHOTS}/A02.png`, fullPage: true });

  // The customer's open order page updates on its own (polling every 5 seconds).
  await page.getByRole('status').filter({ hasText: 'Accepted' }).waitFor({ timeout: 12000 });
  assert.ok(orderUrl.includes('/orders/'));

  // Arabic: the same screens flip to right-to-left with Arabic text and western digits.
  await page.getByRole('button', { name: 'العربية' }).click();
  await page.getByRole('heading', { name: 'القائمة' }).waitFor();
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  await page.screenshot({ path: `${SHOTS}/S02-ar.png`, fullPage: true });

  // No horizontal scrolling at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px`);

  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  console.log('ok   browser flow: menu, keyboard add, cart, COD checkout, staff accept, customer sees Accepted, Arabic RTL, no sideways scroll, no console errors');
} catch (error) {
  console.error('FAIL browser flow:', error.message);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
