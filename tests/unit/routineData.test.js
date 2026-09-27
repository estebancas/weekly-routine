import { describe, it, expect } from 'vitest';
import raw from '../../src/data/routine.json' with { type: 'json' };

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * Contract tests on the real data file. These guard against the app silently rendering
 * blanks (a bad edit to routine.json breaking `routine.js`'s assumptions) rather than
 * exercising code paths — see routine.test.js / routine.normalize.test.js for that.
 */
describe('routine.json data contract', () => {
  it('lists exactly Monday-Friday, each once, no weekend days', () => {
    const days = raw.weekly_routine.map((d) => d.day);
    expect(new Set(days).size).toBe(days.length);
    expect(days.sort()).toEqual([...WEEKDAYS].sort());
  });

  it('every day has a non-empty focus and non-empty mobility/exercises/stretch', () => {
    for (const day of raw.weekly_routine) {
      expect(day.focus, `${day.day}.focus`).toBeTruthy();
      for (const key of ['mobility', 'exercises', 'stretch']) {
        expect(Array.isArray(day[key]), `${day.day}.${key} is an array`).toBe(true);
        expect(day[key].length, `${day.day}.${key} is non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every item has a non-empty name and a string sets_reps', () => {
    for (const day of raw.weekly_routine) {
      for (const key of ['mobility', 'exercises', 'stretch']) {
        for (const item of day[key]) {
          expect(item.name, `${day.day}.${key} item name`).toBeTruthy();
          expect(typeof item.sets_reps, `${day.day}.${key} "${item.name}" sets_reps`).toBe('string');
        }
      }
    }
  });

  it('every `extra`, when present, is an array of non-empty strings', () => {
    for (const day of raw.weekly_routine) {
      for (const key of ['mobility', 'exercises', 'stretch']) {
        for (const item of day[key]) {
          if (item.extra === undefined) continue;
          expect(Array.isArray(item.extra), `${day.day}.${key} "${item.name}" extra`).toBe(true);
          for (const note of item.extra) {
            expect(typeof note).toBe('string');
            expect(note.trim().length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('exercise groups are well-formed letters(+digits), unique per day', () => {
    const groupPattern = /^[A-Z]+\d*$/;
    for (const day of raw.weekly_routine) {
      const groups = day.exercises.map((e) => e.group);
      for (const g of groups) expect(g, `${day.day} group "${g}"`).toMatch(groupPattern);
      expect(new Set(groups).size, `${day.day} duplicate group`).toBe(groups.length);
    }
  });

  it('numbered superset members run contiguously from 1 for each letter prefix', () => {
    for (const day of raw.weekly_routine) {
      const byLetter = new Map();
      for (const e of day.exercises) {
        const m = /^([A-Z]+)(\d+)$/.exec(e.group);
        if (!m) continue;
        const [, letter, num] = m;
        if (!byLetter.has(letter)) byLetter.set(letter, []);
        byLetter.get(letter).push(Number(num));
      }
      for (const [letter, nums] of byLetter) {
        expect(nums, `${day.day} ${letter} numbering`).toEqual(nums.map((_, i) => i + 1));
      }
    }
  });

  it('numbered superset members appear back-to-back — groupSupersets only merges adjacent items', () => {
    for (const day of raw.weekly_routine) {
      const groups = day.exercises.map((e) => e.group);
      const firstSeenAt = new Map();
      const lastSeenAt = new Map();
      groups.forEach((g, i) => {
        const m = /^([A-Z]+)\d+$/.exec(g);
        if (!m) return;
        const letter = m[1];
        if (!firstSeenAt.has(letter)) firstSeenAt.set(letter, i);
        lastSeenAt.set(letter, i);
      });
      for (const [letter, first] of firstSeenAt) {
        const last = lastSeenAt.get(letter);
        const span = groups.slice(first, last + 1);
        expect(span.every((g) => new RegExp(`^${letter}\\d+$`).test(g)), `${day.day} ${letter} not contiguous`).toBe(
          true,
        );
      }
    }
  });
});
