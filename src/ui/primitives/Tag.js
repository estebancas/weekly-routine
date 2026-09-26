import './Tag.css';

/**
 * Small uppercase label.
 * @param {object} o
 * @param {string} o.label
 * @param {'outline'|'accent'|'accent-2'|'inverse'|'hazard'} [o.variant]
 */
export function Tag({ label, variant = 'outline' } = {}) {
  const el = document.createElement('span');
  el.className = `tag tag--${variant}`;
  const inner = document.createElement('span');
  inner.className = 'tag__label';
  inner.textContent = label;
  el.append(inner);
  return el;
}
