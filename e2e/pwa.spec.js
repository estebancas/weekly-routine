import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('serves a web app manifest linking the expected icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const res = await request.get(new URL(href, page.url()).toString());
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBe('Rutina semanal');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('registers an active service worker', async ({ page }) => {
    await page.goto('/');
    const hasActiveSW = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(hasActiveSW).toBe(true);
  });

  test('loads offline once the service worker has taken control after the first visit', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    // vite-plugin-pwa's registerType: 'autoUpdate' claims existing clients on activation,
    // so waiting for a controller confirms precaching (done during the SW's install step) landed.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('#app')).not.toBeEmpty();
    await expect(page.locator('.hero__day')).toBeVisible();
  });
});
