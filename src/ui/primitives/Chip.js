import './Chip.css';

/**
 * Square selectable chip. States are independent so a chip can be
 * selected + marker, or preview + marker, etc.
 * @param {object} o
 * @param {string} o.label
 * @param {boolean} [o.selected]  filled inverse
 * @param {boolean} [o.preview]   hazard stripes (unconfirmed)
 * @param {boolean} [o.marker]    small accent square (e.g. today)
 * @param {(e: MouseEvent) => void} [o.onClick]
 * @param {string} [o.ariaLabel]
 */
export function Chip({ label, selected = false, preview = false, marker = false, onClick, ariaLabel } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'chip';
  if (selected) el.classList.add('chip--selected');
  if (preview) el.classList.add('chip--preview');
  if (marker) el.classList.add('chip--marker');
  el.setAttribute('aria-pressed', String(selected));
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);

  const span = document.createElement('span');
  span.className = 'chip__label';
  span.textContent = label;
  el.append(span);

  if (onClick) el.addEventListener('click', onClick);
  return el;
}
