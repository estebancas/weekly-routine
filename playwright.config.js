import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a production build served by `vite preview`. The dev-only `?now=` clock
 * override (src/time.js) is stripped from that build, so specs fake the wall clock with
 * page.clock instead. CI reuses the `dist` the test job already built; locally, run
 * `npm run build` once before `npm run e2e` (or let the webServer's `reuseExistingServer`
 * pick up a `npm run preview` you already have open).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
