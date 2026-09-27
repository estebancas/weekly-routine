import { describe, it, expect, vi } from 'vitest';
import { renderSections } from '../../../src/ui/sections.js';
import { getRoutine } from '../../../src/routine.js';
import { SECTIONS } from '../../../src/config.js';

describe('renderSections — weekend', () => {
  it('renders a single panel with no accordions', () => {
    const el = renderSections({
      routine: { weekend: true, focus: 'Ciclismo', note: 'x' },
      openSections: {},
      onToggle: () => {},
    });
    expect(el.querySelectorAll('details')).toHaveLength(0);
    expect(el.querySelector('.weekend')).not.toBeNull();
    expect(el.textContent).toContain('Ciclismo');
  });
});

describe('renderSections — weekday', () => {
  const routine = getRoutine(1); // Monday, real data

  it('renders one <details> per SECTIONS entry, in order, numbered and titled', () => {
    const el = renderSections({ routine, openSections: {}, onToggle: () => {} });
    const detailsEls = el.querySelectorAll('details');
    expect(detailsEls).toHaveLength(SECTIONS.length);
    detailsEls.forEach((d, i) => {
      expect(d.querySelector('.acc__num').textContent).toBe(SECTIONS[i].num);
      expect(d.querySelector('.acc__title').textContent).toBe(SECTIONS[i].title);
    });
  });

  it('counts exercises by flattened item, not by superset group', () => {
    const el = renderSections({ routine, openSections: {}, onToggle: () => {} });
    const exercisesDetails = el.querySelectorAll('details')[1];
    const expectedCount = routine.exercises.reduce((n, g) => n + g.items.length, 0);
    expect(exercisesDetails.querySelector('.acc__count').textContent).toBe(String(expectedCount));
    expect(expectedCount).not.toBe(routine.exercises.length); // Monday has real supersets
  });

  it('treats a routine missing a section key as an empty (0-count) section', () => {
    const el = renderSections({ routine: { weekend: false, focus: 'x' }, openSections: {}, onToggle: () => {} });
    const [mobility, exercises, stretch] = el.querySelectorAll('details');
    for (const d of [mobility, exercises, stretch]) {
      expect(d.querySelector('.acc__count').textContent).toBe('0');
      expect(d.querySelector('.items').children).toHaveLength(0);
    }
  });

  it('reflects openSections per key, treating a missing key as closed', () => {
    const el = renderSections({ routine, openSections: { mobility: true }, onToggle: () => {} });
    const [mobility, exercises, stretch] = el.querySelectorAll('details');
    expect(mobility.open).toBe(true);
    expect(exercises.open).toBe(false);
    expect(stretch.open).toBe(false);
  });

  it('calls onToggle(key, open) when a section is toggled', async () => {
    const onToggle = vi.fn();
    const el = renderSections({ routine, openSections: {}, onToggle });
    document.body.append(el);
    const mobility = el.querySelectorAll('details')[0];
    mobility.querySelector('summary').click();
    await new Promise((resolve) => setTimeout(resolve, 0)); // toggle event is queued as a task
    expect(onToggle).toHaveBeenCalledExactlyOnceWith('mobility', true);
  });
});
