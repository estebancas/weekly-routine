import './Input.css';

/**
 * Text input. Not used in phase 1; included so the primitive set is complete.
 * @param {object} o
 * @param {string} [o.value]
 * @param {string} [o.placeholder]
 * @param {string} [o.type]
 * @param {string} [o.name]
 * @param {string} [o.ariaLabel]
 * @param {(value: string, e: Event) => void} [o.onInput]
 */
export function Input({ value = '', placeholder = '', type = 'text', name, ariaLabel, onInput } = {}) {
  const el = document.createElement('input');
  el.className = 'input';
  el.type = type;
  el.value = value;
  el.placeholder = placeholder;
  if (name) el.name = name;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  if (onInput) el.addEventListener('input', (e) => onInput(el.value, e));
  return el;
}
