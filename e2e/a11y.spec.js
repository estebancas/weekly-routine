import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoAt, dayChip, confirmarButton } from './helpers.js';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page) {
  // Let entrance animations (layout.css) settle first: axe samples computed colors, and a
  // mid-fade frame reads as a contrast violation that the settled page does not have.
  await page.evaluate(() => Promise.all(globalThis.document.getAnimations().map((a) => a.finished)));
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('accessibility', () => {
  test('weekday boot has no violations', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue 10:00 CR
    await expectNoViolations(page);
  });

  test('after the stretch cutoff, with the night stretch open, has no violations', async ({ page }) => {
    await gotoAt(page, '2026-09-29T00:30:00Z'); // Mon 18:30 CR
    await expectNoViolations(page);
  });

  test('with the timer bar open has no violations', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await page.getByRole('button', { name: /^Iniciar temporizador/ }).first().click();
    await expect(page.getByRole('timer', { name: 'Temporizador' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('previewing another day, with the confirm bar docked, has no violations', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await dayChip(page, 'Jueves').click();
    await expect(confirmarButton(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test('the weekend block has no violations', async ({ page }) => {
    await gotoAt(page, '2026-10-03T18:00:00Z'); // Sat 12:00 CR
    await expectNoViolations(page);
  });

  test('all sections expanded has no violations', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    for (const summary of await page.locator('details summary').all()) {
      await summary.click();
    }
    await expectNoViolations(page);
  });
});
