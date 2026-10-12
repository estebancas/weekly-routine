import { LABELS, COPY_FEEDBACK_MS } from '../config.js';
import { detectPlatform, youtubeAppUrl, youtubeWebUrl, openOnIos } from '../youtube.js';
import { parseDuration } from '../timer/parse.js';
import { icon } from './icons.js';
import { IconButton, Tag } from './primitives/index.js';

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

function searchLink(name) {
  const platform = detectPlatform(navigator);
  const link = IconButton({
    icon: icon('play'),
    ariaLabel: LABELS.searchVideo(name),
    variant: 'primary',
    href: platform === 'android' ? youtubeAppUrl(name, platform) : youtubeWebUrl(name),
  });
  if (platform === 'ios') {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openOnIos(name);
    });
  }
  return link;
}

/**
 * Copy button. Feedback is applied to the nodes directly (never via state.set(), which
 * would rebuild the open <details>), and a repeat tap restarts the revert timer.
 */
function copyButton(name, live) {
  let timer;
  const idle = icon('copy');
  const btn = IconButton({
    icon: idle,
    ariaLabel: LABELS.copyName(name),
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(name);
      } catch {
        return; // no clipboard access: leave the button as it was
      }
      btn.replaceChildren(icon('check'));
      btn.classList.add('icon-btn--done');
      live.textContent = LABELS.copied;
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.replaceChildren(idle);
        btn.classList.remove('icon-btn--done');
        live.textContent = '';
      }, COPY_FEEDBACK_MS);
    },
  });
  return btn;
}

function timerButton(item, onTimer) {
  return IconButton({
    icon: icon('timer'),
    ariaLabel: LABELS.startTimer(item.name),
    onClick: () => onTimer(item.name, parseDuration(item.setsReps, item.extra)),
  });
}

/** Item name with its search-video, copy-name and (when `onTimer` is given) timer buttons on the right. */
function renderNameRow(item, onTimer) {
  const row = el('div', 'item__title-row');
  const actions = el('div', 'item__actions');
  const live = el('span', 'u-sr-only');
  live.setAttribute('aria-live', 'polite');
  actions.append(searchLink(item.name), copyButton(item.name, live));
  if (onTimer) actions.append(timerButton(item, onTimer));
  actions.append(live);
  row.append(el('h3', 'item__name', item.name), actions);
  return row;
}

/** Mobility or stretch item. */
export function renderItem(item, onTimer) {
  const art = el('article', 'item');
  const head = el('header', 'item__head');
  head.append(renderNameRow(item, onTimer));
  if (item.setsReps) head.append(el('span', 'item__reps', item.setsReps));
  art.append(head);
  if (item.description) art.append(el('p', 'item__desc', item.description));
  const notes = renderNotes(item.extra);
  if (notes) art.append(notes);
  return art;
}

function renderExercise(item, onTimer) {
  const art = el('article', 'exercise');
  art.append(el('div', 'exercise__letter', item.group));
  const body = el('div', 'exercise__body');
  body.append(renderNameRow(item, onTimer));
  if (item.setsReps) body.append(el('span', 'item__reps', item.setsReps));
  const notes = renderNotes(item.extra);
  if (notes) body.append(notes);
  art.append(body);
  return art;
}

/** Exercise group from groupSupersets(): a single exercise or a superset container. */
export function renderExerciseGroup(group, onTimer) {
  if (!group.superset) return renderExercise(group.items[0], onTimer);

  const wrap = el('div', 'superset');
  const head = el('div', 'superset__head');
  head.append(Tag({ label: `${LABELS.superset} ${group.letter}`, variant: 'inverse' }));
  wrap.append(head);

  group.items.forEach((item, i) => {
    if (i > 0) wrap.append(el('div', 'superset__divider'));
    wrap.append(renderExercise(item, onTimer));
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
