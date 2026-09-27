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
npm test                  # Vitest (unit + integration) with a v8 coverage gate
npm run test:unit         # just tests/unit
npm run test:integration  # just tests/integration
npm run test:watch        # Vitest in watch mode
npm run e2e               # Playwright against a production build (run `npm run build` first)
```

There is no linter yet. `.github/workflows/ci.yml` runs build + test + e2e on every push and PR, and deploys to Cloudflare from `main` only after manual approval on the `production` GitHub environment. `CI-CD.md` documents the CI/CD setup.

**Tests.** `tests/unit/**` covers each module in isolation, mirroring `src/`'s layout; `tests/integration/app.test.js` boots the real `src/main.js` in jsdom and drives it through clicks, asserting on the rendered DOM. `vitest.config.js` defines both as Vitest projects, `tests/setup.js` loads `fake-indexeddb/auto` and resets DOM/env/mocks after each test, and `tests/stubs/pwa-register.js` stands in for the `virtual:pwa-register` module Vite generates at build time. `npm test` enforces a 90% v8 coverage threshold (lines/branches/functions/statements) over `src/**/*.js`.

Conventions worth keeping when adding Vitest tests: fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`), never the timer queue — `fake-indexeddb` and `vi.waitFor` need real timers to settle. `store.js` and `routine.js` hold module-level state (`dbPromise`, the routine cache), so integration tests `vi.resetModules()` and re-`import()` for a clean slate, with a fresh `new IDBFactory()` per boot unless deliberately reusing one (e.g. reload-across-days tests). The native `<details>` `toggle` event fires as a queued task, not synchronously and not a microtask — await a `setTimeout(…, 0)` (or `vi.waitFor`) after a summary click before asserting on it.

`e2e/**` (Playwright, config at `playwright.config.js`) runs a full browser against `vite preview` on `:4173` — it needs `dist/` already built (CI reuses the `test` job's artifact; locally run `npm run build` first, or leave a `npm run preview` open for `reuseExistingServer`). It exists to cover what jsdom can't: a real service worker, an offline reload, and the actual manifest response. `e2e/helpers.js` has the shared `gotoAt`/locator helpers.

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
