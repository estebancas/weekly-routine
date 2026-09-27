import { test, expect } from '@playwright/test';
import { gotoAt, heroDay, heroTag, dayChip } from './helpers.js';

test.describe('boot', () => {
  test('opens on the current Costa Rica weekday, not previewing or overridden', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue 10:00 CR
    await expect(heroDay(page)).toHaveText('Martes');
    await expect(page.locator('.hero__focus')).toHaveText('Chest + Back');
    await expect(heroTag(page)).toHaveText('Hoy');
    await expect(dayChip(page, 'Martes')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.confirm')).toHaveCount(0);
  });

  test('uses Costa Rica time, not the device/browser timezone', async ({ page }) => {
    // 2026-09-29T03:00Z is 2026-09-28 21:00 in Costa Rica: still Monday there.
    await gotoAt(page, '2026-09-29T03:00:00Z');
    await expect(heroDay(page)).toHaveText('Lunes');
  });
});

test.describe('default open section (STRETCH_CUTOFF = 18:30 CR)', () => {
  test('opens Calentamiento just before the cutoff', async ({ page }) => {
    await gotoAt(page, '2026-09-29T00:29:00Z'); // Mon 18:29 CR
    const [mobility, exercises, stretch] = await page.locator('details').all();
    await expect(mobility).toHaveJSProperty('open', true);
    await expect(exercises).toHaveJSProperty('open', false);
    await expect(stretch).toHaveJSProperty('open', false);
  });

  test('opens the night stretch at/after the cutoff', async ({ page }) => {
    await gotoAt(page, '2026-09-29T00:30:00Z'); // Mon 18:30 CR
    const [mobility, exercises, stretch] = await page.locator('details').all();
    await expect(mobility).toHaveJSProperty('open', false);
    await expect(exercises).toHaveJSProperty('open', false);
    await expect(stretch).toHaveJSProperty('open', true);
  });
});
