import { describe, it, expect, vi } from 'vitest';
import { createAlerts } from '../../../src/timer/alerts.js';

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
