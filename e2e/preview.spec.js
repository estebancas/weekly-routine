import { test, expect } from '@playwright/test';
import { gotoAt, heroDay, heroTag, dayChip, confirmBar, volverButton } from './helpers.js';

test.describe('preview', () => {
  test('picking another day shows the preview tag and docks the confirm bar', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue, selected = Tue
    await dayChip(page, 'Jueves').click();

    await expect(heroDay(page)).toHaveText('Jueves');
    await expect(heroTag(page)).toHaveText('Vista previa');
    await expect(page.locator('#app')).toHaveClass(/app--docked/);
    await expect(confirmBar(page)).toContainText('¿Usar Jueves como rutina de hoy?');
    await expect(dayChip(page, 'Martes')).toHaveAttribute('aria-pressed', 'true'); // still selected
  });

  test('Volver returns to the selected day and writes nothing to storage', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await dayChip(page, 'Jueves').click();
    await volverButton(page).click();

    await expect(heroDay(page)).toHaveText('Martes');
    await expect(heroTag(page)).toHaveText('Hoy');
    await expect(confirmBar(page)).toHaveCount(0);
  });

  test('reloading without confirming resets to today, the preview is not sticky', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await dayChip(page, 'Jueves').click();
    await expect(heroTag(page)).toHaveText('Vista previa');

    await gotoAt(page, '2026-09-29T17:00:00Z'); // reload, same CR day, never confirmed
    await expect(heroDay(page)).toHaveText('Martes');
    await expect(heroTag(page)).toHaveText('Hoy');
  });
});
