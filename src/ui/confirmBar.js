import { DAY_NAMES, LABELS } from '../config.js';
import { Button, Panel } from './primitives/index.js';

/**
 * @param {object} o
 * @param {number} o.weekday
 * @param {() => void} o.onConfirm
 * @param {() => void} o.onBack
 */
export function renderConfirmBar({ weekday, onConfirm, onBack }) {
  const question = document.createElement('p');
  question.className = 'confirm__question';
  question.textContent = LABELS.confirmQuestion(DAY_NAMES[weekday]);

  const actions = document.createElement('div');
  actions.className = 'confirm__actions';
  actions.append(
    Button({ label: LABELS.back, variant: 'secondary', onClick: onBack }),
    Button({ label: LABELS.confirm, variant: 'primary', onClick: onConfirm }),
  );

  return Panel({ shadow: 'accent', className: 'confirm', children: [question, actions], as: 'section' });
}
