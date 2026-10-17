import { describe, it, expect, vi } from 'vitest';
import { createAlerts, beepDataUri } from '../../../src/timer/alerts.js';

function fakeAudio() {
  const osc = { frequency: {}, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const ctx = {
    currentTime: 1,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => ({ connect: vi.fn() })),
  };
  return { osc, ctx, AudioCtx: vi.fn(function () {
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
    expect(nav.vibrate).toHaveBeenCalled();
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalledWith(expect.any(Number));
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

  it('encodes the beep as a WAV data URI', () => {
    const uri = beepDataUri();
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
    const bin = atob(uri.split(',')[1]);
    expect(bin.slice(0, 4)).toBe('RIFF');
    expect(bin.slice(8, 12)).toBe('WAVE');
    expect(bin.length).toBe(44 + 2000 * 2);
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

    it('claims a transient audio session for the beep and hands it back when it ends', async () => {
      let onEnded;
      const el = { ...fakeEl(), addEventListener: (_, fn) => (onEnded = fn) };
      const nav = { ...IOS, audioSession: { type: 'auto' } };
      const alerts = createAlerts({ nav, makeAudio: () => el });
      alerts.unlock();
      expect(nav.audioSession.type).toBe('transient');
      await Promise.resolve();
      await Promise.resolve();
      expect(nav.audioSession.type).toBe('auto');
      alerts.alert();
      expect(nav.audioSession.type).toBe('transient');
      onEnded();
      expect(nav.audioSession.type).toBe('auto');
    });

    it('hands the session back when playback is rejected, and tolerates a throwing setter', async () => {
      const nav = { ...IOS, audioSession: { type: 'auto' } };
      const alerts = createAlerts({ nav, makeAudio: () => fakeEl({ playOk: false }), onSilent: () => {} });
      alerts.unlock();
      await new Promise((r) => setTimeout(r, 0));
      alerts.alert();
      await new Promise((r) => setTimeout(r, 0));
      expect(nav.audioSession.type).toBe('auto');
      const picky = {
        ...IOS,
        audioSession: {
          set type(_) {
            throw new TypeError('unsupported');
          },
        },
      };
      const a2 = createAlerts({ nav: picky, makeAudio: () => fakeEl() });
      expect(() => a2.unlock()).not.toThrow();
      expect(() => a2.alert()).not.toThrow();
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
      const alerts = createAlerts({ nav: IOS, makeAudio });
      expect(() => alerts.alert()).not.toThrow();
      expect(makeAudio).not.toHaveBeenCalled();
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
