import { describe, it, expect } from 'vitest';
import { createEngine } from '../../../src/timer/engine.js';

function setup(gapSeconds = 5) {
  let t = 1_000_000;
  const engine = createEngine({ now: () => t, gapSeconds });
  return { engine, advance: (s) => (t += s * 1000) };
}
const HOLD = { kind: 'hold', seconds: 10, rounds: 2, sides: 2 };

describe('createEngine', () => {
  it('is idle before start', () => {
    const { engine } = setup();
    expect(engine.snapshot()).toMatchObject({ status: 'idle', kind: null, remainingMs: 0 });
    expect(engine.tick()).toEqual([]);
    engine.pause();
    engine.resume();
    engine.reset();
    engine.adjust(5);
    expect(engine.snapshot().status).toBe('idle');
  });

  it('counts down from the injected clock', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 60, rounds: 1, sides: 1 });
    advance(15);
    expect(engine.snapshot()).toMatchObject({ status: 'running', remainingMs: 45_000 });
  });

  it('finishes a rest timer with a single done event', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 30, rounds: 1, sides: 1 });
    advance(29);
    expect(engine.tick()).toEqual([]);
    advance(1);
    expect(engine.tick()).toEqual(['done']);
    expect(engine.snapshot()).toMatchObject({ status: 'done', remainingMs: 0 });
    expect(engine.tick()).toEqual([]);
  });

  it('pauses without losing time and resumes from where it stopped', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 60, rounds: 1, sides: 1 });
    advance(10);
    engine.pause();
    advance(100);
    expect(engine.snapshot()).toMatchObject({ status: 'paused', remainingMs: 50_000 });
    engine.pause(); // no-op when already paused
    engine.resume();
    advance(5);
    expect(engine.snapshot().remainingMs).toBe(45_000);
    engine.resume(); // no-op when already running
    expect(engine.snapshot().remainingMs).toBe(45_000);
  });

  it('walks rounds x sides with a get-ready gap between them', () => {
    const { engine, advance } = setup();
    engine.start(HOLD);
    expect(engine.snapshot()).toMatchObject({ round: 1, rounds: 2, side: 1, sides: 2, phase: 'work' });
    advance(10);
    expect(engine.tick()).toEqual(['round-end']);
    expect(engine.snapshot()).toMatchObject({ phase: 'gap', remainingMs: 5000 });
    advance(5);
    expect(engine.tick()).toEqual(['round-start']);
    expect(engine.snapshot()).toMatchObject({ phase: 'work', round: 1, side: 2, remainingMs: 10_000 });
    advance(10 + 5);
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ round: 2, side: 1 });
    advance(10 + 5 + 10);
    expect(engine.tick()).toEqual(['round-end', 'round-start', 'done']);
  });

  it('catches up across several phases after a long sleep', () => {
    const { engine, advance } = setup();
    engine.start(HOLD);
    advance(1000);
    expect(engine.tick()).toEqual(['round-end', 'round-start', 'round-end', 'round-start', 'round-end', 'round-start', 'done']);
    expect(engine.snapshot().status).toBe('done');
  });

  it('keeps deadlines chained so overshoot is not lost', () => {
    const { engine, advance } = setup();
    engine.start(HOLD);
    advance(12); // 2s into the gap
    engine.tick();
    expect(engine.snapshot()).toMatchObject({ phase: 'gap', remainingMs: 3000 });
  });

  it('resets to the first round', () => {
    const { engine, advance } = setup();
    engine.start(HOLD);
    advance(16);
    engine.tick();
    engine.reset();
    expect(engine.snapshot()).toMatchObject({ status: 'running', round: 1, side: 1, phase: 'work', remainingMs: 10_000 });
  });

  it('adjusts a running countdown and a paused one, never below one second', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 60, rounds: 1, sides: 1 });
    engine.adjust(15);
    expect(engine.snapshot().remainingMs).toBe(75_000);
    engine.pause();
    engine.adjust(-15);
    expect(engine.snapshot().remainingMs).toBe(60_000);
    engine.adjust(-500);
    expect(engine.snapshot().remainingMs).toBe(1000);
    engine.resume();
    advance(1);
    expect(engine.tick()).toEqual(['done']);
  });

  it('carries an adjusted length into a reset, but does not touch the gap length', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 60, rounds: 1, sides: 1 });
    engine.adjust(15);
    engine.reset();
    expect(engine.snapshot().remainingMs).toBe(75_000);

    engine.start(HOLD);
    advance(10);
    engine.tick();
    engine.adjust(15); // in the gap: only this gap moves
    expect(engine.snapshot().remainingMs).toBe(20_000);
    advance(20);
    engine.tick();
    expect(engine.snapshot().remainingMs).toBe(10_000);
  });

  it('ignores adjust once done', () => {
    const { engine, advance } = setup();
    engine.start({ kind: 'rest', seconds: 5, rounds: 1, sides: 1 });
    advance(5);
    engine.tick();
    engine.adjust(15);
    expect(engine.snapshot()).toMatchObject({ status: 'done', remainingMs: 0 });
  });
});
