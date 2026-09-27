import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nowInZone } from '../../src/time.js';
import { STRETCH_CUTOFF_MINUTES } from '../../src/config.js';

// America/Costa_Rica is a fixed UTC-6 offset, no DST.
describe('nowInZone(date) — explicit instant', () => {
  it('reports the Costa Rica local date, weekday and time', () => {
    // 2026-09-29 is a Tuesday; 19:05 UTC-6 = 01:05Z the next day.
    const r = nowInZone(new Date('2026-09-30T01:05:00Z'));
    expect(r.dateKey).toBe('2026-09-29');
    expect(r.weekday).toBe(2); // Tuesday
    expect(r.hour).toBe(19);
    expect(r.minute).toBe(5);
    expect(r.minutesOfDay).toBe(19 * 60 + 5);
  });

  it('zero-pads dateKey month and day', () => {
    const r = nowInZone(new Date('2026-01-05T12:00:00Z'));
    expect(r.dateKey).toBe('2026-01-05');
  });

  it('formats dateLabel in Spanish without dots', () => {
    const r = nowInZone(new Date('2026-09-28T01:05:00Z'));
    expect(r.dateLabel).toBe('27 sept 2026');
    expect(r.dateLabel).not.toContain('.');
  });

  it('crosses midnight backwards: 05:59Z is still the previous CR day', () => {
    // 2026-09-28 is a Monday. 05:59Z = 23:59 CR the day before (Sunday 09-27).
    const r = nowInZone(new Date('2026-09-28T05:59:00Z'));
    expect(r.dateKey).toBe('2026-09-27');
    expect(r.weekday).toBe(0); // Sunday
    expect(r.hour).toBe(23);
    expect(r.minute).toBe(59);
    expect(r.minutesOfDay).toBe(23 * 60 + 59);
  });

  it('crosses midnight forwards: 06:00Z rolls into the next CR day at 00:00', () => {
    const r = nowInZone(new Date('2026-09-28T06:00:00Z'));
    expect(r.dateKey).toBe('2026-09-28');
    expect(r.weekday).toBe(1); // Monday
    expect(r.hour).toBe(0);
    expect(r.minute).toBe(0);
    expect(r.minutesOfDay).toBe(0);
  });

  it('ignores the device timezone entirely', () => {
    // 2026-09-28T02:00Z is Monday everywhere except Costa Rica, where it's still
    // Sunday 20:00. The device's own TZ (whatever the test runner uses) must not leak in.
    const r = nowInZone(new Date('2026-09-28T02:00:00Z'));
    expect(r.weekday).toBe(0); // Sunday in CR
    expect(r.hour).toBe(20);
  });

  it('maps every weekday of a full week correctly', () => {
    const expected = [
      ['2026-09-27T18:00:00Z', 0], // Sun 12:00 CR
      ['2026-09-28T18:00:00Z', 1], // Mon
      ['2026-09-29T18:00:00Z', 2], // Tue
      ['2026-09-30T18:00:00Z', 3], // Wed
      ['2026-10-01T18:00:00Z', 4], // Thu
      ['2026-10-02T18:00:00Z', 5], // Fri
      ['2026-10-03T18:00:00Z', 6], // Sat
    ];
    for (const [iso, weekday] of expected) {
      expect(nowInZone(new Date(iso)).weekday).toBe(weekday);
    }
  });

  it('normalizes an hour of "24" (some ICU implementations report midnight this way under h23) to 0', () => {
    // This Node/ICU always reports midnight as "00", so simulate the quirk directly by
    // patching formatToParts, rather than relying on a specific engine's behavior.
    const original = Intl.DateTimeFormat.prototype.formatToParts;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(function (...args) {
      return original.apply(this, args).map((p) => (p.type === 'hour' ? { ...p, value: '24' } : p));
    });
    const r = nowInZone(new Date('2026-09-28T06:00:00Z')); // midnight CR
    expect(r.hour).toBe(0);
    expect(r.minutesOfDay).toBe(0);
  });

  it('STRETCH_CUTOFF_MINUTES boundary is exclusive below, inclusive at/above', () => {
    // 18:29 CR -> 1109 minutes; 18:30 CR -> 1110 minutes (== STRETCH_CUTOFF_MINUTES)
    const before = nowInZone(new Date('2026-09-29T00:29:00Z')); // 18:29 previous CR day
    const at = nowInZone(new Date('2026-09-29T00:30:00Z')); // 18:30 previous CR day
    expect(before.minutesOfDay).toBe(1109);
    expect(before.minutesOfDay < STRETCH_CUTOFF_MINUTES).toBe(true);
    expect(at.minutesOfDay).toBe(1110);
    expect(at.minutesOfDay >= STRETCH_CUTOFF_MINUTES).toBe(true);
  });
});

describe('nowInZone() — default argument (resolveNow, dev clock override)', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the real system time when there is no ?now= param', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T18:05:00Z')); // 12:05 CR
    const r = nowInZone();
    expect(r.hour).toBe(12);
    expect(r.minute).toBe(5);
  });

  it('reads ?now=YYYY-MM-DDTHH:mm as Costa Rica local time (UTC-6)', () => {
    history.replaceState(null, '', '/?now=2026-09-29T19:05');
    const r = nowInZone();
    expect(r.dateKey).toBe('2026-09-29');
    expect(r.hour).toBe(19);
    expect(r.minute).toBe(5);
  });

  it('accepts a full ISO string with an explicit offset', () => {
    history.replaceState(null, '', '/?now=2026-09-29T12:00:00-06:00');
    const r = nowInZone();
    expect(r.hour).toBe(12);
    expect(r.dateKey).toBe('2026-09-29');
  });

  it('falls back to the real clock when ?now= is not a valid date', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T18:05:00Z'));
    history.replaceState(null, '', '/?now=garbage');
    const r = nowInZone();
    expect(r.hour).toBe(12); // fell back to the faked system clock, not "garbage"
  });

  it('ignores ?now= outside dev mode', () => {
    vi.stubEnv('DEV', false);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T18:05:00Z'));
    history.replaceState(null, '', '/?now=2026-01-01T00:00');
    const r = nowInZone();
    expect(r.hour).toBe(12); // real clock, not the query override
  });
});
