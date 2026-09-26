import './Details.css';

/**
 * Accordion built on native <details>. Numbered title, count badge, +/- glyph.
 * @param {object} o
 * @param {string} o.num       e.g. "01"
 * @param {string} o.title
 * @param {number|string} [o.count]
 * @param {boolean} [o.open]
 * @param {(open: boolean) => void} [o.onToggle]
 * @param {Array<Node|string>} [o.children]
 */
export function Details({ num, title, count, open = false, onToggle, children = [] } = {}) {
  const el = document.createElement('details');
  el.className = 'acc';
  el.open = open;

  const summary = document.createElement('summary');
  summary.className = 'acc__summary';

  const numEl = document.createElement('span');
  numEl.className = 'acc__num';
  numEl.textContent = num;

  const titleEl = document.createElement('span');
  titleEl.className = 'acc__title';
  titleEl.textContent = title;

  summary.append(numEl, titleEl);

  if (count !== undefined && count !== null) {
    const countEl = document.createElement('span');
    countEl.className = 'acc__count';
    countEl.textContent = String(count);
    summary.append(countEl);
  }

  const glyph = document.createElement('span');
  glyph.className = 'acc__glyph';
  glyph.setAttribute('aria-hidden', 'true');
  summary.append(glyph);

  const body = document.createElement('div');
  body.className = 'acc__body';
  body.append(...children);

  el.append(summary, body);
  if (onToggle) el.addEventListener('toggle', () => onToggle(el.open));
  return el;
}
