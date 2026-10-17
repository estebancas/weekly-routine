import { detectPlatform } from '../youtube.js';

const BEEP_HZ = 880;
const BEEP_S = 0.25;
const VIBRATE_MS = [200, 100, 200];
const SAMPLE_RATE = 8000;

/**
 * A mono 16-bit PCM WAV of the beep as a data URI. iOS mutes Web Audio with the ringer switch
 * but not `<audio>`, so on iOS the beep plays through an element instead of an oscillator.
 */
export function beepDataUri() {
  const n = Math.round(SAMPLE_RATE * BEEP_S);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 80, (n - i) / 80);
    v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * BEEP_HZ * i) / SAMPLE_RATE) * 0.5 * fade * 32767, true);
  }
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/**
 * Vibrate / beep / wake lock wrappers. Everything fails quietly where unsupported or blocked.
 * On iOS the beep goes through an `<audio>` element (the ringer switch mutes Web Audio, not
 * `<audio>`) and stays in the default ambient session, so the user's music keeps playing.
 * `onSilent` fires once if the beep could not be produced.
 * @param {{ nav?: Navigator, AudioCtx?: typeof AudioContext, makeAudio?: () => HTMLAudioElement, onSilent?: () => void }} [o]
 */
export function createAlerts({
  nav = globalThis.navigator,
  AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  makeAudio = () => new Audio(),
  onSilent = () => {},
} = {}) {
  const useElement = detectPlatform({
    userAgent: nav?.userAgent ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
  }) === 'ios';
  let ctx = null;
  let el = null;
  let lock = null;
  let warned = false;

  function silent() {
    if (warned) return;
    warned = true;
    onSilent();
  }

  function resumeCtx() {
    try {
      if (ctx && ctx.state !== 'running') ctx.resume?.()?.catch?.(() => {});
    } catch {
      /* context closed */
    }
  }

  const beepSrc = useElement ? beepDataUri() : '';

  // Tearing the element down after the beep makes WebKit drop its playback session, which is
  // what lets other apps' music resume. 'auto' hands the Audio Session API back its default.
  function release() {
    try {
      el.pause();
      el.removeAttribute?.('src');
      el.load?.();
      if (nav?.audioSession) nav.audioSession.type = 'auto';
    } catch {
      /* already released */
    }
  }

  function playElement() {
    if (!el.getAttribute?.('src')) el.src = beepSrc;
    el.currentTime = 0;
    el.play().catch(() => {
      release();
      silent();
    });
  }

  return {
    /** Call from a user gesture: iOS only lets an AudioContext start from one. */
    unlock() {
      try {
        if (useElement) {
          if (!el) {
            el = makeAudio();
            el.src = beepSrc;
            el.preload = 'auto';
            el.addEventListener?.('ended', release);
          }
          // Playing once inside the gesture authorises later programmatic plays.
          el.muted = true;
          el.play().then(
            () => {
              el.pause();
              el.muted = false;
            },
            () => {
              el.muted = false;
              silent();
            },
          );
          return;
        }
        ctx ??= AudioCtx ? new AudioCtx() : null;
        ctx?.resume?.()?.catch?.(() => {});
      } catch {
        ctx = null;
        el = null;
        silent();
      }
    },
    /** Re-arm audio after the app returns from the background (iOS suspends the context). */
    resume() {
      resumeCtx();
    },
    alert() {
      try {
        nav?.vibrate?.(VIBRATE_MS);
      } catch {
        /* vibration unsupported */
      }
      try {
        if (useElement) {
          if (el) playElement();
          return;
        }
        if (!ctx) return;
        resumeCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = BEEP_HZ;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + BEEP_S);
      } catch {
        silent();
      }
    },
    async acquireWakeLock() {
      try {
        if (lock || !nav?.wakeLock) return;
        lock = await nav.wakeLock.request('screen');
        lock.addEventListener?.('release', () => {
          lock = null;
        });
      } catch {
        lock = null;
      }
    },
    async releaseWakeLock() {
      const held = lock;
      lock = null;
      try {
        await held?.release();
      } catch {
        /* already released */
      }
    },
  };
}
