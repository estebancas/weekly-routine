import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist',
      'dev-dist',
      '.wrangler',
      'coverage',
      'playwright-report',
      'test-results',
      'public',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['e2e/**/*.js', '*.config.js', 'pwa-assets.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
