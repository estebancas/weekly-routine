# CI/CD plan: GitHub Actions → Cloudflare Workers

Goal: every push runs the pipeline (install, build, unit tests, e2e). A deploy to Cloudflare only happens on `main`, only after the pipeline is green, and only when you approve it by hand in the GitHub UI.

Status: `.nvmrc`, the `lint`/`test`/`mutate`/`size`/`e2e` scripts and `.github/workflows/ci.yml` are in the repo (section 3 and the workflow below are done). Unit, integration, mutation and end-to-end tests are all done (section 6); `npm test`, `npm run mutate`, `npm run size` and `npm run e2e` all run for real now, and the e2e CI job no longer skips itself and now runs in the pinned Playwright container. `lint`, `mutation` and `audit` jobs run in parallel with `test`; `size` runs against the `test` job's `dist` artifact. `.github/dependabot.yml` opens weekly update PRs. Of the manual steps in section 4: the GitHub repo (4.1) and branch protection for all six checks (4.5) is done; the Cloudflare API token (4.2), the two GitHub secrets (4.3), and the `production` environment's required reviewer + branch restriction (4.4) are still pending — see the checklist in section 7.

---

## 1. Pipeline shape

```
push / PR ─► lint ────────────────────────────────────────────┐
         ├─► mutation testing ──────────────────────────────┤
         ├─► dependency audit ──────────────────────────────┤
         ├─► test (unit + build) ─┬─► size (bundle budget) ───┤
         │                        └─► e2e ────────────────────┤
         └────────────────────────────────────── [ wait for approval ] ─► deploy
                                                                  only on main
```

- **lint**: `npm ci`, `npm run lint`, then regenerates the PWA icons and fails if they are missing or differ from the committed ones (`generate-icons` is otherwise exercised by nothing, so a bad dev-tool bump would pass every other check). Runs in parallel with `test`, no `needs`.
- **test**: `npm ci`, `npm run build`, `npm test`. Fails the run on any error.
- **mutation testing**: runs in parallel with `test`, no `needs`. `npm ci`, `npm run mutate`. Uploads `reports/mutation` as an artifact even on failure.
- **dependency audit**: runs in parallel with `test`, no `needs`. `npm audit --audit-level=high` (reads `package-lock.json`, no install needed), then `npm ci` + `npm audit signatures` (verifies registry signatures and provenance of the installed packages), plus `actions/dependency-review-action` on pull requests only, checking the PR's dependency diff.
- **size**: depends on `test`. Downloads its `dist` artifact, runs `npm run size` against the budgets in `.size-limit.json`.
- **e2e**: depends on `test`. Runs inside the `mcr.microsoft.com/playwright:v1.63.0-noble` container (pinned to the installed `@playwright/test` version) so the visual-regression baselines committed from that same image render identically. Serves `dist/` with `vite preview`, runs Playwright against it. Skipped automatically until a `playwright.config.*` file exists.
- **deploy**: depends on both. Runs only for `main` (push or manual dispatch). Bound to a GitHub *environment* named `production` that has you as a required reviewer. The job pauses at "Waiting for review" until you approve it. That approval is the manual trigger.

Why an environment gate instead of a separate deploy workflow: GitHub records who approved, when, and which commit shipped, and the deploy job cannot run unless the earlier jobs in the same run passed. Re-deploying an older commit is still possible via "Run workflow" on that ref.

---

## 2. Workflow file

Create `.github/workflows/ci.yml` with this content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run lint
      # generate-icons is otherwise unexercised by CI, so a bad dev-tool bump (e.g. an
      # ESM-only major) would pass every other check. Regenerate and compare to the
      # committed icons.
      - name: Icons regenerate cleanly
        run: |
          npm run generate-icons
          for f in pwa-64x64.png pwa-192x192.png pwa-512x512.png maskable-icon-512x512.png apple-touch-icon-180x180.png favicon.ico; do
            test -s "public/$f" || { echo "missing or empty: public/$f"; exit 1; }
          done
          git diff --exit-code -- public/

  test:
    name: Unit tests + build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: dist
          path: dist
          retention-days: 7

  mutation:
    name: Mutation testing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run mutate
      - if: always()
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: mutation-report
          path: reports/mutation
          retention-days: 7

  audit:
    name: Dependency audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm audit --audit-level=high
      - run: npm ci
      - run: npm audit signatures
      - if: github.event_name == 'pull_request'
        uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5
        with:
          fail-on-severity: high

  size:
    name: Bundle size
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8
        with:
          name: dist
          path: dist
      - run: npm run size

  e2e:
    name: End-to-end
    runs-on: ubuntu-latest
    needs: test
    # Pinned to the installed @playwright/test version so the container's preinstalled
    # browsers and fonts match `npm ci`'s resolved version, and so visual regression
    # baselines (committed from the same image, see CLAUDE.md) render identically.
    container:
      image: mcr.microsoft.com/playwright:v1.63.0-noble
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - name: Check for Playwright config
        id: has-e2e
        run: |
          if ls playwright.config.* >/dev/null 2>&1; then
            echo "present=true" >> "$GITHUB_OUTPUT"
          else
            echo "present=false" >> "$GITHUB_OUTPUT"
          fi
      - if: steps.has-e2e.outputs.present == 'false'
        run: echo "No playwright.config found, skipping e2e."
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm ci
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8
        with:
          name: dist
          path: dist
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm run e2e
      - if: always() && steps.has-e2e.outputs.present == 'true'
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: playwright-report
          path: playwright-report
          retention-days: 7

  deploy:
    name: Deploy to Cloudflare
    runs-on: ubuntu-latest
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    environment:
      name: production
      url: https://weekly-routine.estcascor94.workers.dev
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: wrangler deploy
        uses: cloudflare/wrangler-action@953926a2e2182532811c01a25e53647d93bf07c0 # v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

Notes:
- The deploy job rebuilds instead of reusing the artifact so the deployed bundle always comes from the exact checked-out commit.
- `cloudflare/wrangler-action` uses the `wrangler` version from `package.json`, so CI and local deploys match.
- Every third-party Action is pinned to a commit SHA with the version in a trailing comment, and the repo setting `sha_pinning_required` rejects any unpinned `uses:`. Dependabot's `github-actions` ecosystem keeps the pins current; to pin a new action by hand, resolve it with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`.
- Check the action's current major version on its GitHub page before first use.

---

## 3. Repo changes to make alongside the workflow

1. **Pin Node.** Create `.nvmrc` containing `26`. `setup-node` reads it, and it documents the local version.
2. **`package.json` scripts** (done): `"lint": "eslint ."` is what CI's `lint` job runs. `"test": "vitest run --coverage"` runs the full Vitest suite (unit + integration) with the coverage gate — this is what CI's `test` job runs. `"mutate": "stryker run"` runs Stryker mutation testing — this is what CI's `mutation` job runs. `"size": "size-limit"` checks the budgets in `.size-limit.json` — this is what CI's `size` job runs, against the `dist` artifact the `test` job already built. `"e2e": "playwright test"` runs the Playwright suite against a production build — this is what CI's `e2e` job runs, against that same artifact. CI's `audit` job has no dedicated script — it runs `npm audit` directly.
3. **Optional but recommended:** `"engines": { "node": ">=22.12" }` in `package.json`, matching Vite 8's requirement.

---

## 4. Manual steps (one time)

### 4.1 GitHub repository

1. Create an empty repo on GitHub (private is fine).
2. Push the existing history:
   ```
   git remote add origin git@github.com:<you>/weekly-routine.git
   git branch -M main
   git push -u origin main
   ```

### 4.2 Cloudflare API token

1. Cloudflare dashboard → profile icon (top right) → **My Profile** → **API Tokens** → **Create Token**.
2. Use the **Edit Cloudflare Workers** template.
3. Under *Account Resources* restrict it to your account only. Under *Zone Resources* leave "All zones" or restrict; this project uses no zone.
4. Optionally set a TTL. Create the token and copy it now. It is shown once.
5. Account ID: dashboard → Workers & Pages → the right-hand sidebar shows **Account ID**. It is also printed by `npx wrangler whoami`.

Permissions this template grants and why they are enough: Workers Scripts Edit (upload the Worker and its static assets), Account Settings Read (wrangler reads account metadata), User Details Read (token validation).

### 4.3 GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | the token from 4.2 |
| `CLOUDFLARE_ACCOUNT_ID` | `d0fd2aad2270079a003f03554bd44aee` (from `npx wrangler whoami`) |

### 4.4 Production environment with approval gate

Repo → **Settings** → **Environments** → **New environment** → name it `production`.

1. Enable **Required reviewers** and add yourself.
2. Under **Deployment branches and tags** choose *Selected branches and tags* and add `main`.
3. Optionally enable **Wait timer** (0 is fine) and **Prevent self-review** stays off since you are the only reviewer.

Save. From now on the `deploy` job stops at "Waiting for review" and does nothing until approved.

### 4.5 Branch protection (recommended)

Repo → **Settings** → **Branches** → **Add rule** for `main`:
- Require status checks to pass: select `Unit tests + build`, `End-to-end`, and any other job added later (`Lint`, `Mutation testing`, `Bundle size`, `Dependency audit`) once it has run at least once on the default branch.
- Require a pull request before merging, with 0 required approvals (so you can still merge your own and Dependabot PRs). `.github/CODEOWNERS` lists the sensitive paths (dependency files, `.github/`, `patches/`, tool configs).

This keeps a broken commit from ever reaching the point where you could approve a deploy.

---

## 5. How to trigger a deploy

**Normal flow (after merging or pushing to main):**
1. Repo → **Actions** → the run for your commit.
2. Once `test` and `e2e` are green, the run shows a yellow **Review deployments** button.
3. Click it → tick `production` → **Approve and deploy**.
4. The deploy job runs. Its log ends with the workers.dev URL and a **Current Version ID**.

**Redeploy a specific commit or re-run without new changes:**
1. **Actions** → **CI** → **Run workflow** → branch `main` → **Run workflow**.
2. Same approval step as above.

**Reject a deploy:** click **Review deployments** → **Reject**. The run is marked failed and nothing ships.

**Verify after deploying:**
```
npx wrangler deployments list
```
The top entry's Version ID should match the one in the Actions log. Open the app on the phone; the service worker auto-updates on the next launch.

---

## 6. Test work

All done — Vitest unit + integration, Stryker mutation testing, and Playwright end-to-end. See `CLAUDE.md`'s Tests section for layout and conventions.

- **Unit** (`tests/unit/**`, Vitest + `jsdom` + `fake-indexeddb`): every module in `src/` in isolation — `time.js`'s `nowInZone` across the CR midnight/DST-free boundary and the ICU "hour 24" quirk, `routine.js`'s `groupSupersets` and `getRoutine`, a data contract on `routine.json` itself, `state.js`, `store.js` against `fake-indexeddb`, and every `ui/` renderer and primitive.
- **Integration** (`tests/integration/app.test.js`, Vitest + `jsdom`): boots the real `src/main.js` with a faked clock, driving boot/preview/confirm/reload/weekend flows end to end.
- **Coverage gate**: `npm test` (`vitest run --coverage`) enforces 90% lines/branches/functions/statements over `src/**/*.js` and is what CI's `test` job runs.
- **Mutation testing** (`stryker.config.json`, `npm run mutate`): checks that the coverage above has real assertions behind it, not just executed lines. Runs against `vitest.stryker.config.js` (a flat Vitest config Stryker needs) with a `thresholds.break` of 85 (baseline ~90%). Needs a locally-applied `patch-package` fix for an upstream Vitest 5 incompatibility — see `CLAUDE.md`'s Mutation testing note.
- **Bundle size** (`.size-limit.json`, `npm run size`): budgets the built JS/CSS (brotli) and self-hosted fonts (raw) in `dist/`, each ~10% above the measured baseline. Runs against the `test` job's `dist` artifact, no rebuild.
- **Dependency audit** (`.github/dependabot.yml`, CI's `audit` job): `npm audit --audit-level=high` catches known-vulnerable dependencies already in the lockfile; `actions/dependency-review-action` (PRs only) catches a PR that's about to *add* one, against the PR's dependency diff. Dependabot itself opens weekly update PRs (npm + GitHub Actions, minor/patch grouped per ecosystem); confirm **Dependabot security updates** is enabled under repo Settings → Security if you want vulnerable-dependency PRs opened automatically too.
- **End-to-end** (`e2e/**`, `@playwright/test`, config at `playwright.config.js`): a real Chromium against `vite preview` on `:4173`, covering what jsdom can't — boot on today's weekday with the correct section open for the time; preview/Volver/confirm/reload flows including a stale override being dropped; Saturday and Sunday rendering the weekend block; the manifest response; an active service worker; and a page reload while offline after the first visit. `npm run e2e` is what CI's `e2e` job runs, against the `dist` the `test` job already built (locally, run `npm run build` first). `page.clock.setFixedTime(...)` fakes the wall clock (the dev-only `?now=` override doesn't exist in production builds).
- **Visual regression** (`e2e/visual.spec.js`, part of `npm run e2e`): screenshots four states at a phone and a desktop viewport. Linux-only (font rendering differs by OS), so it's skipped locally on macOS; `npm run e2e:visual` runs it through the same `mcr.microsoft.com/playwright:v1.63.0-noble` image CI uses. See `CLAUDE.md`'s Visual regression note for how to update baselines.

---

## 7. Checklist

- [x] `.nvmrc` with `26`
- [x] `lint`, `test`, `mutate`, `size` and `e2e` scripts in `package.json`
- [x] `.github/workflows/ci.yml`
- [x] GitHub repo created and `main` pushed
- [ ] Cloudflare API token created
- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets added
- [ ] `production` environment with required reviewer and `main` only
- [x] Branch protection on `main` requiring `Unit tests + build`, `End-to-end`, `Lint`, `Mutation testing`, `Bundle size`, and `Dependency audit`
- [x] Actions setting `sha_pinning_required` on, all `uses:` pinned to commit SHAs
- [x] Branch protection requires a pull request (0 approvals) and `.github/CODEOWNERS` exists
- [ ] `Dependabot security updates` confirmed enabled under repo Settings → Security
- [ ] First run approved and Version ID verified
