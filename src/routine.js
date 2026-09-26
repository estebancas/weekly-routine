import raw from './data/routine.json' with { type: 'json' };
import { JSON_DAY_NAMES, WEEKEND } from './config.js';

const toList = (x) => (Array.isArray(x) ? x : x ? [x] : []).filter((s) => typeof s === 'string' && s.trim());

const normalizeItem = (it) => ({
  group: it.group ?? '',
  name: it.name ?? '',
  description: it.description ?? '',
  setsReps: it.sets_reps ?? '',
  extra: toList(it.extra),
});

/**
 * Collapses consecutive exercises like A1, A2 into one superset group.
 * Plain letters (A, B) become single-item groups.
 * @returns {Array<{ letter: string, superset: boolean, items: object[] }>}
 */
export function groupSupersets(items) {
  const out = [];
  for (const it of items) {
    const m = /^([A-Z]+)(\d+)$/.exec(it.group);
    if (m) {
      const last = out[out.length - 1];
      if (last?.superset && last.letter === m[1]) {
        last.items.push(it);
        continue;
      }
      out.push({ letter: m[1], superset: true, items: [it] });
    } else {
      out.push({ letter: it.group, superset: false, items: [it] });
    }
  }
  // A lone "D1" without a partner renders as a normal exercise.
  for (const g of out) if (g.superset && g.items.length < 2) g.superset = false;
  return out;
}

const byDayName = new Map(raw.weekly_routine.map((d) => [d.day, d]));
const cache = new Map();

/**
 * @param {number} weekday 0 = Sunday
 * @returns {{ weekday: number, weekend: boolean, focus: string, note?: string, mobility?: object[], exercises?: object[], stretch?: object[] }}
 */
export function getRoutine(weekday) {
  if (cache.has(weekday)) return cache.get(weekday);

  let routine;
  if (WEEKEND[weekday]) {
    routine = { weekday, weekend: true, ...WEEKEND[weekday] };
  } else {
    const d = byDayName.get(JSON_DAY_NAMES[weekday]);
    routine = d
      ? {
          weekday,
          weekend: false,
          focus: d.focus,
          mobility: (d.mobility ?? []).map(normalizeItem),
          exercises: groupSupersets((d.exercises ?? []).map(normalizeItem)),
          stretch: (d.stretch ?? []).map(normalizeItem),
        }
      : { weekday, weekend: true, focus: 'Sin rutina', note: '' };
  }
  cache.set(weekday, routine);
  return routine;
}
