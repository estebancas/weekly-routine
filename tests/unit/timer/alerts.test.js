import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAlerts, beepDataUri } from '../../../src/timer/alerts.js';

function fakeAudio() {
  const osc = { frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const gain = { connect: vi.fn() };
  const ctx = {
    currentTime: 1,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
  };
  return { osc, gain, ctx, AudioCtx: vi.fn(function () {
      return ctx;
    }) };
}

describe('createAlerts', () => {
  it('vibrates and beeps once unlocked', () => {
    const { osc, AudioCtx } = fakeAudio();
    const nav = { vibrate: vi.fn() };
    const alerts = createAlerts({ nav, AudioCtx });
    alerts.unlock();
    alerts.alert();
    expect(nav.vibrate).toHaveBeenCalledWith([200, 100, 200]);
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalledWith(expect.any(Number));
  });

  it('wires oscillator -> gain -> speakers at 880 Hz and stops after 0.25 s', () => {
    const { osc, gain, ctx, AudioCtx } = fakeAudio();
    const alerts = createAlerts({ nav: {}, AudioCtx });
    alerts.unlock();
    alerts.alert();
    expect(osc.frequency.value).toBe(880);
    expect(osc.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(ctx.destination);
    expect(osc.stop).toHaveBeenCalledWith(ctx.currentTime + 0.25);
  });

  it('does not report silence when alerting before unlock', () => {
    const { AudioCtx } = fakeAudio();
    const onSilent = vi.fn();
    createAlerts({ nav: {}, AudioCtx, onSilent }).alert();
    expect(onSilent).not.toHaveBeenCalled();
  });

  it('stays quiet when the browser has no AudioContext at all', () => {
    const onSilent = vi.fn();
    const alerts = createAlerts({ nav: {}, AudioCtx: null, onSilent });
    alerts.unlock();
    alerts.alert();
    expect(onSilent).not.toHaveBeenCalled();
  });

  it('keeps working when resume() returns nothing or a non-promise', () => {
    for (const ctxShape of [{}, { resume: () => undefined }, { resume: () => ({}) }]) {
      const ctx = { ...ctxShape, currentTime: 0, destination: {}, createGain: () => ({ connect() {} }) };
      const osc = { frequency: {}, connect() {}, start: vi.fn(), stop() {} };
      ctx.createOscillator = () => osc;
      const onSilent = vi.fn();
      const alerts = createAlerts({ nav: {}, AudioCtx: vi.fn(function () { return ctx; }), onSilent });
      alerts.unlock();
      alerts.alert();
      expect(onSilent).not.toHaveBeenCalled();
      expect(osc.start).toHaveBeenCalled();
    }
  });

  describe('platform defaults', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses the global AudioContext, falling back to webkitAudioContext', () => {
      const Standard = vi.fn(function () { return { resume: () => Promise.resolve() }; });
      const Webkit = vi.fn(function () { return { resume: () => Promise.resolve() }; });
      vi.stubGlobal('AudioContext', Standard);
      vi.stubGlobal('webkitAudioContext', undefined);
      createAlerts({ nav: {} }).unlock();
      expect(Standard).toHaveBeenCalledTimes(1);

      vi.stubGlobal('AudioContext', undefined);
      vi.stubGlobal('webkitAudioContext', Webkit);
      createAlerts({ nav: {} }).unlock();
      expect(Webkit).toHaveBeenCalledTimes(1);
    });

    it('creates a real Audio element on iOS when none is injected', () => {
      const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(), addEventListener: vi.fn() };
      const AudioMock = vi.fn(function () { return audio; });
      vi.stubGlobal('Audio', AudioMock);
      const onSilent = vi.fn();
      createAlerts({
        nav: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' },
        onSilent,
      }).unlock();
      expect(AudioMock).toHaveBeenCalledTimes(1);
      expect(audio.play).toHaveBeenCalled();
      expect(onSilent).not.toHaveBeenCalled();
    });

    it('copes with a null navigator', () => {
      expect(() => createAlerts({ nav: null })).not.toThrow();
    });
  });

  it('reuses one AudioContext across unlocks', () => {
    const { ctx, AudioCtx } = fakeAudio();
    const alerts = createAlerts({ nav: {}, AudioCtx });
    alerts.unlock();
    alerts.unlock();
    expect(AudioCtx).toHaveBeenCalledTimes(1);
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('does not beep before unlock and survives missing vibrate/audio', () => {
    const { osc, AudioCtx } = fakeAudio();
    const alerts = createAlerts({ nav: {}, AudioCtx });
    expect(() => alerts.alert()).not.toThrow();
    expect(osc.start).not.toHaveBeenCalled();
    const bare = createAlerts({ nav: undefined, AudioCtx: undefined });
    bare.unlock();
    expect(() => bare.alert()).not.toThrow();
  });

  it('fails quietly when audio or vibration throw', () => {
    const throwingCtx = vi.fn(() => {
      throw new Error('blocked');
    });
    const alerts = createAlerts({
      nav: {
        vibrate: () => {
          throw new Error('nope');
        },
      },
      AudioCtx: throwingCtx,
    });
    expect(() => alerts.unlock()).not.toThrow();
    expect(() => alerts.alert()).not.toThrow();

    const { ctx, AudioCtx } = fakeAudio();
    ctx.createOscillator.mockImplementation(() => {
      throw new Error('closed');
    });
    const a2 = createAlerts({ nav: {}, AudioCtx });
    a2.unlock();
    expect(() => a2.alert()).not.toThrow();
  });

  it('tolerates a resume() that is missing or rejects', () => {
    const ctx = { resume: () => Promise.reject(new Error('x')) };
    expect(() => createAlerts({ nav: {}, AudioCtx: vi.fn(function () {
      return ctx;
    }) }).unlock()).not.toThrow();
    expect(() => createAlerts({ nav: {}, AudioCtx: vi.fn(function () {
      return {};
    }) }).unlock()).not.toThrow();
  });

  it('resumes a suspended context before beeping and on resume()', () => {
    const { ctx, osc, AudioCtx } = fakeAudio();
    ctx.state = 'suspended';
    const alerts = createAlerts({ nav: {}, AudioCtx });
    alerts.unlock();
    ctx.resume.mockClear();
    alerts.alert();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalled();
    alerts.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    ctx.state = 'running';
    alerts.resume();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(() => createAlerts({ nav: {}, AudioCtx }).resume()).not.toThrow();
  });

  it('reports silence once when the oscillator path throws', () => {
    const { ctx, AudioCtx } = fakeAudio();
    ctx.createOscillator.mockImplementation(() => {
      throw new Error('closed');
    });
    const onSilent = vi.fn();
    const alerts = createAlerts({ nav: {}, AudioCtx, onSilent });
    alerts.unlock();
    alerts.alert();
    alerts.alert();
    expect(onSilent).toHaveBeenCalledTimes(1);
  });

  describe('beepDataUri', () => {
    const SAMPLES = 2000; // 8 kHz * 0.25 s
    function decode() {
      const uri = beepDataUri();
      expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
      const bin = atob(uri.split(',')[1]);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return { bin, view: new DataView(bytes.buffer) };
    }

    it('writes a valid mono 16-bit 8 kHz PCM WAV header', () => {
      const { bin, view } = decode();
      expect(bin.length).toBe(44 + SAMPLES * 2);
      expect(bin.slice(0, 4)).toBe('RIFF');
      expect(view.getUint32(4, true)).toBe(36 + SAMPLES * 2);
      expect(bin.slice(8, 16)).toBe('WAVEfmt ');
      expect(view.getUint32(16, true)).toBe(16); // fmt chunk size
      expect(view.getUint16(20, true)).toBe(1); // PCM
      expect(view.getUint16(22, true)).toBe(1); // mono
      expect(view.getUint32(24, true)).toBe(8000); // sample rate
      expect(view.getUint32(28, true)).toBe(16000); // byte rate
      expect(view.getUint16(32, true)).toBe(2); // block align
      expect(view.getUint16(34, true)).toBe(16); // bits per sample
      expect(bin.slice(36, 40)).toBe('data');
      expect(view.getUint32(40, true)).toBe(SAMPLES * 2);
    });

    it('holds an 880 Hz sine at half scale with a 10 ms fade in and out', () => {
      const { view } = decode();
      for (let i = 0; i < SAMPLES; i++) {
        const fade = Math.min(1, i / 80, (SAMPLES - i) / 80);
        const expected = Math.trunc(Math.sin((2 * Math.PI * 880 * i) / 8000) * 0.5 * fade * 32767) + 0; // + 0 turns -0 into 0
        expect(view.getInt16(44 + i * 2, true)).toBe(expected);
      }
      // Sanity on the shape itself, independent of the formula above.
      const peak = Math.max(...Array.from({ length: SAMPLES }, (_, i) => Math.abs(view.getInt16(44 + i * 2, true))));
      expect(peak).toBeGreaterThan(16000);
      expect(peak).toBeLessThanOrEqual(16384);
      expect(view.getInt16(44, true)).toBe(0);
      expect(Math.abs(view.getInt16(44 + (SAMPLES - 1) * 2, true))).toBeLessThan(400);
    });
  });

  describe('iOS (<audio> path)', () => {
    const IOS = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' };
    function fakeEl({ playOk = true } = {}) {
      const e = {
        play: vi.fn(() => (playOk ? Promise.resolve() : Promise.reject(new Error('NotAllowed')))),
        pause: vi.fn(),
        currentTime: 5,
      };
      return e;
    }

    it('primes the element on unlock and plays it for alerts, not the oscillator', async () => {
      const el = fakeEl();
      const { osc, AudioCtx } = fakeAudio();
      const alerts = createAlerts({ nav: { ...IOS, vibrate: vi.fn() }, AudioCtx, makeAudio: () => el });
      alerts.unlock();
      expect(el.muted).toBe(true); // muted while priming inside the gesture
      expect(el.preload).toBe('auto');
      await Promise.resolve();
      await Promise.resolve();
      expect(el.src.startsWith('data:audio/wav')).toBe(true);
      expect(el.pause).toHaveBeenCalled();
      expect(el.muted).toBe(false);
      el.play.mockClear();
      alerts.alert();
      expect(el.currentTime).toBe(0);
      expect(el.play).toHaveBeenCalledTimes(1);
      expect(osc.start).not.toHaveBeenCalled();
      expect(AudioCtx).not.toHaveBeenCalled();
    });

    it('tears the element down when the beep ends so other audio can resume', async () => {
      const listeners = {};
      const el = {
        ...fakeEl(),
        removeAttribute: vi.fn(() => {
          delete el.src;
        }),
        load: vi.fn(),
        getAttribute: vi.fn((name) => (name === 'src' ? (el.src ?? null) : null)),
        addEventListener: (type, fn) => (listeners[type] = fn),
      };
      const nav = { ...IOS, audioSession: { type: 'playback' } };
      const alerts = createAlerts({ nav, makeAudio: () => el });
      alerts.unlock();
      await Promise.resolve();
      await Promise.resolve();
      alerts.alert();
      expect(el.getAttribute).toHaveBeenCalledWith('src');
      el.pause.mockClear();
      listeners.ended();
      expect(el.pause).toHaveBeenCalledTimes(1);
      expect(el.removeAttribute).toHaveBeenCalledWith('src');
      expect(el.load).toHaveBeenCalled();
      expect(nav.audioSession.type).toBe('auto');
      expect(el.src).toBeUndefined();
      alerts.alert();
      expect(el.src.startsWith('data:audio/wav')).toBe(true); // re-armed because src was removed
    });

    it('still finishes the teardown when the element lacks removeAttribute or load', async () => {
      const listeners = {};
      const el = { ...fakeEl(), addEventListener: (type, fn) => (listeners[type] = fn) };
      const nav = { ...IOS, audioSession: { type: 'playback' } };
      createAlerts({ nav, makeAudio: () => el }).unlock();
      await Promise.resolve();
      await Promise.resolve();
      listeners.ended();
      expect(nav.audioSession.type).toBe('auto');

      const el2 = { ...fakeEl(), load: vi.fn(), addEventListener: (type, fn) => (listeners[type] = fn) };
      createAlerts({ nav: { ...IOS, audioSession: { type: 'playback' } }, makeAudio: () => el2 }).unlock();
      await Promise.resolve();
      await Promise.resolve();
      listeners.ended();
      expect(el2.load).toHaveBeenCalled();
    });

    it('keeps the src when it is still set, and tolerates a failing teardown', async () => {
      let onEnded;
      const el = {
        ...fakeEl(),
        src: 'x',
        getAttribute: () => 'x',
        addEventListener: (_, fn) => (onEnded = fn),
      };
      const alerts = createAlerts({ nav: IOS, makeAudio: () => el });
      alerts.unlock();
      await Promise.resolve();
      await Promise.resolve();
      el.src = 'marker'; // pretend something else set it after priming
      el.pause = vi.fn(() => {
        throw new Error('gone');
      });
      alerts.alert();
      expect(el.src).toBe('marker'); // not overwritten while still set
      expect(() => onEnded()).not.toThrow();
    });

    it('releases and reports when a later beep is rejected', async () => {
      const onSilent = vi.fn();
      const el = { ...fakeEl(), removeAttribute: vi.fn() };
      const alerts = createAlerts({ nav: IOS, makeAudio: () => el, onSilent });
      alerts.unlock();
      await new Promise((r) => setTimeout(r, 0));
      expect(onSilent).not.toHaveBeenCalled(); // the priming play worked
      el.play.mockImplementationOnce(() => Promise.reject(new Error('NotAllowed')));
      alerts.alert();
      await new Promise((r) => setTimeout(r, 0));
      expect(el.removeAttribute).toHaveBeenCalledWith('src');
      expect(onSilent).toHaveBeenCalledTimes(1);
    });

    it('reports silence when the priming play is rejected', async () => {
      const onSilent = vi.fn();
      const el = fakeEl({ playOk: false });
      createAlerts({ nav: IOS, makeAudio: () => el, onSilent }).unlock();
      await new Promise((r) => setTimeout(r, 0));
      expect(onSilent).toHaveBeenCalledTimes(1);
      expect(el.muted).toBe(false);
    });

    it('detects iPadOS (Mac user agent with touch)', () => {
      const el = fakeEl();
      const alerts = createAlerts({
        nav: { userAgent: 'Macintosh; Intel Mac OS X', maxTouchPoints: 5 },
        makeAudio: () => el,
      });
      alerts.unlock();
      expect(el.play).toHaveBeenCalled();
    });

    it('does nothing before unlock', () => {
      const makeAudio = vi.fn();
      const onSilent = vi.fn();
      const alerts = createAlerts({ nav: IOS, makeAudio, onSilent });
      expect(() => alerts.alert()).not.toThrow();
      expect(makeAudio).not.toHaveBeenCalled();
      expect(onSilent).not.toHaveBeenCalled();
    });

    it('tells the user once when playback is rejected', async () => {
      const onSilent = vi.fn();
      const el = fakeEl({ playOk: false });
      const alerts = createAlerts({ nav: IOS, makeAudio: () => el, onSilent });
      alerts.unlock();
      await new Promise((r) => setTimeout(r, 0));
      alerts.alert();
      await new Promise((r) => setTimeout(r, 0));
      expect(onSilent).toHaveBeenCalledTimes(1);
      expect(el.muted).toBe(false);
    });

    it('reports silence when the element cannot be created', () => {
      const onSilent = vi.fn();
      const alerts = createAlerts({
        nav: IOS,
        makeAudio: () => {
          throw new Error('no audio');
        },
        onSilent,
      });
      expect(() => alerts.unlock()).not.toThrow();
      expect(onSilent).toHaveBeenCalledTimes(1);
      expect(() => alerts.alert()).not.toThrow();
    });

    it('reuses one element across unlocks', () => {
      const makeAudio = vi.fn(() => fakeEl());
      const alerts = createAlerts({ nav: IOS, makeAudio });
      alerts.unlock();
      alerts.unlock();
      expect(makeAudio).toHaveBeenCalledTimes(1);
    });
  });

  describe('wake lock', () => {
    it('acquires once and releases', async () => {
      const lock = { release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() };
      const nav = { wakeLock: { request: vi.fn(() => Promise.resolve(lock)) } };
      const alerts = createAlerts({ nav });
      await alerts.acquireWakeLock();
      await alerts.acquireWakeLock();
      expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
      expect(nav.wakeLock.request).toHaveBeenCalledWith('screen');
      expect(lock.addEventListener).toHaveBeenCalledWith('release', expect.any(Function));
      await alerts.releaseWakeLock();
      expect(lock.release).toHaveBeenCalled();
      await alerts.releaseWakeLock();
      expect(lock.release).toHaveBeenCalledTimes(1);
    });

    it('can re-acquire after the system releases it', async () => {
      let onRelease;
      const lock = { release: vi.fn(), addEventListener: (_, fn) => (onRelease = fn) };
      const nav = { wakeLock: { request: vi.fn(() => Promise.resolve(lock)) } };
      const alerts = createAlerts({ nav });
      await alerts.acquireWakeLock();
      onRelease();
      await alerts.acquireWakeLock();
      expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
    });

    it('keeps a lock that has no release listener support', async () => {
      const lock = { release: vi.fn() };
      const nav = { wakeLock: { request: vi.fn(() => Promise.resolve(lock)) } };
      const alerts = createAlerts({ nav });
      await alerts.acquireWakeLock();
      await alerts.acquireWakeLock();
      expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
    });

    it('forgets a lock whose release listener cannot be attached', async () => {
      const lock = {
        release: vi.fn(),
        addEventListener: () => {
          throw new Error('nope');
        },
      };
      const nav = { wakeLock: { request: vi.fn(() => Promise.resolve(lock)) } };
      const alerts = createAlerts({ nav });
      await alerts.acquireWakeLock();
      await alerts.acquireWakeLock();
      expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
    });

    it('fails quietly when unsupported, denied, or release throws', async () => {
      await expect(createAlerts({ nav: {} }).acquireWakeLock()).resolves.toBeUndefined();
      const denied = createAlerts({ nav: { wakeLock: { request: () => Promise.reject(new Error('no')) } } });
      await expect(denied.acquireWakeLock()).resolves.toBeUndefined();
      const lock = { release: () => Promise.reject(new Error('gone')) };
      const flaky = createAlerts({ nav: { wakeLock: { request: () => Promise.resolve(lock) } } });
      await flaky.acquireWakeLock();
      await expect(flaky.releaseWakeLock()).resolves.toBeUndefined();
    });
  });
});
