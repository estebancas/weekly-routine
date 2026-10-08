import { describe, it, expect } from 'vitest';
import raw from '../../../src/data/routine.json' with { type: 'json' };
import { parseDuration } from '../../../src/timer/parse.js';

const hold = (seconds, rounds = 1, sides = 1) => ({ kind: 'hold', seconds, rounds, sides });
const rest = (seconds = 60) => ({ kind: 'rest', seconds, rounds: 1, sides: 1 });

describe('parseDuration', () => {
  it.each([
    ['1x60 segundos por lado', hold(60, 1, 2)],
    ['1x60-120 segundos por brazo', hold(60, 1, 2)],
    ['1x60-120 segundos por lado', hold(60, 1, 2)],
    ['1x60-120 segundos totales', hold(60)],
    ['1x60-120 segundos', hold(60)],
    ['2 minutos por brazo', hold(120, 1, 2)],
    ['2 minutos', hold(120)],
    ['1 minuto', hold(60)],
    ['5 minutos', hold(300)],
    ['2x15 segundos por brazo', hold(15, 2, 2)],
    ['3 series de 45 segundos', hold(45, 3)],
    ['3x 45 segundos', hold(45, 3)],
    ['10 repeticiones de 3 segundos', rest()],
    ['3x10', rest()],
    ['2x10 por lado', rest()],
    ['3 set al fallo max 15 reps', rest()],
    ['2x12, 2x8', rest()],
    ['', rest()],
  ])('%j', (text, expected) => {
    expect(parseDuration(text, [])).toEqual(expected);
  });

  it('takes the lower bound of a "Descanso" note for rest timers', () => {
    expect(parseDuration('3x10', ['Descanso máximo de 45-60 segundos entre superseries'])).toEqual(rest(45));
  });

  it('ignores notes without a Descanso instruction', () => {
    expect(parseDuration('3x10', ['entre sets 45seg plank'])).toEqual(rest());
  });

  it('tolerates missing arguments', () => {
    expect(parseDuration()).toEqual(rest());
    expect(parseDuration(null, null)).toEqual(rest());
  });

  it('yields a positive timer for every item in routine.json', () => {
    for (const day of raw.weekly_routine) {
      for (const key of ['mobility', 'exercises', 'stretch']) {
        for (const item of day[key]) {
          const t = parseDuration(item.sets_reps, item.extra);
          expect(t.seconds, `${day.day} ${item.name}`).toBeGreaterThan(0);
          expect(t.rounds * t.sides).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
