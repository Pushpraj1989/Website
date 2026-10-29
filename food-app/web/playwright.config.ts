import { defineConfig, devices } from '@playwright/test';

// The browser is preinstalled in this environment; point Playwright at it rather than downloading another.
const CHROMIUM = '/opt/pw-browsers/chromium';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:5432/food_test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one database, one cart per browser: run the flows one after another
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'], launchOptions: { executablePath: CHROMIUM } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, launchOptions: { executablePath: CHROMIUM } } },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start -p 3100',
    url: 'http://localhost:3100/v1/menu',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL,
      ADMIN_PASSWORD: 'slice-test-password-1',
      STRIPE_SECRET_KEY: 'sk_test_slice_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_slice_test_secret',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_slice_placeholder',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
