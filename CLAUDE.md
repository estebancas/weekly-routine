@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal, view-only PWA (Spanish UI) that shows the workout routine for the current day. Vanilla JS with no framework, built with Vite + `vite-plugin-pwa`, deployed as static assets on a Cloudflare Worker (`weekly-routine.estcascor94.workers.dev`).

## Commands

```
npm run dev               # Vite dev server
npm run build             # production build to dist/
npm run preview           # serve dist/ locally (also what e2e will target on :4173)
npm run deploy            # vite build && wrangler deploy
npm run generate-icons    # regenerate public/*.png from public/icon.svg (pwa-assets.config.js)
npm run lint              # ESLint (flat config) over src/, tests/, e2e/, and root config files
npm test                  # Vitest (unit + integration) with a v8 coverage gate
npm run test:unit         # just tests/unit
npm run test:integration  # just tests/integration
npm run test:watch        # Vitest in watch mode
npm run mutate            # Stryker mutation testing over src/**/*.js
npm run size              # size-limit budgets over dist/ (run `npm run build` first)
npm run e2e               # Playwright against a production build (run `npm run build` first)
```

`eslint.config.js` is a flat config with `js.configs.recommended`, browser globals for `src/**`, browser+node globals for `tests/**`, and node globals for `e2e/**` and root config files. `.github/workflows/ci.yml` runs lint + build + test + mutation testing + bundle-size + e2e on every push and PR, and deploys to Cloudflare from `main` only after manual approval on the `production` GitHub environment. `CI-CD.md` documents the CI/CD setup.

**Bundle size.** `.size-limit.json` budgets the built output in three groups: JS and CSS measured brotli-compressed (matching what Cloudflare actually serves), and the self-hosted `@fontsource` `.woff2` files measured raw (already compressed, so brotli/gzip barely helps and would understate their real transfer cost). Each limit is today's measured size plus ~10%. `npm run size` needs `dist/` already built; CI's `size` job downloads the `test` job's `dist` artifact rather than rebuilding.

**Tests.** `tests/unit/**` covers each module in isolation, mirroring `src/`'s layout; `tests/integration/app.test.js` boots the real `src/main.js` in jsdom and drives it through clicks, asserting on the rendered DOM. `vitest.config.js` defines both as Vitest projects, `tests/setup.js` loads `fake-indexeddb/auto` and resets DOM/env/mocks after each test, and `tests/stubs/pwa-register.js` stands in for the `virtual:pwa-register` module Vite generates at build time. `npm test` enforces a 90% v8 coverage threshold (lines/branches/functions/statements) over `src/**/*.js`.

Conventions worth keeping when adding Vitest tests: fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`), never the timer queue — `fake-indexeddb` and `vi.waitFor` need real timers to settle. `store.js` and `routine.js` hold module-level state (`dbPromise`, the routine cache), so integration tests `vi.resetModules()` and re-`import()` for a clean slate, with a fresh `new IDBFactory()` per boot unless deliberately reusing one (e.g. reload-across-days tests). The native `<details>` `toggle` event fires as a queued task, not synchronously and not a microtask — await a `setTimeout(…, 0)` (or `vi.waitFor`) after a summary click before asserting on it.

`e2e/**` (Playwright, config at `playwright.config.js`) runs a full browser against `vite preview` on `:4173` — it needs `dist/` already built (CI reuses the `test` job's artifact; locally run `npm run build` first, or leave a `npm run preview` open for `reuseExistingServer`). It exists to cover what jsdom can't: a real service worker, an offline reload, and the actual manifest response. `e2e/helpers.js` has the shared `gotoAt`/locator helpers.

**Mutation testing.** `stryker.config.json` runs Stryker against `src/**/*.js` with `coverageAnalysis: "perTest"` and a `vitest.stryker.config.js` config — a flat (non-`projects`) Vitest config Stryker needs, since its Vitest 5 test-name-separator fix (patched locally, see below) is otherwise unrelated to the `projects` field. `vitest.related` is set to `false` so every mutant runs against the full suite rather than relying on Vitest's related-file inference. `npm run mutate` enforces a `thresholds.break` of 85 (current baseline: ~90%). `reports/mutation/mutation.html` has the full breakdown. One mutant in `Details.js` (the `if (onToggle)` guard) reliably crashes the Vitest child process instead of resolving to Killed/Survived — an async DOM `toggle` event throwing into an object Stryker's own error formatter can't stringify — and is an accepted infra quirk, not a real gap (`primitives.test.js` has a dedicated unit test for that exact guard). **Patched dependency:** `@stryker-mutator/vitest-runner@10.0.0` doesn't work with Vitest 5 out of the box (upstream bug, [stryker-js#6210](https://github.com/stryker-mutator/stryker-js/issues/6210): Vitest 5 joins nested test names with `' > '`, but the runner's per-test filter still assumes a plain space, so every per-test mutant run silently executes 0 tests and every covered mutant "survives"). `patches/@stryker-mutator+vitest-runner+10.0.0.patch` (applied via `patch-package` on `postinstall`) backports the fix from the still-open upstream PR ([#6220](https://github.com/stryker-mutator/stryker-js/pull/6220)); remove the patch once a release contains it.

**Accessibility.** `e2e/a11y.spec.js` runs `@axe-core/playwright`'s `AxeBuilder` (tags `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`) against boot, the post-cutoff stretch view, a docked preview, the weekend block, and every section expanded — asserting `results.violations` is empty. It's part of `npm run e2e`, not a separate CI job.

**Faking the clock in dev:** append `?now=2026-09-29T19:05` to the dev URL. It is interpreted as Costa Rica local time (fixed UTC-6) and is stripped out of production builds (`import.meta.env.DEV` guard in `src/time.js`). e2e specs instead use `page.clock.setFixedTime(...)` (fakes `Date` only, not timers — matching the Vitest convention above) before navigating.

## Architecture

### Data flow

`src/data/routine.json` (English day names, Monday–Friday only, `sets_reps`/`extra` fields) → `src/routine.js` normalizes items, collapses `A1`/`A2`-style groups into supersets via `groupSupersets`, and caches one routine object per weekday → `src/main.js` renders it. Saturday and Sunday are not in the JSON; they come from `WEEKEND` in `src/config.js` and render a separate block.

### Three "day" values

`main.js` tracks three weekdays and the whole UI is derived from how they differ:

- `today` — the real weekday **in America/Costa_Rica**, never the device timezone (`nowInZone` in `src/time.js` uses `Intl.DateTimeFormat` parts).
- `selected` — the routine confirmed for today. Defaults to `today`, or to a persisted override.
- `preview` — the routine currently displayed. Tapping a chip in the day strip only changes `preview`.

`preview !== selected` → hero shows the "Vista previa" tag and the bottom confirm bar is docked (`.app--docked`). Confirming writes `{ dateKey, weekday }` to IndexedDB (`src/store.js`, via `idb`) and sets `selected`. On boot, an override whose `dateKey` is not today's is deleted, so overrides never leak into the next day. `selected !== today` → "Cambiado" tag.

### Rendering and state

`createState` in `src/state.js` is a tiny observable. `set()` re-renders the whole tree with `replaceChildren`; `patch()` mutates without notifying. Section open/closed state uses `patch` on purpose: the native `<details>` element already reflects the toggle, and re-rendering would rebuild it. Keep that distinction when adding state.

Which section opens by default is time-based: before `STRETCH_CUTOFF` (18:30 CR) the warm-up opens, at or after it the night stretch opens.

### Configuration

`src/config.js` is the single place for the timezone, the stretch cutoff, day names/order, weekend definitions, section list, and all UI labels. Change behaviour or copy there rather than in components.

### Styling and UI

- `src/styles/tokens.css` is the only place raw design values live (colors, borders, hard shadows, type scale, spacing, motifs). Everything else references `var(--…)`. The design brief is `desing.md` (dark neo-brutalist: white 2–4px borders, zero radius, solid offset shadows, orange `#ff5500` and acid green `#c4f000` accents, no gradients/blur).
- `src/ui/primitives/` holds reusable elements (`Button`, `Chip`, `Tag`, `Panel`, `Details`, `Input`). Each is a `Name.js` + `Name.css` pair; the JS imports its own CSS and is re-exported from `primitives/index.js`. Add new primitives following that convention.
- `src/ui/*.js` (hero, dayStrip, sections, items, confirmBar) are page-specific renderers that compose primitives. Page-level layout lives in `src/styles/layout.css`.
- All UI is plain DOM (`document.createElement`), no templating or JSX.

### Deploy

`wrangler.jsonc` serves `./dist` as Worker static assets with SPA not-found handling. The PWA is `registerType: 'autoUpdate'` with a precached glob and `navigateFallback` to `index.html`, so a deploy is picked up on the next app launch.
