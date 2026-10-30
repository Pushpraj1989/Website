import { test, expect, type Page } from '@playwright/test';
import { addDeliveryAddress, ADMIN_PASSWORD, addToCart, expectAccessible, failOnErrors } from './helpers.ts';

async function placeCodOrder(page: Page) {
  await addToCart(page, 'Garden salad');
  await page.goto('/checkout');
  await addDeliveryAddress(page, 'Villa 9, Jumeirah, Dubai');
  await page.getByRole('button', { name: 'Place order' }).click();
  await page.waitForURL(/\/orders\//);
  return page.url();
}

// F02: staff sign in, accept an order, and the customer sees it.
test.describe('F02 staff runs the live board', () => {
  test('F02-N1 wrong password is refused with a message', async ({ page }) => {
    const noErrors = failOnErrors(page, [/status of 401/]);
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('That password is not right.');
    await expect(page).toHaveURL(/\/admin\/login/);
    await noErrors();
  });

  test('F02-E1 the board is not visible without signing in', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('F02-H1 staff accepts, and the customer sees Accepted without reloading', async ({ browser }) => {
    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    const orderUrl = await placeCodOrder(customerPage);

    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    const noErrors = failOnErrors(staff);
    await staff.goto('/admin/login');
    await staff.getByLabel('Password').fill(ADMIN_PASSWORD);
    await staff.getByRole('button', { name: 'Sign in' }).click();
    await staff.waitForURL('**/admin');
    await staff.getByRole('button', { name: 'Accept' }).first().click();
    await expect(staff.getByRole('button', { name: /Move to next step: Preparing/ }).first()).toBeVisible();

    await expect(customerPage.getByRole('status').filter({ hasText: 'Accepted' })).toBeVisible({ timeout: 12_000 });
    expect(orderUrl).toContain('/orders/');
    await noErrors();
    await customer.close();
    await staffContext.close();
  });

  test('F02 board passes the accessibility scan', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');
    await expectAccessible(page);
  });
});
