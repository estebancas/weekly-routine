import { LABELS } from '../config.js';
import { Tag } from './primitives/index.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderNotes(extra) {
  if (!extra.length) return null;
  const ul = el('ul', 'item__notes');
  for (const note of extra) ul.append(el('li', '', note));
  return ul;
}

/** Mobility or stretch item. */
export function renderItem(item) {
  const art = el('article', 'item');
  const head = el('header', 'item__head');
  head.append(el('h3', 'item__name', item.name));
  if (item.setsReps) head.append(el('span', 'item__reps', item.setsReps));
  art.append(head);
  if (item.description) art.append(el('p', 'item__desc', item.description));
  const notes = renderNotes(item.extra);
  if (notes) art.append(notes);
  return art;
}

function renderExercise(item) {
  const art = el('article', 'exercise');
  art.append(el('div', 'exercise__letter', item.group));
  const body = el('div', 'exercise__body');
  body.append(el('h3', 'item__name', item.name));
  if (item.setsReps) body.append(el('span', 'item__reps', item.setsReps));
  const notes = renderNotes(item.extra);
  if (notes) body.append(notes);
  art.append(body);
  return art;
}

/** Exercise group from groupSupersets(): a single exercise or a superset container. */
export function renderExerciseGroup(group) {
  if (!group.superset) return renderExercise(group.items[0]);

  const wrap = el('div', 'superset');
  const head = el('div', 'superset__head');
  head.append(Tag({ label: `${LABELS.superset} ${group.letter}`, variant: 'inverse' }));
  wrap.append(head);

  group.items.forEach((item, i) => {
    if (i > 0) wrap.append(el('div', 'superset__divider'));
    wrap.append(renderExercise(item));
  });
  return wrap;
}

/** Saturday / Sunday block. */
export function renderWeekend(routine) {
  const wrap = el('div', 'weekend');
  wrap.append(el('div', 'weekend__stripe'));
  wrap.append(el('h2', 'weekend__title', routine.focus));
  if (routine.note) wrap.append(el('p', '', routine.note));
  return wrap;
}
