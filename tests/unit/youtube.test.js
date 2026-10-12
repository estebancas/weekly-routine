import { describe, it, expect, vi } from 'vitest';
import { youtubeWebUrl, detectPlatform, youtubeAppUrl, openOnIos } from '../../src/youtube.js';

describe('youtubeWebUrl', () => {
  it('builds a YouTube search URL', () => {
    expect(youtubeWebUrl('Sentadilla')).toBe('https://www.youtube.com/results?search_query=Sentadilla');
  });

  it('encodes spaces, accents and ampersands', () => {
    const url = youtubeWebUrl('Press & Remo ñandú');
    expect(url).toBe('https://www.youtube.com/results?search_query=Press%20%26%20Remo%20%C3%B1and%C3%BA');
    expect(new URL(url).searchParams.get('search_query')).toBe('Press & Remo ñandú');
  });
});

describe('detectPlatform', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

  it('detects iOS from an iPhone UA', () => {
    expect(detectPlatform({ userAgent: iphone, maxTouchPoints: 5 })).toBe('ios');
  });

  it('detects iPadOS, which reports a Mac UA but has a touch screen', () => {
    expect(detectPlatform({ userAgent: mac, maxTouchPoints: 5 })).toBe('ios');
  });

  it('does not treat a real Mac (no touch) as iOS', () => {
    expect(detectPlatform({ userAgent: mac, maxTouchPoints: 0 })).toBe('other');
  });

  it('detects Android', () => {
    expect(detectPlatform({ userAgent: android, maxTouchPoints: 5 })).toBe('android');
  });

  it('falls back to other for desktops and missing input', () => {
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints: 0 })).toBe('other');
    expect(detectPlatform()).toBe('other');
  });
});

describe('youtubeAppUrl', () => {
  it('uses the youtube:// scheme on iOS', () => {
    expect(youtubeAppUrl('Remo & curl', 'ios')).toBe(
      'youtube://www.youtube.com/results?search_query=Remo%20%26%20curl',
    );
  });

  it('uses an intent URL on Android that falls back to the encoded web URL', () => {
    const url = youtubeAppUrl('Remo & curl', 'android');
    expect(url.startsWith('intent://www.youtube.com/results?search_query=Remo%20%26%20curl#Intent;')).toBe(true);
    expect(url).toContain('scheme=https;');
    expect(url).toContain('package=com.google.android.youtube;');
    const fallback = encodeURIComponent(youtubeWebUrl('Remo & curl'));
    expect(url).toContain(`S.browser_fallback_url=${fallback};`);
    expect(url.endsWith(';end')).toBe(true);
  });

  it('returns the plain web URL elsewhere', () => {
    expect(youtubeAppUrl('Sentadilla', 'other')).toBe(youtubeWebUrl('Sentadilla'));
  });
});

describe('openOnIos', () => {
  function fakes(visibilityState = 'visible') {
    const listeners = {};
    const doc = {
      visibilityState,
      addEventListener: vi.fn((type, fn) => (listeners[type] = fn)),
      removeEventListener: vi.fn(),
    };
    const win = { location: { href: '' }, open: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    return { doc, win, listeners };
  }

  it('navigates to the app URL, then opens the web URL if the page is still visible', async () => {
    const { doc, win } = fakes('visible');
    openOnIos('Sentadilla', { win, doc, delay: 5 });
    expect(win.location.href).toBe(youtubeAppUrl('Sentadilla', 'ios'));
    expect(win.open).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(win.open).toHaveBeenCalledWith(youtubeWebUrl('Sentadilla'), '_blank', 'noopener'),
    );
  });

  it('skips the web fallback when the page is hidden once the delay elapses', async () => {
    const { doc, win } = fakes('hidden');
    openOnIos('Sentadilla', { win, doc, delay: 5 });
    await new Promise((r) => setTimeout(r, 30));
    expect(win.open).not.toHaveBeenCalled();
  });

  it('cancels the fallback when the page becomes hidden (app took over)', async () => {
    const { doc, win, listeners } = fakes('visible');
    openOnIos('Sentadilla', { win, doc, delay: 20 });
    doc.visibilityState = 'hidden';
    listeners.visibilitychange();
    await new Promise((r) => setTimeout(r, 50));
    expect(win.open).not.toHaveBeenCalled();
    expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', listeners.visibilitychange);
  });
});
