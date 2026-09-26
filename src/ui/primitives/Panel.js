import './Panel.css';

/**
 * Bordered container.
 * @param {object} o
 * @param {'none'|'fg'|'accent'|'accent-2'} [o.shadow]
 * @param {boolean} [o.thin]
 * @param {string} [o.className]
 * @param {Array<Node|string>} [o.children]
 * @param {string} [o.as]  element tag, defaults to div
 */
export function Panel({ shadow = 'none', thin = false, className = '', children = [], as = 'div' } = {}) {
  const el = document.createElement(as);
  el.className = ['panel', thin ? 'panel--thin' : '', shadow !== 'none' ? `panel--shadow-${shadow}` : '', className]
    .filter(Boolean)
    .join(' ');
  el.append(...children);
  return el;
}
