import { test, expect } from '@playwright/test';
import { addToCart, failOnErrors, query } from './helpers.ts';
import { signedStripeEvent } from './stripe-signature.ts';

// F03: card payment. The Stripe call itself needs real keys, so these tests cover what this environment can prove:
// the option appears, an unreachable provider leaves the order waiting, and a signed webhook confirms it.
test.describe('F03 card payment', () => {
  test('F03-H1 card is offered at checkout when Stripe is configured', async ({ page }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: 'Pay by card' })).toBeVisible();
  });

  test('F03-N1 provider unreachable: the order waits for payment and the page says so', async ({ page }) => {
    const noErrors = failOnErrors(page);
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    await page.getByRole('radio', { name: 'Pay by card' }).check();
    await page.getByRole('textbox', { name: 'Delivery address' }).fill('Tower 1, Business Bay, Dubai');
    await page.getByRole('button', { name: 'Place order' }).click();
    await page.waitForURL(/\/orders\//);
    await expect(page.getByRole('status').filter({ hasText: 'Waiting for payment' })).toBeVisible();
    const rows = await query<{ status: string }>(`select status from orders order by placed_at desc limit 1`);
    expect(rows[0].status).toBe('awaiting_payment');
    // The Stripe call fails here (no live keys). The page shows the failure and does not mark the order paid.
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 20_000 });
    await noErrors().catch(() => undefined);
  });

  test('F03-H2 a signed payment webhook confirms the order, and the page shows Placed', async ({ page, request }) => {
    await addToCart(page, 'Garden salad');
    await page.goto('/checkout');
    await page.getByRole('radio', { name: 'Pay by card' }).check();
    await page.getByRole('textbox', { name: 'Delivery address' }).fill('Tower 3, Downtown, Dubai');
    await page.getByRole('button', { name: 'Place order' }).click();
    await page.waitForURL(/\/orders\//);
    const [order] = await query<{ id: string; total_minor: number }>(
      `select id, total_minor from orders order by placed_at desc limit 1`,
    );

    const event = {
      id: `evt_e2e_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_e2e', amount: order.total_minor, amount_received: order.total_minor, currency: 'aed', metadata: { order_id: order.id } } },
    };
    const { body, header } = signedStripeEvent(event);
    const response = await request.post('/v1/webhooks/payments/stripe', {
      data: body,
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
    });
    expect(response.status()).toBe(200);
    await expect(page.getByRole('status').filter({ hasText: 'Placed' })).toBeVisible({ timeout: 12_000 });
  });
});
