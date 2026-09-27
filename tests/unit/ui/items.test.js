import { describe, it, expect } from 'vitest';
import { renderItem, renderExerciseGroup, renderWeekend } from '../../../src/ui/items.js';

const baseItem = { group: '', name: 'CARs de cadera', description: '', setsReps: '', extra: [] };

describe('renderItem', () => {
  it('renders the name only when reps/description/extra are absent', () => {
    const el = renderItem(baseItem);
    expect(el.querySelector('.item__name').textContent).toBe('CARs de cadera');
    expect(el.querySelector('.item__reps')).toBeNull();
    expect(el.querySelector('.item__desc')).toBeNull();
    expect(el.querySelector('.item__notes')).toBeNull();
  });

  it('renders reps, description and notes when present', () => {
    const el = renderItem({
      ...baseItem,
      setsReps: '5 minutos',
      description: 'Revertir acortamiento',
      extra: ['nota uno', 'nota dos'],
    });
    expect(el.querySelector('.item__reps').textContent).toBe('5 minutos');
    expect(el.querySelector('.item__desc').textContent).toBe('Revertir acortamiento');
    const notes = [...el.querySelectorAll('.item__notes li')].map((n) => n.textContent);
    expect(notes).toEqual(['nota uno', 'nota dos']);
  });
});

describe('renderExerciseGroup', () => {
  it('renders a non-superset group as a single .exercise labeled by its raw group letter', () => {
    const group = { letter: 'A', superset: false, items: [{ ...baseItem, group: 'A', name: 'Sentadilla' }] };
    const el = renderExerciseGroup(group);
    expect(el.classList.contains('exercise')).toBe(true);
    expect(el.querySelector('.exercise__letter').textContent).toBe('A');
    expect(el.querySelector('.item__name').textContent).toBe('Sentadilla');
  });

  it('renders a superset with a tag and a divider between each item', () => {
    const group = {
      letter: 'A',
      superset: true,
      items: [
        { ...baseItem, group: 'A1', name: 'Press banca' },
        { ...baseItem, group: 'A2', name: 'Remo' },
        { ...baseItem, group: 'A3', name: 'Curl' },
      ],
    };
    const el = renderExerciseGroup(group);
    expect(el.classList.contains('superset')).toBe(true);
    expect(el.querySelector('.tag__label').textContent).toBe('Superserie A');
    expect(el.querySelectorAll('.superset__divider')).toHaveLength(2); // n-1 dividers
    const names = [...el.querySelectorAll('.item__name')].map((n) => n.textContent);
    expect(names).toEqual(['Press banca', 'Remo', 'Curl']);
  });
});

describe('renderWeekend', () => {
  it('renders the stripe, title and note when present', () => {
    const el = renderWeekend({ focus: 'Ciclismo', note: 'Día de bici. Sin rutina de fuerza.' });
    expect(el.querySelector('.weekend__stripe')).not.toBeNull();
    expect(el.querySelector('.weekend__title').textContent).toBe('Ciclismo');
    expect(el.textContent).toContain('Día de bici. Sin rutina de fuerza.');
  });

  it('omits the note paragraph when there is none', () => {
    const el = renderWeekend({ focus: 'Descanso', note: '' });
    expect(el.children).toHaveLength(2); // stripe + title only
  });
});
