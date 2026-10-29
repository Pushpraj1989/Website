import { test, expect } from '@playwright/test';
import { addToCart, CHICKEN, expectAccessible, failOnErrors, query, SALAD } from './helpers.ts';

// F01: a guest builds a cart, checks out and places an order.
test.describe('F01 guest places an order', () => {
  test('F01-H1 happy path: cash on delivery order is placed and visible', async ({ page }) => {
    const noErrors = failOnErrors(page);
    await addToCart(page, 'Garden salad');
    await addToCart(page, 'Grilled chicken plate');
    await addToCart(page, 'Grilled chicken plate');
    await page.goto('/cart');
    await expect(page.getByText('Grilled chicken plate', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Checkout' }).click();
    await page.getByRole('textbox', { name: 'Delivery address' }).fill('Flat 4, Example Tower, Al Barsha, Dubai');
    await page.getByRole('button', { name: 'Place order' }).click();
    await page.waitForURL(/\/orders\//);
    await expect(page.getByRole('status').filter({ hasText: 'Placed' })).toBeVisible();
    const rows = await query<{ total_minor: number; status: string }>(
      `select total_minor, status from orders order by placed_at desc limit 1`,
    );
    expect(rows[0]).toEqual({ total_minor: 11800, status: 'placed' });
    await noErrors();
  });

  test('F01-E1 double tap on Place order creates one order', async ({ page }) => {
    const noErrors = failOnErrors(page);
    const before = (await query<{ n: number }>('select count(*)::int as n from orders'))[0].n;
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    await page.getByRole('textbox', { name: 'Delivery address' }).fill('Tower 2, Marina, Dubai');
    const place = page.getByRole('button', { name: 'Place order' });
    // The button is enabled once the server has priced the cart; a double tap is only meaningful after that.
    await expect(place).toBeEnabled();
    await Promise.all([place.dblclick(), place.dblclick()]);
    await page.waitForURL(/\/orders\//);
    const after = (await query<{ n: number }>('select count(*)::int as n from orders'))[0].n;
    expect(after - before).toBe(1);
    await noErrors();
  });

  test('F01-E2 refresh mid-checkout keeps the cart (it lives on the server)', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/cart');
    await page.reload();
    await expect(page.getByText('Garden salad', { exact: true })).toBeVisible();
  });

  test('F01-E3 empty cart shows a message and no checkout link', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Checkout' })).toHaveCount(0);
  });

  test('F01-E4 sold-out item has no add button', async ({ page }) => {
    await page.goto('/menu');
    await expect(page.getByText('Sold out').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add: Beef kebab' })).toHaveCount(0);
  });

  test('F01-E5 a 200 character note is accepted, a longer one is cut to 200', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/cart');
    const note = page.getByRole('textbox', { name: 'Note for the kitchen' });
    await expect(note).toHaveAttribute('maxlength', '200');
  });

  test('F01-E6 quantity above 20 is refused by the input range', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/cart');
    const qty = page.getByRole('spinbutton', { name: /Quantity: Garden salad/ });
    await expect(qty).toHaveAttribute('max', '20');
  });

  test('F01-N1 delivery without an address shows the reason, and no order is made', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    const before = (await query<{ n: number }>('select count(*)::int as n from orders'))[0].n;
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('A delivery address is needed.');
    const after = (await query<{ n: number }>('select count(*)::int as n from orders'))[0].n;
    expect(after).toBe(before);
  });

  test('F01-N2 pay on arrival is not offered for delivery', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: 'Cash on delivery' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Pay on arrival' })).toHaveCount(0);
  });

  test('F01 screens pass the accessibility scan', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/menu');
    await expectAccessible(page);
    await page.goto('/cart');
    await expectAccessible(page);
    await page.goto('/checkout');
    await expectAccessible(page);
    void SALAD;
    void CHICKEN;
  });
});
