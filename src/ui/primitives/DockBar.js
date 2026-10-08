import './DockBar.css';
import { Panel } from './Panel.js';

/**
 * Bar docked to the bottom of the viewport (safe-area aware). The wrapper ignores pointer
 * events so the page stays scrollable around it; the inner panel takes them.
 * @param {object} o
 * @param {Array<Node|string>} [o.children]
 * @param {'none'|'fg'|'accent'|'accent-2'} [o.shadow]
 * @param {string} [o.className]       extra class on the wrapper
 * @param {string} [o.panelClassName]  extra class on the inner panel
 * @param {string} [o.role]
 * @param {string} [o.ariaLabel]
 * @returns {HTMLElement} the wrapper; its `.dock__bar` child is the panel
 */
export function DockBar({ children = [], shadow = 'accent', className = '', panelClassName = '', role, ariaLabel } = {}) {
  const panel = Panel({ shadow, className: ['dock__bar', panelClassName].filter(Boolean).join(' '), children });
  if (role) panel.setAttribute('role', role);
  if (ariaLabel) panel.setAttribute('aria-label', ariaLabel);
  const dock = document.createElement('section');
  dock.className = ['dock', className].filter(Boolean).join(' ');
  dock.append(panel);
  return dock;
}
