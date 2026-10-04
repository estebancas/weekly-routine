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
npm run generate-icons    # regenerate public/*.png (icons + iOS splash screens) from public/icon.svg (pwa-assets.config.js)
npm run lint              # ESLint (flat config) over src/, tests/, e2e/, and root config files
npm test                  # Vitest (unit + integration) with a v8 coverage gate
npm run test:unit         # just tests/unit
npm run test:integration  # just tests/integration
npm run test:watch        # Vitest in watch mode
npm run mutate            # Stryker mutation testing over src/**/*.js
npm run size              # size-limit budgets over dist/ (run `npm run build` first)
npm run e2e               # Playwright against a production build (run `npm run build` first)
npm run e2e:visual        # e2e/visual.spec.js only, via Docker, matching CI's environment
```

`eslint.config.js` is a flat config with `js.configs.recommended`, browser globals for `src/**`, browser+node globals for `tests/**`, and node globals for `e2e/**` and root config files. `.github/workflows/ci.yml` runs lint + build + test + mutation testing + bundle-size + dependency audit + e2e on every push and PR, and deploys to Cloudflare from `main` only after manual approval on the `production` GitHub environment.

**Dependency vulnerability scanning.** `.github/dependabot.yml` opens weekly PRs for npm and GitHub Actions updates (minor/patch grouped per ecosystem into one PR each; majors and security fixes arrive on their own). CI's `audit` job runs `npm audit --omit=dev --audit-level=high` (reads `package-lock.json` directly, no install needed; devDependencies are skipped because nothing in them ships, and `braces` (GHSA-vfj7-8cjw-p6xm, no patched release as of 2026-10-04) arrives only via `patch-package`, a postinstall-only tool: a second, non-blocking step (`continue-on-error`) still runs the full `npm audit --audit-level=high` so dev-dependency findings show up as a warning; once `braces` is fixed or `patch-package` is removed, drop `--omit=dev` and that extra step), `npm audit signatures` (after `npm ci`; verifies registry signatures and provenance) and, on pull requests only, `actions/dependency-review-action` with `fail-on-severity: high` against the PR's dependency diff.

**PR guardrails.** Dependabot PRs get a read-only token and no secrets, and the workflow keeps `permissions: contents: read`; never use `pull_request_target`. Every third-party Action in `ci.yml` is pinned to a commit SHA with the version as a trailing comment (Dependabot's `github-actions` ecosystem updates both), and the repo setting `sha_pinning_required` rejects unpinned ones; to pin a new action, `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`. `dependabot.yml` waits 3 days (`cooldown`) before opening version-update PRs and ignores semver-major bumps for the fragile toolchain (`@playwright/test`, `vitest`, `@vitest/*`, `@stryker-mutator/*`, `vite`, `vite-plugin-pwa`, `wrangler`) because their majors are coupled to the pinned Playwright image tag, the Stryker patch, and the deploy path: upgrade those by hand. The `Lint` job also regenerates the PWA icons and iOS splash images (`npm run generate-icons`) and fails if they are missing, differ from `public/`, or leave untracked files there, since no other job exercises that tool. `.github/CODEOWNERS` covers dependency files, `.github/`, `patches/` and tool configs; `main` requires a PR (0 approvals).

**Splash screens.** Android builds its splash from the manifest (`name`, `background_color`, the 512px icon), so there is nothing to maintain. iOS needs one `<link rel="apple-touch-startup-image">` per device screen and orientation: `pwa-assets.config.js` declares them with `createAppleSplashScreens` (every device the generator knows, one dark variant on `#0a0a0a`), `npm run generate-icons` writes the committed `public/apple-splash-*.png`, and the `appleSplashLinks` plugin in `vite.config.js` injects the matching tags into `index.html` from that same config, so tags and files can't drift. They are excluded from the service worker precache (`globIgnores`). After changing `public/icon.svg`, rerun `npm run generate-icons` and commit; a new iPhone screen size needs a generator bump. iOS caches the launch image, so an installed app may keep the old one until it is removed and re-added to the home screen. `e2e/pwa.spec.js` checks every tag resolves to a PNG of the exact size its media query targets.

**Bundle size.** `.size-limit.json` budgets the built output in three groups: JS and CSS measured brotli-compressed (matching what Cloudflare actually serves), and the self-hosted `@fontsource` `.woff2` files measured raw (already compressed, so brotli/gzip barely helps and would understate their real transfer cost). Each limit is today's measured size plus ~10%. `npm run size` needs `dist/` already built; CI's `size` job downloads the `test` job's `dist` artifact rather than rebuilding.

**Tests.** `tests/unit/**` covers each module in isolation, mirroring `src/`'s layout; `tests/integration/app.test.js` boots the real `src/main.js` in jsdom and drives it through clicks, asserting on the rendered DOM. `vitest.config.js` defines both as Vitest projects, `tests/setup.js` loads `fake-indexeddb/auto` and resets DOM/env/mocks after each test, and `tests/stubs/pwa-register.js` stands in for the `virtual:pwa-register` module Vite generates at build time. `npm test` enforces a 90% v8 coverage threshold (lines/branches/functions/statements) over `src/**/*.js`.

Conventions worth keeping when adding Vitest tests: fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`), never the timer queue — `fake-indexeddb` and `vi.waitFor` need real timers to settle. `store.js` and `routine.js` hold module-level state (`dbPromise`, the routine cache), so integration tests `vi.resetModules()` and re-`import()` for a clean slate, with a fresh `new IDBFactory()` per boot unless deliberately reusing one (e.g. reload-across-days tests). The native `<details>` `toggle` event fires as a queued task, not synchronously and not a microtask — await a `setTimeout(…, 0)` (or `vi.waitFor`) after a summary click before asserting on it.

`e2e/**` (Playwright, config at `playwright.config.js`) runs a full browser against `vite preview` on `:4173` — it needs `dist/` already built (CI reuses the `test` job's artifact; locally run `npm run build` first, or leave a `npm run preview` open for `reuseExistingServer`). It exists to cover what jsdom can't: a real service worker, an offline reload, and the actual manifest response. `e2e/helpers.js` has the shared `gotoAt`/locator helpers.

**Visual regression.** `e2e/visual.spec.js` screenshots four states (weekday boot, the night-stretch view, a docked preview, the weekend block) at a phone (390×844) and a desktop (1280×800) viewport, with `expect.toHaveScreenshot` (`maxDiffPixelRatio: 0.01`, animations disabled) and a `snapshotPathTemplate` that drops the OS suffix so there's one baseline set. Font rendering differs by OS, so baselines are Linux-only: the spec calls `test.skip(process.platform !== 'linux', ...)` at the file level, and CI's `e2e` job runs inside the `mcr.microsoft.com/playwright:v1.63.0-noble` container (pinned to the installed `@playwright/test` version) so both browser and baseline generation happen on the same image. To (re)generate baselines locally, run `npm run e2e:visual -- --update-snapshots` (needs Docker Desktop running) and commit the resulting `e2e/__screenshots__/**`. Diffs on a real failure land in the same `playwright-report` artifact as the rest of `npm run e2e`.

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

- `src/styles/tokens.css` is the only place raw design values live (colors, borders, hard shadows, type scale, spacing, motifs). Everything else references `var(--…)`. The design brief is `docs/design.md` (dark neo-brutalist: white 2–4px borders, zero radius, solid offset shadows, orange `#ff5500` and acid green `#c4f000` accents, no gradients/blur).
- `src/ui/primitives/` holds reusable elements (`Button`, `Chip`, `Tag`, `Panel`, `Details`, `Input`). Each is a `Name.js` + `Name.css` pair; the JS imports its own CSS and is re-exported from `primitives/index.js`. Add new primitives following that convention.
- `src/ui/*.js` (hero, dayStrip, sections, items, confirmBar) are page-specific renderers that compose primitives. Page-level layout lives in `src/styles/layout.css`.
- All UI is plain DOM (`document.createElement`), no templating or JSX.

### Deploy

`wrangler.jsonc` serves `./dist` as Worker static assets with SPA not-found handling. The PWA is `registerType: 'autoUpdate'` with a precached glob and `navigateFallback` to `index.html`, so a deploy is picked up on the next app launch.
