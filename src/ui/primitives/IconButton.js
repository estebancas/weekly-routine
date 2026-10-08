import './IconButton.css';

/**
 * Square icon-only control. An `<a>` (opens in a new tab) when `href` is given,
 * otherwise a `<button>`.
 * @param {object} o
 * @param {SVGElement} o.icon
 * @param {string} o.ariaLabel
 * @param {'primary'|'secondary'} [o.variant]
 * @param {string} [o.href]
 * @param {(e: MouseEvent) => void} [o.onClick]
 */
export function IconButton({ icon, ariaLabel, variant = 'secondary', href, onClick } = {}) {
  let el;
  if (href) {
    el = document.createElement('a');
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  } else {
    el = document.createElement('button');
    el.type = 'button';
  }
  el.className = `icon-btn icon-btn--${variant}`;
  el.setAttribute('aria-label', ariaLabel);
  el.append(icon);
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
