import './Button.css';

/**
 * @param {object} o
 * @param {string} o.label
 * @param {'primary'|'secondary'|'ghost'} [o.variant]
 * @param {'sm'|'md'} [o.size]
 * @param {(e: MouseEvent) => void} [o.onClick]
 * @param {string} [o.ariaLabel]
 */
export function Button({ label, variant = 'primary', size = 'md', onClick, ariaLabel } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn btn--${variant} btn--${size}`;
  el.textContent = label;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
