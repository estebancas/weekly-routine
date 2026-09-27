import { test, expect } from '@playwright/test';
import { gotoAt, heroDay } from './helpers.js';

test.describe('weekend', () => {
  test('Saturday renders the cycling block with no accordions', async ({ page }) => {
    await gotoAt(page, '2026-10-03T18:00:00Z'); // Sat 12:00 CR
    await expect(heroDay(page)).toHaveText('Sábado');
    await expect(page.locator('.weekend__title')).toHaveText('Ciclismo');
    await expect(page.locator('details')).toHaveCount(0);
  });

  test('Sunday renders the rest block', async ({ page }) => {
    await gotoAt(page, '2026-10-04T18:00:00Z'); // Sun 12:00 CR
    await expect(heroDay(page)).toHaveText('Domingo');
    await expect(page.locator('.weekend__title')).toHaveText('Descanso');
  });
});
