import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

/**
 * Boots the real src/main.js in jsdom with a faked clock and a fresh (or shared, via
 * keepDb) in-memory IndexedDB. `main.js`'s own `boot()` call is fire-and-forget, so this
 * waits for the first render before returning.
 */
async function bootApp({ now, override, keepDb = false } = {}) {
  if (!keepDb || !globalThis.indexedDB) globalThis.indexedDB = new IDBFactory();
  document.body.innerHTML = '<main id="app" class="app"></main>';
  history.replaceState(null, '', '/');
  vi.useFakeTimers({ toFake: ['Date'] }); // only Date: fake-indexeddb and vi.waitFor need real timers
  vi.setSystemTime(new Date(now));

  vi.resetModules();
  if (override) {
    const store = await import('../../src/store.js');
    await store.setOverride(override);
    vi.resetModules(); // main.js gets its own fresh module graph, sharing the same indexedDB
  }
  await import('../../src/main.js');
  await vi.waitFor(() => {
    expect(document.querySelector('.hero__day')).toBeTruthy();
  });
}

/** Reads the persisted override through a fresh store.js instance sharing the current indexedDB. */
async function currentOverride() {
  vi.resetModules();
  const store = await import('../../src/store.js');
  return store.getOverride();
}

const app = () => document.getElementById('app');
const heroDay = () => document.querySelector('.hero__day').textContent;
const heroFocus = () => document.querySelector('.hero__focus').textContent;
const heroTag = () => document.querySelector('.hero .tag__label')?.textContent;
const isDocked = () => app().classList.contains('app--docked');
const confirmBar = () => document.querySelector('.confirm');
const detailsList = () => [...document.querySelectorAll('details')];
const chip = (label) =>
  [...document.querySelectorAll('.chip')].find((c) => c.querySelector('.chip__label').textContent === label);

async function toggleDetails(details) {
  details.querySelector('summary').click();
  await new Promise((resolve) => setTimeout(resolve, 0)); // the native `toggle` event is queued as a task
}

/** Clicks Confirmar and waits for the async setOverride()+state.set() to land (the bar undocks). */
async function confirmDay() {
  confirmBar().querySelectorAll('button')[1].click();
  await vi.waitFor(() => {
    expect(isDocked()).toBe(false);
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('boot', () => {
  it('registers the service worker and renders today with no docked bar', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' }); // Tue 10:00 CR
    const { registerSW } = await import('../stubs/pwa-register.js');
    expect(registerSW).toHaveBeenCalledExactlyOnceWith({ immediate: true });

    expect(heroDay()).toBe('Martes');
    expect(heroFocus()).toBe('Chest + Back');
    expect(heroTag()).toBe('Hoy');
    expect(chip('MAR').getAttribute('aria-pressed')).toBe('true');
    expect(chip('MAR').classList.contains('chip--marker')).toBe(true);
    expect(isDocked()).toBe(false);
    expect(confirmBar()).toBeNull();
  });

  it('uses Costa Rica time, not the device timezone, to pick the weekday', async () => {
    // 2026-09-29T03:00Z is 2026-09-28 21:00 in Costa Rica (still Monday).
    await bootApp({ now: '2026-09-29T03:00:00Z' });
    expect(heroDay()).toBe('Lunes');
  });
});

describe('default open section (STRETCH_CUTOFF = 18:30 CR)', () => {
  it('opens Calentamiento just before the cutoff', async () => {
    await bootApp({ now: '2026-09-29T00:29:00Z' }); // Mon 18:29 CR
    const [mobility, exercises, stretch] = detailsList();
    expect(mobility.open).toBe(true);
    expect(exercises.open).toBe(false);
    expect(stretch.open).toBe(false);
  });

  it('opens the night stretch at/after the cutoff', async () => {
    await bootApp({ now: '2026-09-29T00:30:00Z' }); // Mon 18:30 CR
    const [mobility, exercises, stretch] = detailsList();
    expect(mobility.open).toBe(false);
    expect(exercises.open).toBe(false);
    expect(stretch.open).toBe(true);
  });
});

describe('weekend', () => {
  it('renders the Saturday cycling block with no accordions', async () => {
    await bootApp({ now: '2026-10-03T18:00:00Z' }); // Sat 12:00 CR
    expect(heroDay()).toBe('Sábado');
    expect(document.querySelector('.weekend__title').textContent).toBe('Ciclismo');
    expect(detailsList()).toHaveLength(0);
  });

  it('renders the Sunday rest block', async () => {
    await bootApp({ now: '2026-10-04T18:00:00Z' }); // Sun 12:00 CR
    expect(heroDay()).toBe('Domingo');
    expect(document.querySelector('.weekend__title').textContent).toBe('Descanso');
  });
});

describe('preview flow', () => {
  it('picking another day shows the preview tag, docks the confirm bar, and keeps the real selection marked', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' }); // Tue, selected = Tue
    chip('JUE').click();

    expect(heroDay()).toBe('Jueves');
    expect(heroTag()).toBe('Vista previa');
    expect(isDocked()).toBe(true);
    expect(confirmBar().querySelector('.confirm__question').textContent).toBe('¿Usar Jueves como rutina de hoy?');
    expect(chip('MAR').getAttribute('aria-pressed')).toBe('true'); // still the selected day
    expect(chip('JUE').classList.contains('chip--preview')).toBe(true);
  });

  it('re-picking the selected day ends the preview without a click on Volver', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' });
    chip('JUE').click();
    chip('MAR').click();
    expect(heroTag()).toBe('Hoy');
    expect(isDocked()).toBe(false);
  });

  it('Volver returns to the selected day and writes nothing to storage', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' });
    chip('JUE').click();
    confirmBar().querySelectorAll('button')[0].click(); // Volver

    expect(heroDay()).toBe('Martes');
    expect(isDocked()).toBe(false);
    expect(confirmBar()).toBeNull();
    expect(await currentOverride()).toBeUndefined();
  });
});

describe('confirm flow', () => {
  it('Confirmar persists the override and shows the changed state', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' }); // Tue
    chip('JUE').click();
    await confirmDay(); // Confirmar

    expect(await currentOverride()).toEqual({ dateKey: '2026-09-29', weekday: 4 });
    expect(heroDay()).toBe('Jueves');
    expect(heroTag()).toBe('Cambiado');
    expect(chip('JUE').getAttribute('aria-pressed')).toBe('true');
    expect(chip('MAR').classList.contains('chip--marker')).toBe(true); // today's marker never moves
    expect(isDocked()).toBe(false);
  });

  it('survives a reload on the same Costa Rica day', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z', keepDb: true });
    chip('JUE').click();
    await confirmDay();

    await bootApp({ now: '2026-09-29T20:00:00Z', keepDb: true }); // later the same CR day
    expect(heroDay()).toBe('Jueves');
    expect(heroTag()).toBe('Cambiado');
  });

  it('a reload without confirming shows today again, not the abandoned preview', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z', keepDb: true });
    chip('JUE').click(); // preview only, never confirmed

    await bootApp({ now: '2026-09-29T20:00:00Z', keepDb: true });
    expect(heroDay()).toBe('Martes');
    expect(heroTag()).toBe('Hoy');
  });

  it('drops a stale override from a previous Costa Rica day on boot', async () => {
    await bootApp({
      now: '2026-09-29T16:00:00Z', // today is 2026-09-29
      override: { dateKey: '2026-09-28', weekday: 4 }, // saved yesterday
    });
    expect(heroDay()).toBe('Martes'); // today's real weekday, override ignored
    await vi.waitFor(async () => {
      expect(await currentOverride()).toBeUndefined(); // and cleaned up
    });
  });

  it('drops an override confirmed late at night once the Costa Rica day rolls over', async () => {
    await bootApp({ now: '2026-09-30T05:50:00Z', keepDb: true }); // Tue 23:50 CR
    chip('JUE').click();
    await confirmDay();
    expect(await currentOverride()).toEqual({ dateKey: '2026-09-29', weekday: 4 });

    await bootApp({ now: '2026-09-30T06:05:00Z', keepDb: true }); // Wed 00:05 CR, next CR day
    expect(heroDay()).toBe('Miércoles'); // today's real weekday, not the stale override
    await vi.waitFor(async () => {
      expect(await currentOverride()).toBeUndefined();
    });
  });

  it('confirming from the weekend into a weekday renders the weekday sections', async () => {
    await bootApp({ now: '2026-10-03T18:00:00Z' }); // Sat
    chip('LUN').click();
    await confirmDay();

    expect(heroDay()).toBe('Lunes');
    expect(heroTag()).toBe('Cambiado');
    expect(detailsList()).toHaveLength(3);
  });
});

describe('open-section state (patch vs. set)', () => {
  it('toggling a section patches state without a full re-render (DOM node identity is kept)', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' });
    const exercisesBefore = detailsList()[1];
    await toggleDetails(exercisesBefore);
    expect(document.querySelectorAll('details')[1]).toBe(exercisesBefore); // same node, not rebuilt
    expect(exercisesBefore.open).toBe(true);
  });

  it('an unrelated re-render (picking a day) keeps the open section open', async () => {
    await bootApp({ now: '2026-09-29T16:00:00Z' });
    await toggleDetails(detailsList()[1]); // open Ejercicios
    chip('JUE').click(); // triggers state.set -> full re-render

    const exercisesAfter = detailsList()[1];
    expect(exercisesAfter.open).toBe(true);
  });
});

describe('storage unavailable', () => {
  it('still boots on today and lets the user confirm a day in memory', async () => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    vi.doMock('idb', () => ({ openDB: () => Promise.reject(new Error('unavailable')) }));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-29T16:00:00Z'));
    document.body.innerHTML = '<main id="app" class="app"></main>';

    await import('../../src/main.js');
    await vi.waitFor(() => {
      expect(document.querySelector('.hero__day')).toBeTruthy();
    });
    expect(heroDay()).toBe('Martes');

    chip('JUE').click();
    await confirmDay();
    expect(heroDay()).toBe('Jueves');
    expect(heroTag()).toBe('Cambiado');

    vi.doUnmock('idb');
  });
});
