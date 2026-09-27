# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal, view-only PWA (Spanish UI) that shows the workout routine for the current day. Vanilla JS with no framework, built with Vite + `vite-plugin-pwa`, deployed as static assets on a Cloudflare Worker (`weekly-routine.estcascor94.workers.dev`).

## Commands

```
npm run dev              # Vite dev server
npm run build            # production build to dist/
npm run preview          # serve dist/ locally (also what e2e will target on :4173)
npm run deploy           # vite build && wrangler deploy
npm run generate-icons   # regenerate public/*.png from public/icon.svg (pwa-assets.config.js)
```

There is no test runner or linter yet; `npm test` is an echo placeholder and `npm run e2e` expects Playwright, which is not installed. `.github/workflows/ci.yml` runs build + test + e2e on every push and PR, and deploys to Cloudflare from `main` only after manual approval on the `production` GitHub environment. The e2e job skips itself until a `playwright.config.*` exists. `CI-CD.md` documents the setup and names the intended first tests: Vitest for `src/time.js` and `src/routine.js`, Playwright against `vite preview`.

**Faking the clock in dev:** append `?now=2026-09-29T19:05` to the dev URL. It is interpreted as Costa Rica local time (fixed UTC-6) and is stripped out of production builds (`import.meta.env.DEV` guard in `src/time.js`), so e2e tests must use Playwright's `page.clock` instead.

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
