import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  history.replaceState(null, '', '/');
});
