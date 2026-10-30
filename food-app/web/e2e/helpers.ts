import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';
export const ADMIN_PASSWORD = 'slice-test-password-1';
export const SALAD = '00000000-0000-4000-8000-000000000101';
export const CHICKEN = '00000000-0000-4000-8000-000000000201';
export const KEBAB = '00000000-0000-4000-8000-000000000203';

/**
 * Records console errors and 5xx responses, and fails the test on either. `allow` lists expected console errors,
 * for negative tests that are supposed to produce one (a refused password is a 401 in the browser console).
 */
export function failOnErrors(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !allow.some((rx) => rx.test(msg.text()))) problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('response', (res) => {
    if (res.status() >= 500) problems.push(`${res.status()} on ${res.url()}`);
  });
  return async () => expect(problems, 'no console errors or server errors').toEqual([]);
}

/** Axe scan of the current screen. Fails on any violation. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Counts rows straight from the database, to check what the UI cannot show (duplicates). */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Puts one item in the cart through the menu screen, the way a customer does. */
/** On checkout: saves a delivery address in the first delivery area and leaves it chosen. */
export async function addDeliveryAddress(page: Page, line1: string) {
  await page.getByRole('button', { name: 'Add a new address' }).click();
  await page.getByRole('textbox', { name: 'Street, building and area' }).fill(line1);
  await page.getByRole('combobox', { name: 'Delivery area' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('radio', { name: new RegExp(line1.split(',')[0]) })).toBeChecked();
}

export async function addToCart(page: Page, name: string) {
  await page.goto('/menu');
  await page.getByRole('button', { name: `Add: ${name}` }).click();
  await expect(page.getByRole('status').filter({ hasText: '✓' }).first()).toBeVisible();
}
