import { test, expect } from '@playwright/test';

// Regression: the language link is a POST form. A GET that set the cookie flipped languages on prefetch.
test('the language stays put while the menu prefetches its links', async ({ page }) => {
  await page.goto('/menu');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
});

// Regression: behind nginx the server's own address is 127.0.0.1:3100. The redirect must be a bare path, or the
// language button sends customers to https://localhost:3100/menu.
test('switching language redirects to a path on the same site, never to the server address', async ({ request }) => {
  const response = await request.post('/set-locale', { form: { lang: 'ar', next: '/menu' }, maxRedirects: 0, headers: { host: 'resturant.example.com' } });
  expect(response.status()).toBe(303);
  expect(response.headers()['location']).toBe('/menu');
  const unsafe = await request.post('/set-locale', { form: { lang: 'en', next: '//evil.example' }, maxRedirects: 0 });
  expect(unsafe.headers()['location']).toBe('/menu');
});
