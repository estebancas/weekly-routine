import { test, expect } from '@playwright/test';
import { gotoAt, dayChip, confirmBar } from './helpers.js';

// A Tuesday morning in Costa Rica; Jueves is a different day to preview.
const TUE = '2026-09-29T16:00:00Z';

test.describe('motion', () => {
  test('buttons and chips have a fast press transition', async ({ page }) => {
    await gotoAt(page, TUE);

    const chipDuration = await dayChip(page, 'Jueves').evaluate((el) => globalThis.getComputedStyle(el).transitionDuration);
    expect(parseFloat(chipDuration)).toBeGreaterThan(0);

    await dayChip(page, 'Jueves').click();
    const btn = page.getByRole('button', { name: 'Confirmar' });
    const btnDuration = await btn.evaluate((el) => globalThis.getComputedStyle(el).transitionDuration);
    expect(parseFloat(btnDuration)).toBeGreaterThan(0);
  });

  test('picking a day animates the content swap and the dock slide-in', async ({ page }) => {
    await gotoAt(page, TUE);

    // Boot renders statically: no entrance animations anywhere.
    const bootAnimations = await page
      .locator('.sections')
      .evaluate((el) => el.getAnimations({ subtree: true }).length);
    expect(bootAnimations).toBe(0);

    await dayChip(page, 'Jueves').click();

    // fill: both keeps finished animations "in effect", so getAnimations stays deterministic.
    const swapNames = await page.locator('.sections').evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(swapNames).toContain('swap-in');
    const heroNames = await page.locator('.hero').evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(heroNames).toContain('swap-in');
    const dockNames = await confirmBar(page).evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(dockNames).toContain('dock-in');
  });

  test('picking a second day while docked does not replay the dock slide', async ({ page }) => {
    await gotoAt(page, TUE);
    await dayChip(page, 'Jueves').click();
    await dayChip(page, 'Viernes').click();

    const dockNames = await confirmBar(page).evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(dockNames).not.toContain('dock-in');
    const swapNames = await page.locator('.sections').evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(swapNames).toContain('swap-in');
  });

  test('prefers-reduced-motion zeroes every duration', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAt(page, TUE);

    const chipDuration = await dayChip(page, 'Jueves').evaluate((el) => globalThis.getComputedStyle(el).transitionDuration);
    expect(parseFloat(chipDuration)).toBe(0);

    await dayChip(page, 'Jueves').click();
    const swapDuration = await page.locator('.sections').evaluate((el) => globalThis.getComputedStyle(el).animationDuration);
    expect(parseFloat(swapDuration)).toBe(0);
    const dockDuration = await confirmBar(page).evaluate((el) => globalThis.getComputedStyle(el).animationDuration);
    expect(parseFloat(dockDuration)).toBe(0);
  });
});
