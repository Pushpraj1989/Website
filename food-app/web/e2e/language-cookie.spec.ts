import { test, expect } from '@playwright/test';

// Regression: the language link is a POST form. A GET that set the cookie flipped languages on prefetch.
test('the language stays put while the menu prefetches its links', async ({ page }) => {
  await page.goto('/menu');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
});
