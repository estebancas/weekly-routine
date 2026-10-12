import { test, expect } from '@playwright/test';
import { gotoAt, dayChip } from './helpers.js';

/**
 * Screenshots only render pixel-identically on the same OS/font stack as the committed
 * baselines (generated on Linux via the Playwright Docker image, see CLAUDE.md). Skipped
 * outside Linux so `npm run e2e` stays green on macOS; use `npm run e2e:visual` for a local,
 * Docker-based run that matches CI.
 */
test.skip(process.platform !== 'linux', 'Visual baselines are Linux-only; see npm run e2e:visual.');

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

async function screenshot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await expect(page).toHaveScreenshot(name, { fullPage: true });
}

test.describe('visual regression', () => {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    test(`weekday boot — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue 10:00 CR
      await screenshot(page, `boot-${viewportName}.png`, viewport);
    });

    test(`night stretch open — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-09-29T00:30:00Z'); // Mon 18:30 CR
      await screenshot(page, `stretch-${viewportName}.png`, viewport);
    });

    test(`preview docked — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-09-29T16:00:00Z');
      await dayChip(page, 'Jueves').click();
      await screenshot(page, `preview-docked-${viewportName}.png`, viewport);
    });

    // gotoAt freezes Date, so the countdown is static and the capture is deterministic.
    test(`timer docked — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-09-29T16:00:00Z');
      await page.getByRole('button', { name: /^Iniciar temporizador/ }).first().click();
      await screenshot(page, `timer-docked-${viewportName}.png`, viewport);
    });

    test(`timer above preview bar — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-09-29T16:00:00Z');
      await page.getByRole('button', { name: /^Iniciar temporizador/ }).first().click();
      await dayChip(page, 'Jueves').click();
      await screenshot(page, `timer-preview-${viewportName}.png`, viewport);
    });

    test(`weekend — ${viewportName}`, async ({ page }) => {
      await gotoAt(page, '2026-10-03T18:00:00Z'); // Sat 12:00 CR
      await screenshot(page, `weekend-${viewportName}.png`, viewport);
    });
  }
});
