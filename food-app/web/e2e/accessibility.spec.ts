import { test, expect } from '@playwright/test';
import { addToCart, expectAccessible, failOnErrors } from './helpers.ts';

// Every screen: axe scan, no sideways scroll, and the Arabic version flips to right-to-left.
test.describe('screens in both languages', () => {
  test('login and menu pass the scan and do not scroll sideways', async ({ page }) => {
    const noErrors = failOnErrors(page);
    await page.goto('/menu');
    await expectAccessible(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.goto('/admin/login');
    await expectAccessible(page);
    await noErrors();
  });

  test('Arabic menu is right-to-left and passes the scan', async ({ page }) => {
    await page.goto('/menu');
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(page.getByRole('heading', { name: 'القائمة' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectAccessible(page);
  });

  test('Arabic cart and checkout pass the scan', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.getByRole('button', { name: 'العربية' }).click();
    await page.goto('/cart');
    await expectAccessible(page);
    await page.goto('/checkout');
    await expectAccessible(page);
  });
});
