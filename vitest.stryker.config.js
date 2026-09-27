import { defineConfig } from 'vitest/config';

/**
 * @stryker-mutator/vitest-runner crashes (circular JSON in resolvedProjects/viteConfig)
 * against vitest.config.js's `test.projects`. This flat config covers the same tests
 * without that field, for Stryker's use only — npm test still uses vitest.config.js.
 */
export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register': new URL('./tests/stubs/pwa-register.js', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
});
