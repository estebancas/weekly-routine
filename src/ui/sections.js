import { SECTIONS } from '../config.js';
import { Details, Panel } from './primitives/index.js';
import { renderItem, renderExerciseGroup, renderWeekend } from './items.js';

/**
 * @param {object} o
 * @param {object} o.routine
 * @param {Record<string, boolean>} o.openSections
 * @param {(key: string, open: boolean) => void} o.onToggle
 * @param {(name: string, timer: object) => void} [o.onTimer]
 */
export function renderSections({ routine, openSections, onToggle, onTimer }) {
  const el = document.createElement('div');
  el.className = 'sections';

  if (routine.weekend) {
    el.append(Panel({ shadow: 'accent-2', children: [renderWeekend(routine)], as: 'section' }));
    return el;
  }

  for (const section of SECTIONS) {
    const entries = routine[section.key] ?? [];
    const list = document.createElement('div');
    list.className = 'items';
    for (const entry of entries) {
      list.append(section.key === 'exercises' ? renderExerciseGroup(entry, onTimer) : renderItem(entry, onTimer));
    }
    const count = section.key === 'exercises' ? entries.reduce((n, g) => n + g.items.length, 0) : entries.length;

    el.append(
      Details({
        num: section.num,
        title: section.title,
        count,
        open: Boolean(openSections[section.key]),
        onToggle: (open) => onToggle(section.key, open),
        children: [list],
      }),
    );
  }
  return el;
}
