import { test, expect } from '@playwright/test';
import { gotoAt, heroDay, heroTag, dayChip, confirmarButton } from './helpers.js';

test.describe('confirm', () => {
  test('confirming persists the override and shows the changed tag', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue
    await dayChip(page, 'Jueves').click();
    await confirmarButton(page).click();

    await expect(heroDay(page)).toHaveText('Jueves');
    await expect(heroTag(page)).toHaveText('Cambiado');
    await expect(dayChip(page, 'Jueves')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.confirm')).toHaveCount(0);
  });

  test('survives a reload on the same Costa Rica day', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await dayChip(page, 'Jueves').click();
    await confirmarButton(page).click();
    await expect(heroTag(page)).toHaveText('Cambiado');

    await gotoAt(page, '2026-09-29T20:00:00Z'); // later, same CR day
    await expect(heroDay(page)).toHaveText('Jueves');
    await expect(heroTag(page)).toHaveText('Cambiado');
  });

  test('a stale override from a previous Costa Rica day is dropped on the next boot', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue, today = 2026-09-29
    await dayChip(page, 'Jueves').click();
    await confirmarButton(page).click();
    await expect(heroTag(page)).toHaveText('Cambiado');

    // A new Costa Rica day: the confirmed override from 09-29 no longer matches today's dateKey.
    await gotoAt(page, '2026-09-30T18:00:00Z'); // Wed 12:00 CR
    await expect(heroDay(page)).toHaveText('Miércoles');
    await expect(heroTag(page)).toHaveText('Hoy');

    // And it stays dropped: reloading the same (new) day again doesn't resurrect it.
    await gotoAt(page, '2026-09-30T19:00:00Z');
    await expect(heroDay(page)).toHaveText('Miércoles');
    await expect(heroTag(page)).toHaveText('Hoy');
  });
});
