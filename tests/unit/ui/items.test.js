import { describe, it, expect, vi, afterEach } from 'vitest';
import { youtubeWebUrl, youtubeAppUrl } from '../../../src/youtube.js';
import { renderItem, renderExerciseGroup, renderWeekend } from '../../../src/ui/items.js';

vi.mock('../../../src/config.js', async (importOriginal) => ({
  ...(await importOriginal()),
  COPY_FEEDBACK_MS: 80,
  YOUTUBE_FALLBACK_MS: 5,
}));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile';

function stubNavigator({ userAgent = 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints = 0, clipboard } = {}) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints, clipboard });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

describe('name actions (search video + copy)', () => {
  const group = (name) => ({ letter: 'A', superset: false, items: [{ ...baseItem, group: 'A', name }] });
  const cases = [
    ['renderItem', (name) => renderItem({ ...baseItem, name })],
    ['renderExerciseGroup (single)', (name) => renderExerciseGroup(group(name))],
    [
      'renderExerciseGroup (superset)',
      (name) =>
        renderExerciseGroup({
          letter: 'A',
          superset: true,
          items: [
            { ...baseItem, group: 'A1', name },
            { ...baseItem, group: 'A2', name: 'Otro' },
          ],
        }),
    ],
  ];

  describe.each(cases)('%s', (_label, render) => {
    it('puts a search link and a copy button next to the name, labelled with the exercise', () => {
      stubNavigator();
      const el = render('Press & Remo');
      const actions = el.querySelector('.item__actions');
      expect(actions).not.toBeNull();
      const link = actions.querySelector('a');
      expect(link.getAttribute('aria-label')).toBe('Buscar video de Press & Remo');
      expect(link.getAttribute('href')).toBe(youtubeWebUrl('Press & Remo'));
      expect(link.target).toBe('_blank');
      const btn = actions.querySelector('button');
      expect(btn.getAttribute('aria-label')).toBe('Copiar nombre de Press & Remo');
      expect(actions.querySelector('[aria-live="polite"]')).not.toBeNull();
    });

    it('uses the YouTube intent URL as the link on Android', () => {
      stubNavigator({ userAgent: ANDROID, maxTouchPoints: 5 });
      const link = render('Remo').querySelector('.item__actions a');
      expect(link.getAttribute('href')).toBe(youtubeAppUrl('Remo', 'android'));
    });

    it('on iOS, a tap cancels the default and launches the youtube:// scheme', async () => {
      stubNavigator({ userAgent: IPHONE, maxTouchPoints: 5 });
      const link = render('Remo').querySelector('.item__actions a');
      const hrefSetter = vi.fn();
      const loc = {};
      Object.defineProperty(loc, 'href', { set: hrefSetter, get: () => '' });
      vi.stubGlobal('location', loc);
      const open = vi.spyOn(window, 'open').mockImplementation(() => null); // the delayed web fallback
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(evt);
      expect(evt.defaultPrevented).toBe(true);
      expect(hrefSetter).toHaveBeenCalledWith(youtubeAppUrl('Remo', 'ios'));
      await vi.waitFor(() => expect(open).toHaveBeenCalled()); // let the fallback fire inside the test
    });
  });

  describe('copy', () => {
    it('writes the name to the clipboard, swaps to a check with a live announcement, then reverts', async () => {
      const writeText = vi.fn().mockResolvedValue();
      stubNavigator({ clipboard: { writeText } });
      const el = renderItem({ ...baseItem, name: 'Sentadilla' });
      const btn = el.querySelector('.item__actions button');
      const live = el.querySelector('[aria-live]');
      const before = btn.innerHTML;
      btn.click();
      expect(writeText).toHaveBeenCalledWith('Sentadilla');
      await new Promise((r) => setTimeout(r, 0));
      expect(live.textContent).toBe('Copiado');
      expect(btn.innerHTML).not.toBe(before);
      expect(btn.classList.contains('icon-btn--done')).toBe(true);
      await vi.waitFor(() => expect(live.textContent).toBe(''));
      expect(btn.innerHTML).toBe(before);
      expect(btn.classList.contains('icon-btn--done')).toBe(false);
    });

    it('fails quietly when the clipboard API is missing', async () => {
      stubNavigator({ clipboard: undefined });
      const el = renderItem({ ...baseItem, name: 'Sentadilla' });
      const btn = el.querySelector('.item__actions button');
      const before = btn.innerHTML;
      expect(() => btn.click()).not.toThrow();
      await new Promise((r) => setTimeout(r, 0));
      expect(btn.innerHTML).toBe(before);
      expect(el.querySelector('[aria-live]').textContent).toBe('');
    });

    it('fails quietly when writeText rejects', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      stubNavigator({ clipboard: { writeText } });
      const el = renderItem({ ...baseItem, name: 'Sentadilla' });
      const btn = el.querySelector('.item__actions button');
      const before = btn.innerHTML;
      btn.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(btn.innerHTML).toBe(before);
      expect(el.querySelector('[aria-live]').textContent).toBe('');
    });

    it('a second tap during feedback restarts the revert timer instead of reverting early', async () => {
      const writeText = vi.fn().mockResolvedValue();
      stubNavigator({ clipboard: { writeText } });
      const el = renderItem({ ...baseItem, name: 'Sentadilla' });
      const btn = el.querySelector('.item__actions button');
      const live = el.querySelector('[aria-live]');
      btn.click();
      await new Promise((r) => setTimeout(r, 50));
      expect(live.textContent).toBe('Copiado');
      btn.click();
      await new Promise((r) => setTimeout(r, 50)); // 100ms since the first tap > 80ms
      expect(live.textContent).toBe('Copiado');
      await vi.waitFor(() => expect(live.textContent).toBe(''));
    });
  });
});

describe('timer button', () => {
  const timed = { ...baseItem, name: 'Plancha', setsReps: '3x 45 segundos', extra: [] };

  it('is absent without an onTimer handler', () => {
    expect(renderItem(timed).querySelector('button[aria-label^="Iniciar temporizador"]')).toBeNull();
  });

  it('starts the parsed timer for a mobility/stretch item', () => {
    const onTimer = vi.fn();
    const el = renderItem(timed, onTimer);
    el.querySelector('button[aria-label="Iniciar temporizador de Plancha"]').click();
    expect(onTimer).toHaveBeenCalledWith('Plancha', { kind: 'hold', seconds: 45, rounds: 3, sides: 1 });
  });

  it('is on exercises and supersets, using rest notes', () => {
    const onTimer = vi.fn();
    const item = { ...baseItem, group: 'A1', name: 'Remo', setsReps: '3x10', extra: ['Descanso de 90 segundos'] };
    const single = renderExerciseGroup({ superset: false, items: [item] }, onTimer);
    single.querySelector('button[aria-label="Iniciar temporizador de Remo"]').click();
    expect(onTimer).toHaveBeenLastCalledWith('Remo', { kind: 'rest', seconds: 90, rounds: 1, sides: 1 });

    const sup = renderExerciseGroup({ superset: true, letter: 'A', items: [item, { ...item, name: 'Press' }] }, onTimer);
    expect(sup.querySelectorAll('button[aria-label^="Iniciar temporizador"]')).toHaveLength(2);
  });
});
