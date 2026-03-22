import { defineConfig, devices } from '@playwright/test'

/**
 * Critical-path E2E configuration.
 *
 * Nightly-only tests are tagged "@nightly" in their test names and live in
 * `e2e/extended/`. The default `testIgnore` pattern below excludes the
 * extended directory from the standard run so they only execute in the
 * nightly CI schedule (use `pnpm e2e --project=nightly` or a separate
 * CI job that invokes `playwright test --project=nightly`).
 *
 * To run nightly tests locally: pnpm e2e --project=nightly
 * To run only critical paths:   pnpm e2e  (default — ignores extended/)
 */
export default defineConfig({
  testDir: './e2e',
  // Exclude the extended nightly suite from the default run
  testIgnore: ['**/e2e/extended/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Default project: critical-path PR suite (excludes extended/)
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Nightly project: includes extended/ tests; run via --project=nightly
      name: 'nightly',
      testDir: './e2e',
      testIgnore: [],            // Override: include all files
      testMatch: ['**/e2e/extended/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start dev server for local runs
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
