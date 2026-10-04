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

  test('every iOS startup image link serves a PNG of the exact size its media query targets', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const links = await page
      .locator('link[rel="apple-touch-startup-image"]')
      .evaluateAll((els) => els.map((el) => ({ href: el.href, media: el.media })));
    expect(links.length).toBeGreaterThan(0);

    for (const { href, media } of links) {
      const [, w, h, ratio, orientation] = media.match(
        /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (\w+)\)/,
      );
      const [short, long] = [w * ratio, h * ratio];
      const expected = orientation === 'portrait' ? [short, long] : [long, short];

      const res = await request.get(href);
      expect(res.ok(), href).toBe(true);
      // PNG IHDR: width and height are big-endian uint32s at bytes 16 and 20.
      const body = await res.body();
      expect([body.readUInt32BE(16), body.readUInt32BE(20)], href).toEqual(expected);
    }
  });

  test('exactly one startup image matches an iPhone-sized screen in portrait', async ({ browser }) => {
    // iPhone 17 / 16 Pro: 402×874 CSS px at 3x.
    const size = { width: 402, height: 874 };
    const context = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: 3 });
    const page = await context.newPage();
    await page.goto('/');
    const matching = await page
      .locator('link[rel="apple-touch-startup-image"]')
      .evaluateAll((els) => els.filter((el) => globalThis.matchMedia(el.media).matches).map((el) => el.getAttribute('href')));
    await context.close();
    expect(matching).toEqual(['/apple-splash-portrait-1206x2622.png']);
  });

  test('keeps the startup images out of the service worker precache', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    expect(sw).not.toContain('apple-splash');
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
