import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTimerBar, formatClock } from '../../../src/ui/timerBar.js';

let t;
let app;
let alerts;
let bar;

const q = (sel) => document.querySelector(sel);
const btn = (label) => document.querySelector(`button[aria-label="${label}"]`);
const advance = (s) => {
  for (let i = 0; i < s; i++) {
    t += 1000;
    vi.advanceTimersByTime(1000);
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  t = 1_000_000;
  document.body.innerHTML = '<main id="app" class="app"></main>';
  app = document.getElementById('app');
  alerts = {
    unlock: vi.fn(),
    alert: vi.fn(),
    acquireWakeLock: vi.fn(),
    releaseWakeLock: vi.fn(),
  };
  bar = createTimerBar({ app, alerts, now: () => t });
});

afterEach(() => {
  vi.useRealTimers();
});

const REST = { kind: 'rest', seconds: 60, rounds: 1, sides: 1 };
const HOLD = { kind: 'hold', seconds: 10, rounds: 2, sides: 2 };

describe('formatClock', () => {
  it('formats mm:ss rounding partial seconds up', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(125_000)).toBe('02:05');
  });
});

describe('createTimerBar', () => {
  it('opens a timer region docked outside #app and marks the app', () => {
    bar.start('Plancha', REST);
    expect(alerts.unlock).toHaveBeenCalled();
    expect(alerts.acquireWakeLock).toHaveBeenCalled();
    expect(q('.timer-dock').parentElement).toBe(document.body);
    expect(app.contains(q('.timer-dock'))).toBe(false);
    expect(q('[role="timer"]')).not.toBeNull();
    expect(q('.timer__name').textContent).toBe('Plancha');
    expect(q('.timer__kind').textContent).toBe('Descanso');
    expect(q('.timer__clock').textContent).toBe('01:00');
    expect(app.classList.contains('app--timer')).toBe(true);
  });

  it('counts down with the clock and alerts at zero', () => {
    bar.start('Plancha', REST);
    advance(15);
    expect(q('.timer__clock').textContent).toBe('00:45');
    advance(45);
    expect(q('.timer__clock').textContent).toBe('00:00');
    expect(alerts.alert).toHaveBeenCalledTimes(1);
    expect(q('.timer--done')).not.toBeNull();
    expect(q('.timer--flash')).not.toBeNull();
    expect(q('[aria-live]').textContent).toBe('Tiempo');
    expect(btn('Reiniciar')).not.toBeNull();
    expect(q('.timer__controls .btn--primary').disabled).toBe(true);
    expect(alerts.releaseWakeLock).toHaveBeenCalled();
    advance(2);
    expect(q('.timer--flash')).toBeNull();
  });

  it('shows rounds, the get-ready gap, and announces each new round', () => {
    bar.start('Hollow', HOLD);
    expect(q('.timer__kind').textContent).toBe('Aguante');
    expect(q('.timer__round').textContent).toBe('SERIE 1/2 · LADO 1/2');
    advance(10);
    expect(q('.timer__kind').textContent).toBe('Prepárate');
    expect(q('[aria-live]').textContent).toBe('');
    advance(5);
    expect(q('.timer__round').textContent).toBe('SERIE 1/2 · LADO 2/2');
    expect(q('[aria-live]').textContent).toBe('Serie 1 de 2, lado 2 de 2');
    expect(alerts.alert).toHaveBeenCalledTimes(2);
  });

  it('omits the side segment when there is a single side and no round for rest', () => {
    bar.start('Plancha', { kind: 'hold', seconds: 10, rounds: 3, sides: 1 });
    expect(q('.timer__round').textContent).toBe('SERIE 1/3');
    advance(15);
    expect(q('[aria-live]').textContent).toBe('Serie 2 de 3');
    bar.start('Sentadilla', REST);
    expect(q('.timer__round').textContent).toBe('');
  });

  it('pauses, resumes, adjusts and resets', () => {
    bar.start('Plancha', REST);
    advance(10);
    btn('Sumar 15 segundos').click();
    expect(q('.timer__clock').textContent).toBe('01:05');
    btn('Restar 15 segundos').click();
    expect(q('.timer__clock').textContent).toBe('00:50');

    q('.timer__controls .btn--primary').click();
    expect(q('.timer__controls .btn--primary').textContent).toBe('Reanudar');
    expect(alerts.releaseWakeLock).toHaveBeenCalled();
    advance(30);
    expect(q('.timer__clock').textContent).toBe('00:50');

    q('.timer__controls .btn--primary').click();
    expect(q('.timer__controls .btn--primary').textContent).toBe('Pausar');
    advance(5);
    expect(q('.timer__clock').textContent).toBe('00:45');

    btn('Reiniciar').click();
    expect(q('.timer__clock').textContent).toBe('01:00');
  });

  it('replaces the running timer when another item starts', () => {
    bar.start('Plancha', REST);
    bar.start('Hollow', HOLD);
    expect(document.querySelectorAll('.timer-dock')).toHaveLength(1);
    expect(q('.timer__name').textContent).toBe('Hollow');
    expect(q('.timer__clock').textContent).toBe('00:10');
  });

  it('closes cleanly and stops ticking', () => {
    bar.start('Plancha', REST);
    btn('Cerrar temporizador').click();
    expect(q('.timer-dock')).toBeNull();
    expect(app.classList.contains('app--timer')).toBe(false);
    advance(120);
    expect(alerts.alert).not.toHaveBeenCalled();
    expect(() => bar.close()).not.toThrow();
  });

  it('re-syncs from the clock when the page becomes visible again', () => {
    bar.start('Plancha', REST);
    t += 30_000; // device slept: no interval callbacks ran
    document.dispatchEvent(new Event('visibilitychange'));
    expect(q('.timer__clock').textContent).toBe('00:30');
    expect(alerts.acquireWakeLock).toHaveBeenCalledTimes(2);
  });

  it('ignores visibilitychange when hidden or when no bar is open', () => {
    document.dispatchEvent(new Event('visibilitychange'));
    bar.start('Plancha', REST);
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    t += 30_000;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(q('.timer__clock').textContent).toBe('01:00');
    spy.mockRestore();
  });

  it('does not re-acquire the wake lock on resume-from-sleep once finished', () => {
    bar.start('Plancha', REST);
    t += 120_000;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(q('.timer--done')).not.toBeNull();
    expect(alerts.acquireWakeLock).toHaveBeenCalledTimes(1);
  });
});
