import { describe, it, expect, vi } from 'vitest';
import { renderDayStrip } from '../../../src/ui/dayStrip.js';
import { DAY_SHORT } from '../../../src/config.js';

describe('renderDayStrip', () => {
  it('renders 7 chips, Monday first and Sunday last, labeled with DAY_SHORT', () => {
    const el = renderDayStrip({ today: 1, selected: 1, preview: 1, onPick: () => {} });
    const chips = el.querySelectorAll('.chip');
    expect(chips).toHaveLength(7);
    const labels = [...chips].map((c) => c.querySelector('.chip__label').textContent);
    expect(labels).toEqual(['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']);
  });

  it('sets an aria-label per chip using the full day name', () => {
    const el = renderDayStrip({ today: 1, selected: 1, preview: 1, onPick: () => {} });
    const lun = el.querySelector('.chip');
    expect(lun.getAttribute('aria-label')).toBe('Ver rutina de Lunes');
  });

  it('marks exactly the selected chip as pressed', () => {
    const el = renderDayStrip({ today: 1, selected: 3, preview: 3, onPick: () => {} });
    const pressed = [...el.querySelectorAll('.chip')].filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0].querySelector('.chip__label').textContent).toBe(DAY_SHORT[3]);
  });

  it('flags the preview chip only when preview differs from selected', () => {
    const el = renderDayStrip({ today: 1, selected: 1, preview: 4, onPick: () => {} });
    const previewed = [...el.querySelectorAll('.chip')].filter((c) => c.classList.contains('chip--preview'));
    expect(previewed).toHaveLength(1);
    expect(previewed[0].querySelector('.chip__label').textContent).toBe(DAY_SHORT[4]);
  });

  it('does not flag any chip as preview when preview equals selected', () => {
    const el = renderDayStrip({ today: 1, selected: 2, preview: 2, onPick: () => {} });
    expect(el.querySelectorAll('.chip--preview')).toHaveLength(0);
  });

  it('marks the "today" chip regardless of selection', () => {
    const el = renderDayStrip({ today: 5, selected: 1, preview: 1, onPick: () => {} });
    const marked = [...el.querySelectorAll('.chip')].filter((c) => c.classList.contains('chip--marker'));
    expect(marked).toHaveLength(1);
    expect(marked[0].querySelector('.chip__label').textContent).toBe(DAY_SHORT[5]);
  });

  it('calls onPick with the clicked weekday index', () => {
    const onPick = vi.fn();
    const el = renderDayStrip({ today: 1, selected: 1, preview: 1, onPick });
    const jue = [...el.querySelectorAll('.chip')].find((c) => c.querySelector('.chip__label').textContent === 'JUE');
    jue.click();
    expect(onPick).toHaveBeenCalledExactlyOnceWith(4);
  });

  it('has a nav landmark with a Spanish aria-label', () => {
    const el = renderDayStrip({ today: 1, selected: 1, preview: 1, onPick: () => {} });
    expect(el.tagName).toBe('NAV');
    expect(el.getAttribute('aria-label')).toBe('Días de la semana');
  });
});
