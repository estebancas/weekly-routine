import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';

/**
 * store.js memoizes its DB connection at module scope (`dbPromise`), so each test gets a
 * fresh module instance plus a fresh in-memory IndexedDB, otherwise state leaks between tests.
 */
async function freshStore() {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  vi.doUnmock('idb');
  return import('../../src/store.js');
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('store: getOverride / setOverride / clearOverride', () => {
  it('getOverride() resolves undefined when nothing was ever set', async () => {
    const { getOverride } = await freshStore();
    expect(await getOverride()).toBeUndefined();
  });

  it('setOverride() then getOverride() round-trips the value', async () => {
    const { getOverride, setOverride } = await freshStore();
    const value = { dateKey: '2026-09-29', weekday: 4 };
    await setOverride(value);
    expect(await getOverride()).toEqual(value);
  });

  it('setOverride() overwrites a previous value', async () => {
    const { getOverride, setOverride } = await freshStore();
    await setOverride({ dateKey: '2026-09-29', weekday: 4 });
    await setOverride({ dateKey: '2026-09-30', weekday: 5 });
    expect(await getOverride()).toEqual({ dateKey: '2026-09-30', weekday: 5 });
  });

  it('clearOverride() removes a stored value', async () => {
    const { getOverride, setOverride, clearOverride } = await freshStore();
    await setOverride({ dateKey: '2026-09-29', weekday: 4 });
    await clearOverride();
    expect(await getOverride()).toBeUndefined();
  });

  it('clearOverride() is a no-op when nothing is stored', async () => {
    const { getOverride, clearOverride } = await freshStore();
    await expect(clearOverride()).resolves.toBeUndefined();
    expect(await getOverride()).toBeUndefined();
  });

  it('persists across a fresh module instance sharing the same underlying IndexedDB', async () => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    const first = await import('../../src/store.js');
    await first.setOverride({ dateKey: '2026-09-29', weekday: 4 });

    vi.resetModules(); // new store.js module instance, same globalThis.indexedDB
    const second = await import('../../src/store.js');
    expect(await second.getOverride()).toEqual({ dateKey: '2026-09-29', weekday: 4 });
  });

  it('writes to the exact store/key the app relies on ("prefs" / "override")', async () => {
    const { setOverride } = await freshStore();
    const value = { dateKey: '2026-09-29', weekday: 4 };
    await setOverride(value);

    // Read back through a completely separate idb connection to pin down the on-disk contract.
    const db = await openDB('weekly-routine', 1);
    expect(await db.get('prefs', 'override')).toEqual(value);
    db.close();
  });
});

describe('store: openDB is memoized', () => {
  it('opens the database once even across multiple operations', async () => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
    const idbActual = await vi.importActual('idb');
    const openDBSpy = vi.fn(idbActual.openDB);
    vi.doMock('idb', () => ({ ...idbActual, openDB: openDBSpy }));

    const { getOverride, setOverride, clearOverride } = await import('../../src/store.js');
    await getOverride();
    await setOverride({ dateKey: '2026-09-29', weekday: 4 });
    await getOverride();
    await clearOverride();

    expect(openDBSpy).toHaveBeenCalledTimes(1);
    vi.doUnmock('idb');
  });
});

describe('store: storage unavailable', () => {
  async function storeWithFailingDb() {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
    vi.doMock('idb', () => ({ openDB: () => Promise.reject(new Error('unavailable')) }));
    const mod = await import('../../src/store.js');
    return mod;
  }

  it('getOverride() resolves undefined instead of throwing', async () => {
    const { getOverride } = await storeWithFailingDb();
    await expect(getOverride()).resolves.toBeUndefined();
    vi.doUnmock('idb');
  });

  it('setOverride() and clearOverride() resolve without throwing', async () => {
    const { setOverride, clearOverride } = await storeWithFailingDb();
    await expect(setOverride({ dateKey: '2026-09-29', weekday: 4 })).resolves.toBeUndefined();
    await expect(clearOverride()).resolves.toBeUndefined();
    vi.doUnmock('idb');
  });
});

describe('requestPersistence', () => {
  it('returns false when navigator.storage.persist is unavailable', async () => {
    const { requestPersistence } = await freshStore();
    vi.stubGlobal('navigator', {});
    expect(await requestPersistence()).toBe(false);
  });

  it('passes through the resolved value of navigator.storage.persist()', async () => {
    const { requestPersistence } = await freshStore();
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockResolvedValue(true) } });
    expect(await requestPersistence()).toBe(true);
  });

  it('returns false when navigator.storage.persist() throws', async () => {
    const { requestPersistence } = await freshStore();
    vi.stubGlobal('navigator', {
      storage: {
        persist: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });
    expect(await requestPersistence()).toBe(false);
  });
});
