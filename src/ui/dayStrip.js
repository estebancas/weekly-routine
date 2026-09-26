import { DAY_ORDER, DAY_SHORT, DAY_NAMES, LABELS } from '../config.js';
import { Chip } from './primitives/index.js';

/**
 * @param {object} o
 * @param {number} o.today      actual weekday in Costa Rica
 * @param {number} o.selected   confirmed routine for today
 * @param {number} o.preview    routine currently displayed
 * @param {(weekday: number) => void} o.onPick
 */
export function renderDayStrip({ today, selected, preview, onPick }) {
  const el = document.createElement('nav');
  el.className = 'day-strip';
  el.setAttribute('aria-label', 'Días de la semana');

  for (const wd of DAY_ORDER) {
    el.append(
      Chip({
        label: DAY_SHORT[wd],
        selected: wd === selected,
        preview: wd === preview && preview !== selected,
        marker: wd === today,
        ariaLabel: LABELS.pickDay(DAY_NAMES[wd]),
        onClick: () => onPick(wd),
      }),
    );
  }
  return el;
}
