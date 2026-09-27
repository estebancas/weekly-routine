import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register': new URL('./tests/stubs/pwa-register.js', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.js'] } },
      { extends: true, test: { name: 'integration', include: ['tests/integration/**/*.test.js'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
