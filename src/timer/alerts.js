const BEEP_HZ = 880;
const BEEP_S = 0.25;
const VIBRATE_MS = [200, 100, 200];

/**
 * Vibrate / beep / wake lock wrappers. Everything fails quietly where unsupported or blocked.
 * @param {{ nav?: Navigator, AudioCtx?: typeof AudioContext }} [o]
 */
export function createAlerts({
  nav = globalThis.navigator,
  AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext,
} = {}) {
  let ctx = null;
  let lock = null;

  return {
    /** Call from a user gesture: iOS only lets an AudioContext start from one. */
    unlock() {
      try {
        ctx ??= AudioCtx ? new AudioCtx() : null;
        ctx?.resume?.()?.catch?.(() => {});
      } catch {
        ctx = null;
      }
    },
    alert() {
      try {
        nav?.vibrate?.(VIBRATE_MS);
      } catch {
        /* vibration unsupported */
      }
      try {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = BEEP_HZ;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + BEEP_S);
      } catch {
        /* audio blocked */
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
