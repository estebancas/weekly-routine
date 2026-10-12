import { test, expect } from '@playwright/test';
import { gotoAt, dayChip } from './helpers.js';

const startButton = (page) => page.getByRole('button', { name: /^Iniciar temporizador/ }).first();

test.describe('workout timer', () => {
  test('opens a docked bar, counts down, and survives a day preview', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z'); // Tue 10:00 CR, warm-up open
    await startButton(page).click();

    const bar = page.getByRole('timer', { name: 'Temporizador' });
    await expect(bar).toBeVisible();
    const clock = bar.locator('.timer__clock');
    await expect(clock).toHaveText(/^\d\d:\d\d$/);

    await bar.getByRole('button', { name: 'Sumar 15 segundos' }).click();
    await bar.getByRole('button', { name: 'Pausar' }).click();
    const paused = await clock.textContent();
    await page.waitForTimeout(1200);
    await expect(clock).toHaveText(paused);

    await dayChip(page, 'Jueves').click();
    await expect(bar).toBeVisible();
    await expect(clock).toHaveText(paused);

    await bar.getByRole('button', { name: 'Cerrar temporizador' }).click();
    await expect(bar).toHaveCount(0);
  });

  test('reaches zero, flashes and announces "Tiempo"', async ({ page }) => {
    await gotoAt(page, '2026-09-29T16:00:00Z');
    await startButton(page).click();
    const bar = page.getByRole('timer', { name: 'Temporizador' });
    // Shrink the countdown to its 1s floor, then let it run out.
    for (let i = 0; i < 10; i++) await bar.getByRole('button', { name: 'Restar 15 segundos' }).click();
    // gotoAt freezes Date, so move the fixed clock past the deadline; the real interval re-reads it.
    await page.clock.setFixedTime(new Date('2026-09-29T16:00:05Z'));
    await expect(bar.locator('.timer__clock')).toHaveText('00:00');
    await expect(bar).toHaveClass(/timer--done/);
    await expect(bar.locator('[aria-live]')).toHaveText('Tiempo');
  });
});
