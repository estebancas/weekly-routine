import { YOUTUBE_FALLBACK_MS } from './config.js';

const ANDROID_PACKAGE = 'com.google.android.youtube';

function searchPath(name) {
  return `www.youtube.com/results?search_query=${encodeURIComponent(name)}`;
}

export function youtubeWebUrl(name) {
  return `https://${searchPath(name)}`;
}

/**
 * iPadOS reports a Mac user agent, so a Mac with a touch screen counts as iOS.
 * @returns {'ios'|'android'|'other'}
 */
export function detectPlatform({ userAgent = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'other';
}

/** URL that opens the YouTube app where possible; the web URL elsewhere. */
export function youtubeAppUrl(name, platform) {
  if (platform === 'ios') return `youtube://${searchPath(name)}`;
  if (platform === 'android') {
    const fallback = encodeURIComponent(youtubeWebUrl(name));
    return `intent://${searchPath(name)}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
  }
  return youtubeWebUrl(name);
}

/**
 * iOS has no intent fallback: try the app scheme, and if the page is still visible
 * after `delay` (the app did not take over), open the web search instead.
 */
export function openOnIos(name, { win = window, doc = document, delay = YOUTUBE_FALLBACK_MS } = {}) {
  let timer;
  const cancel = () => {
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
  function onVisibility() {
    if (doc.visibilityState === 'hidden') cancel();
  }
  doc.addEventListener('visibilitychange', onVisibility);
  win.location.href = youtubeAppUrl(name, 'ios');
  timer = setTimeout(() => {
    cancel();
    if (doc.visibilityState === 'visible') win.open(youtubeWebUrl(name), '_blank', 'noopener');
  }, delay);
}
