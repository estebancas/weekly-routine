import { DAY_NAMES, LABELS } from '../config.js';
import { Tag } from './primitives/index.js';

/**
 * @param {object} o
 * @param {object} o.routine        routine being displayed
 * @param {string} o.dateLabel      today's date in Costa Rica
 * @param {boolean} o.isPreview     displayed day differs from the selected one
 * @param {boolean} o.isOverridden  selected day differs from the actual weekday
 */
export function renderHero({ routine, dateLabel, isPreview, isOverridden }) {
  const el = document.createElement('header');
  el.className = 'hero';

  const day = document.createElement('h1');
  day.className = 'hero__day';
  day.textContent = DAY_NAMES[routine.weekday];

  const focus = document.createElement('p');
  focus.className = 'hero__focus';
  focus.textContent = routine.focus;

  const meta = document.createElement('div');
  meta.className = 'hero__meta';
  const date = document.createElement('span');
  date.textContent = dateLabel;
  meta.append(date);

  if (isPreview) meta.append(Tag({ label: LABELS.preview, variant: 'hazard' }));
  else if (isOverridden) meta.append(Tag({ label: LABELS.changed, variant: 'accent' }));
  else meta.append(Tag({ label: LABELS.today, variant: 'accent-2' }));

  el.append(day, focus, meta);
  return el;
}
