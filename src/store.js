import { openDB } from 'idb';

const DB_NAME = 'weekly-routine';
const DB_VERSION = 1;
const PREFS = 'prefs';
const OVERRIDE_KEY = 'override';

let dbPromise;

function db() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(PREFS)) database.createObjectStore(PREFS);
    },
  });
  return dbPromise;
}

/** @returns {Promise<{ dateKey: string, weekday: number } | undefined>} */
export async function getOverride() {
  try {
    return await (await db()).get(PREFS, OVERRIDE_KEY);
  } catch {
    return undefined;
  }
}

/** @param {{ dateKey: string, weekday: number }} value */
export async function setOverride(value) {
  try {
    await (await db()).put(PREFS, value, OVERRIDE_KEY);
  } catch {
    /* storage unavailable: the app still works, the override just won't survive a reload */
  }
}

export async function clearOverride() {
  try {
    await (await db()).delete(PREFS, OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Ask the browser not to evict our storage. Safari grants this for home screen apps. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
