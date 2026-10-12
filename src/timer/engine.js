import { ROUND_GAP_S } from '../config.js';

const MIN_MS = 1000;

/**
 * Countdown state machine. The clock is injected (`now()` in ms) and time is always
 * derived from deadlines, never from counting ticks, so it stays right after the
 * device sleeps. `tick()` advances the machine and returns the events it crossed:
 * 'round-end' (a hold round finished, the gap begins), 'round-start' (the gap ended),
 * 'done' (the last countdown hit zero).
 * @param {{ now: () => number, gapSeconds?: number }} o
 */
export function createEngine({ now, gapSeconds = ROUND_GAP_S }) {
  let cfg = null; // { kind, seconds, rounds, sides }
  let status = 'idle'; // idle | running | paused | done
  let phase = 'work'; // work | gap
  let unit = 0; // 0-based index over rounds * sides
  let remaining = 0; // ms left in the phase, valid while paused
  let endAt = 0; // deadline, valid while running

  const units = () => cfg.rounds * cfg.sides;
  const left = () => (status === 'running' ? Math.max(0, endAt - now()) : remaining);

  function begin(ms) {
    phase = 'work';
    remaining = ms;
    endAt = now() + ms;
    status = 'running';
  }

  return {
    start(config) {
      cfg = { ...config };
      unit = 0;
      begin(cfg.seconds * 1000);
    },
    pause() {
      if (status !== 'running') return;
      remaining = left();
      status = 'paused';
    },
    resume() {
      if (status !== 'paused') return;
      endAt = now() + remaining;
      status = 'running';
    },
    reset() {
      if (!cfg) return;
      unit = 0;
      begin(cfg.seconds * 1000);
    },
    /** Add or remove seconds on the current countdown (never below one second). */
    adjust(deltaSeconds) {
      if (status !== 'running' && status !== 'paused') return;
      const next = Math.max(MIN_MS, left() + deltaSeconds * 1000);
      if (phase === 'work') cfg.seconds = Math.max(1, cfg.seconds + (next - left()) / 1000);
      if (status === 'running') endAt = now() + next;
      else remaining = next;
    },
    tick() {
      const events = [];
      while (status === 'running' && now() >= endAt) {
        if (phase === 'work' && unit + 1 >= units()) {
          status = 'done';
          remaining = 0;
          events.push('done');
        } else if (phase === 'work') {
          phase = 'gap';
          endAt += gapSeconds * 1000; // chain from the deadline so a sleep doesn't lose time
          events.push('round-end');
        } else {
          phase = 'work';
          unit += 1;
          endAt += cfg.seconds * 1000;
          events.push('round-start');
        }
      }
      return events;
    },
    snapshot() {
      return {
        kind: cfg?.kind ?? null,
        status,
        phase,
        round: cfg ? Math.floor(unit / cfg.sides) + 1 : 0,
        rounds: cfg?.rounds ?? 0,
        side: cfg ? (unit % cfg.sides) + 1 : 0,
        sides: cfg?.sides ?? 0,
        remainingMs: cfg ? left() : 0,
      };
    },
  };
}
