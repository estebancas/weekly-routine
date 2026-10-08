import { REST_DEFAULT_S } from '../config.js';

const DURATION = /(\d+)(?:\s*-\s*\d+)?\s*(segundos?|seg|minutos?)\b/i;
const SIDES = /\bpor\s+(lado|brazo)\b/i;
const ROUNDS = /^\s*(\d+)\s*(?:x|series?\b|sets?\b)/i;
const REST_NOTE = /descanso[^\d]*(\d+)/i;

/**
 * Derives a timer from an item's `setsReps` text (and `extra` notes).
 * Hold: the text has a duration ("3x 45 segundos"); rounds = set count x sides ("por lado"/"por brazo" = 2),
 * a range takes its lower bound. Rest: anything else (reps), counting down REST_DEFAULT_S, or the lower
 * bound of a "Descanso ... N" note.
 * @param {string} setsReps
 * @param {string[]} [extra]
 * @returns {{ kind: 'hold'|'rest', seconds: number, rounds: number, sides: number }}
 */
export function parseDuration(setsReps = '', extra = []) {
  const text = setsReps ?? '';
  const match = /repeticiones de/i.test(text) ? null : DURATION.exec(text);
  if (match) {
    const unit = match[2].toLowerCase();
    const seconds = Number(match[1]) * (unit.startsWith('min') ? 60 : 1);
    const rounds = Number(ROUNDS.exec(text)?.[1] ?? 1);
    const sides = SIDES.test(text) ? 2 : 1;
    return { kind: 'hold', seconds, rounds, sides };
  }
  let seconds = REST_DEFAULT_S;
  for (const note of extra ?? []) {
    const m = REST_NOTE.exec(note);
    if (m) {
      seconds = Number(m[1]);
      break;
    }
  }
  return { kind: 'rest', seconds, rounds: 1, sides: 1 };
}
