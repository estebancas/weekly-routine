# Rutina semanal

A personal, view-only PWA that shows today's workout routine. Open it, see what to train, close it. The UI is in Spanish, the schedule follows Costa Rica time, and it works offline once installed.

Live at [weekly-routine.estcascor94.workers.dev](https://weekly-routine.estcascor94.workers.dev).

## Features

- **Today's routine on launch.** Warm-up, exercises and night stretch for the current weekday, with `A1`/`A2` pairs grouped as supersets.
- **Time-aware.** The weekday is always resolved in `America/Costa_Rica`, not the device timezone. Before 18:30 the warm-up section opens by default; from 18:30 on, the night stretch does.
- **Preview other days.** Tap a day in the strip to peek at its routine, then confirm to use it as today's. The override is stored in IndexedDB and dropped automatically the next day.
- **Weekends.** Saturday is bike day, Sunday is rest.
- **Installable and offline.** A service worker precaches the app; updates are picked up on the next launch.
- **Dark neo-brutalist look.** White borders, zero radius, hard offset shadows, orange and acid-green accents. See [docs/design.md](docs/design.md).

## Stack

Vanilla JS (no framework), [Vite](https://vite.dev) with [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app), [`idb`](https://github.com/jakearchibald/idb) for storage, self-hosted `@fontsource` fonts, deployed as static assets on a Cloudflare Worker.

## Getting started

Requires Node 22.12 or newer.

```bash
npm ci
npm run dev
```

To try a specific moment in dev, append `?now=2026-09-29T19:05` to the URL. It is read as Costa Rica local time and is stripped from production builds.

## Editing the routine

The routine lives in [`src/data/routine.json`](src/data/routine.json), Monday to Friday, with `mobility`, `exercises` and `stretch` lists per day. Exercises with a `group` of `A1`, `A2`, ... are collapsed into supersets. Timezone, stretch cutoff, weekend blocks and every UI label are in [`src/config.js`](src/config.js).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve `dist/` locally on `:4173` |
| `npm run deploy` | Build and `wrangler deploy` |
| `npm run generate-icons` | Regenerate `public/*.png` from `public/icon.svg` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (unit + integration) with a 90% coverage gate |
| `npm run mutate` | Stryker mutation testing (break threshold 85) |
| `npm run size` | Bundle-size budgets (run `build` first) |
| `npm run e2e` | Playwright against the production build (run `build` first) |
| `npm run e2e:visual` | Visual regression via Docker, matching CI |

## Project layout

```
src/
  main.js         boot and top-level state
  config.js       timezone, cutoff, days, weekend blocks, labels
  routine.js      normalizes routine.json, builds supersets
  store.js        IndexedDB day override
  time.js         Costa Rica clock
  ui/             page renderers; ui/primitives/ holds Button, Chip, Tag, Panel, Details, Input
  styles/         tokens.css (all raw design values), layout.css
tests/            unit/ mirrors src/, integration/ boots the app in jsdom
e2e/              Playwright: offline/service worker, visual regression, a11y
docs/             design brief
```

## CI/CD

`.github/workflows/ci.yml` runs lint, build, tests, mutation testing, bundle size, dependency audit and e2e on every push and PR. Deploys to Cloudflare run from `main` only, after manual approval on the `production` GitHub environment. Dependabot opens weekly update PRs.

## Contributing

Branches are named `<feat|fix|doc|chore>/<kebab-case-description>`, see [CONTRIBUTING.md](CONTRIBUTING.md). Every feature or bug fix in `src/` ships with tests. Architecture notes and conventions for AI agents are in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).
