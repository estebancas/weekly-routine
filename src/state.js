/** Minimal observable state. `set` notifies subscribers, `patch` does not. */
export function createState(initial) {
  const state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(partial) {
      Object.assign(state, partial);
      for (const l of listeners) l(state);
    },
    patch(partial) {
      Object.assign(state, partial);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
