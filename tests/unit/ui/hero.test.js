import { describe, it, expect } from 'vitest';
import { renderHero } from '../../../src/ui/hero.js';

const routine = { weekday: 3, focus: 'Shoulder + Calves' };

function tags(el) {
  return [...el.querySelectorAll('.tag__label')].map((n) => n.textContent);
}

describe('renderHero', () => {
  it('shows the weekday name, focus and date label', () => {
    const el = renderHero({ routine, dateLabel: '27 sept 2026', isPreview: false, isOverridden: false });
    expect(el.querySelector('.hero__day').textContent).toBe('Miércoles');
    expect(el.querySelector('.hero__focus').textContent).toBe('Shoulder + Calves');
    expect(el.querySelector('.hero__meta').textContent).toContain('27 sept 2026');
  });

  it('shows "Hoy" when neither preview nor overridden', () => {
    const el = renderHero({ routine, dateLabel: 'x', isPreview: false, isOverridden: false });
    expect(tags(el)).toEqual(['Hoy']);
  });

  it('shows "Cambiado" when overridden but not previewing', () => {
    const el = renderHero({ routine, dateLabel: 'x', isPreview: false, isOverridden: true });
    expect(tags(el)).toEqual(['Cambiado']);
  });

  it('shows "Vista previa" when previewing, even if also overridden', () => {
    const el = renderHero({ routine, dateLabel: 'x', isPreview: true, isOverridden: true });
    expect(tags(el)).toEqual(['Vista previa']);
  });

  it('never shows more than one tag', () => {
    const el = renderHero({ routine, dateLabel: 'x', isPreview: true, isOverridden: false });
    expect(el.querySelectorAll('.tag')).toHaveLength(1);
  });
});
