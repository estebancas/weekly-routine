import { describe, it, expect, vi } from 'vitest';
import { createState } from '../../src/state.js';

describe('createState', () => {
  it('get() reflects the initial values and mutating the original object does not leak in', () => {
    const initial = { a: 1 };
    const state = createState(initial);
    initial.a = 999;
    expect(state.get()).toEqual({ a: 1 });
  });

  it('get() returns the same live object across calls', () => {
    const state = createState({ a: 1 });
    expect(state.get()).toBe(state.get());
  });

  it('set() shallow-merges into the state', () => {
    const state = createState({ a: 1, b: 2 });
    state.set({ b: 3 });
    expect(state.get()).toEqual({ a: 1, b: 3 });
  });

  it('set() notifies every subscribed listener synchronously with the updated state', () => {
    const state = createState({ a: 1 });
    const l1 = vi.fn();
    const l2 = vi.fn();
    state.subscribe(l1);
    state.subscribe(l2);
    state.set({ a: 2 });
    expect(l1).toHaveBeenCalledExactlyOnceWith(state.get());
    expect(l2).toHaveBeenCalledExactlyOnceWith(state.get());
    expect(state.get().a).toBe(2);
  });

  it('patch() merges into the state without notifying listeners', () => {
    const state = createState({ a: 1 });
    const listener = vi.fn();
    state.subscribe(listener);
    state.patch({ a: 2 });
    expect(state.get()).toEqual({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe() dedupes the same listener reference', () => {
    const state = createState({ a: 1 });
    const listener = vi.fn();
    state.subscribe(listener);
    state.subscribe(listener);
    state.set({ a: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('the unsubscribe function returned by subscribe() stops further notifications', () => {
    const state = createState({ a: 1 });
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);
    unsubscribe();
    state.set({ a: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});
