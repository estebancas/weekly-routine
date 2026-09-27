import { describe, it, expect } from 'vitest';
import { groupSupersets, getRoutine } from '../../src/routine.js';
import { WEEKEND } from '../../src/config.js';

const item = (group, name = `item-${group}`) => ({ group, name, description: '', setsReps: '', extra: [] });

describe('groupSupersets', () => {
  it('returns an empty array for no items', () => {
    expect(groupSupersets([])).toEqual([]);
  });

  it('turns plain letters into single-item, non-superset groups', () => {
    const out = groupSupersets([item('A'), item('B')]);
    expect(out).toEqual([
      { letter: 'A', superset: false, items: [item('A')] },
      { letter: 'B', superset: false, items: [item('B')] },
    ]);
  });

  it('collapses A1,A2 into one superset, items kept in order', () => {
    const a1 = item('A1', 'first');
    const a2 = item('A2', 'second');
    const out = groupSupersets([a1, a2]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ letter: 'A', superset: true });
    expect(out[0].items).toEqual([a1, a2]);
  });

  it('collapses three consecutive members of the same superset', () => {
    const out = groupSupersets([item('A1'), item('A2'), item('A3')]);
    expect(out).toHaveLength(1);
    expect(out[0].superset).toBe(true);
    expect(out[0].items).toHaveLength(3);
  });

  it('keeps two separate supersets apart: A1,A2,B1,B2', () => {
    const out = groupSupersets([item('A1'), item('A2'), item('B1'), item('B2')]);
    expect(out).toHaveLength(2);
    expect(out[0].letter).toBe('A');
    expect(out[1].letter).toBe('B');
    expect(out.every((g) => g.superset)).toBe(true);
  });

  it('does not merge across an interruption: A1,B,A2', () => {
    const out = groupSupersets([item('A1'), item('B'), item('A2')]);
    expect(out).toHaveLength(3);
    // Neither A1 nor A2 found a partner adjacent to it, so both demote to non-superset.
    expect(out[0]).toMatchObject({ letter: 'A', superset: false });
    expect(out[1]).toMatchObject({ letter: 'B', superset: false });
    expect(out[2]).toMatchObject({ letter: 'A', superset: false });
  });

  it('demotes a lone numbered item (D1 with no D2) to a normal exercise', () => {
    const out = groupSupersets([item('D1')]);
    expect(out).toHaveLength(1);
    expect(out[0].superset).toBe(false);
    expect(out[0].letter).toBe('D');
    expect(out[0].items[0].group).toBe('D1'); // the raw item is untouched
  });

  it('a plain letter followed by its numbered variant does not merge: A, A1', () => {
    const out = groupSupersets([item('A'), item('A1')]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ letter: 'A', superset: false });
    // A1 alone has no A2 partner, so it also demotes.
    expect(out[1]).toMatchObject({ letter: 'A', superset: false });
  });

  it('supports multi-letter group prefixes: AB1, AB2', () => {
    const out = groupSupersets([item('AB1'), item('AB2')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ letter: 'AB', superset: true });
  });

  it('treats an empty group string as a plain group', () => {
    const out = groupSupersets([item('')]);
    expect(out).toEqual([{ letter: '', superset: false, items: [item('')] }]);
  });

  it('collapses double-digit superset numbers: A10, A11', () => {
    const out = groupSupersets([item('A10'), item('A11')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ letter: 'A', superset: true });
    expect(out[0].items).toHaveLength(2);
  });

  it('does not match a group with trailing junk after the number: A1Z', () => {
    const out = groupSupersets([item('A1Z')]);
    expect(out).toEqual([{ letter: 'A1Z', superset: false, items: [item('A1Z')] }]);
  });

  it('does not match a group with a leading character before the letters: " A1"', () => {
    const out = groupSupersets([item(' A1')]);
    expect(out).toEqual([{ letter: ' A1', superset: false, items: [item(' A1')] }]);
  });

  it('does not mutate the input array or its items', () => {
    const items = [item('A1'), item('A2')];
    const snapshot = JSON.parse(JSON.stringify(items));
    groupSupersets(items);
    expect(JSON.parse(JSON.stringify(items))).toEqual(snapshot);
  });
});

describe('getRoutine', () => {
  it('returns the WEEKEND definition for Saturday (6) and Sunday (0)', () => {
    for (const wd of [0, 6]) {
      const r = getRoutine(wd);
      expect(r.weekend).toBe(true);
      expect(r.focus).toBe(WEEKEND[wd].focus);
      expect(r.note).toBe(WEEKEND[wd].note);
      expect(r.weekday).toBe(wd);
    }
  });

  it('returns a full weekday routine for Monday..Friday', () => {
    for (let wd = 1; wd <= 5; wd++) {
      const r = getRoutine(wd);
      expect(r.weekend).toBe(false);
      expect(r.weekday).toBe(wd);
      expect(typeof r.focus).toBe('string');
      expect(r.focus.length).toBeGreaterThan(0);
      expect(Array.isArray(r.mobility)).toBe(true);
      expect(Array.isArray(r.exercises)).toBe(true);
      expect(Array.isArray(r.stretch)).toBe(true);
    }
  });

  it('normalized items expose exactly the expected fields', () => {
    const r = getRoutine(1);
    for (const it of r.mobility) {
      expect(Object.keys(it).sort()).toEqual(['description', 'extra', 'group', 'name', 'setsReps'].sort());
    }
  });

  it('the flattened exercise item count matches the raw exercise count', async () => {
    const { default: raw } = await import('../../src/data/routine.json', { with: { type: 'json' } });
    const jsonDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let wd = 1; wd <= 5; wd++) {
      const day = raw.weekly_routine.find((d) => d.day === jsonDayNames[wd]);
      const r = getRoutine(wd);
      const flattened = r.exercises.reduce((n, g) => n + g.items.length, 0);
      expect(flattened).toBe((day.exercises ?? []).length);
    }
  });

  it('caches: repeated calls for the same weekday return the same object', () => {
    expect(getRoutine(1)).toBe(getRoutine(1));
  });

  it('falls back to "Sin rutina" for a weekday not present in the data', () => {
    const r = getRoutine(7);
    expect(r.weekend).toBe(true);
    expect(r.focus).toBe('Sin rutina');
    expect(r.note).toBe('');
  });
});
