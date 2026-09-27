import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * These tests replace src/data/routine.json with small fixtures so normalizeItem's
 * defaulting logic can be exercised directly, independent of the real routine content.
 */
async function loadWithFixture(fixture) {
  vi.resetModules();
  vi.doMock('../../src/data/routine.json', () => ({ default: fixture }));
  return import('../../src/routine.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('../../src/data/routine.json');
});

describe('normalizeItem (via getRoutine)', () => {
  it('wraps a string `extra` into a single-element array', async () => {
    const { getRoutine } = await loadWithFixture({
      weekly_routine: [{ day: 'Monday', focus: 'F', mobility: [{ name: 'x', extra: 'one note' }] }],
    });
    expect(getRoutine(1).mobility[0].extra).toEqual(['one note']);
  });

  it('defaults a missing or null `extra` to an empty array', async () => {
    const { getRoutine } = await loadWithFixture({
      weekly_routine: [{ day: 'Monday', focus: 'F', mobility: [{ name: 'a' }, { name: 'b', extra: null }] }],
    });
    expect(getRoutine(1).mobility[0].extra).toEqual([]);
    expect(getRoutine(1).mobility[1].extra).toEqual([]);
  });

  it('drops blank and non-string entries from `extra`', async () => {
    const { getRoutine } = await loadWithFixture({
      weekly_routine: [
        { day: 'Monday', focus: 'F', mobility: [{ name: 'a', extra: ['keep', '  ', '', 42, null, 'also keep'] }] },
      ],
    });
    expect(getRoutine(1).mobility[0].extra).toEqual(['keep', 'also keep']);
  });

  it('defaults missing sets_reps, description, group and name to empty strings', async () => {
    const { getRoutine } = await loadWithFixture({
      weekly_routine: [{ day: 'Monday', focus: 'F', mobility: [{}] }],
    });
    const item = getRoutine(1).mobility[0];
    expect(item).toEqual({ group: '', name: '', description: '', setsReps: '', extra: [] });
  });

  it('defaults missing mobility/exercises/stretch arrays to []', async () => {
    const { getRoutine } = await loadWithFixture({ weekly_routine: [{ day: 'Monday', focus: 'F' }] });
    const r = getRoutine(1);
    expect(r.mobility).toEqual([]);
    expect(r.exercises).toEqual([]);
    expect(r.stretch).toEqual([]);
  });

  it('falls back to "Sin rutina" when a weekday is entirely absent from the data', async () => {
    const { getRoutine } = await loadWithFixture({ weekly_routine: [] });
    const r = getRoutine(1);
    expect(r.weekend).toBe(true);
    expect(r.focus).toBe('Sin rutina');
  });
});
