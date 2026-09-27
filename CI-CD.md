# CI/CD plan: GitHub Actions → Cloudflare Workers

Goal: every push runs the pipeline (install, build, unit tests, e2e). A deploy to Cloudflare only happens on `main`, only after the pipeline is green, and only when you approve it by hand in the GitHub UI.

Status: `.nvmrc`, the `test`/`e2e` scripts and `.github/workflows/ci.yml` are in the repo (section 3 and the workflow below are done). Unit, integration and end-to-end tests are all done (section 6); `npm test` and `npm run e2e` both run for real now, and the e2e CI job no longer skips itself. Of the manual steps in section 4: the GitHub repo (4.1) and branch protection (4.5) are done; the Cloudflare API token (4.2), the two GitHub secrets (4.3), and the `production` environment's required reviewer + branch restriction (4.4) are still pending — see the checklist in section 7.

---

## 1. Pipeline shape

```
push / PR ─► test (unit + build) ─► e2e ─► [ wait for approval ] ─► deploy
                                              only on main
```

- **test**: `npm ci`, `npm run build`, `npm test`. Fails the run on any error.
- **e2e**: depends on `test`. Builds, serves `dist/` with `vite preview`, runs Playwright against it. Skipped automatically until a `playwright.config.*` file exists.
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
  test:
    name: Unit tests + build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: dist
          retention-days: 7

  e2e:
    name: End-to-end
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v7
      - name: Check for Playwright config
        id: has-e2e
        run: |
          if ls playwright.config.* >/dev/null 2>&1; then echo "present=true" >> "$GITHUB_OUTPUT"; else echo "present=false" >> "$GITHUB_OUTPUT"; fi
      - if: steps.has-e2e.outputs.present == 'false'
        run: echo "No playwright.config found, skipping e2e."
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm ci
      - if: steps.has-e2e.outputs.present == 'true'
        run: npx playwright install --with-deps chromium
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/download-artifact@v8
        with:
          name: dist
          path: dist
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm run e2e
      - if: always() && steps.has-e2e.outputs.present == 'true'
        uses: actions/upload-artifact@v7
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
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: wrangler deploy
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

Notes:
- The deploy job rebuilds instead of reusing the artifact so the deployed bundle always comes from the exact checked-out commit.
- `cloudflare/wrangler-action@v4` uses the `wrangler` version from `package.json`, so CI and local deploys match.
- Check the action's current major version on its GitHub page before first use.

---

## 3. Repo changes to make alongside the workflow

1. **Pin Node.** Create `.nvmrc` containing `26`. `setup-node` reads it, and it documents the local version.
2. **`package.json` scripts** (done): `"test": "vitest run --coverage"` runs the full Vitest suite (unit + integration) with the coverage gate — this is what CI's `test` job runs. `"e2e": "playwright test"` runs the Playwright suite against a production build — this is what CI's `e2e` job runs, against the `dist` artifact the `test` job already built.
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
- Require status checks to pass: select `Unit tests + build` and `End-to-end`.
- Optionally require a pull request before merging.

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

All done — Vitest unit + integration, and Playwright end-to-end. See `CLAUDE.md`'s Tests section for layout and conventions.

- **Unit** (`tests/unit/**`, Vitest + `jsdom` + `fake-indexeddb`): every module in `src/` in isolation — `time.js`'s `nowInZone` across the CR midnight/DST-free boundary and the ICU "hour 24" quirk, `routine.js`'s `groupSupersets` and `getRoutine`, a data contract on `routine.json` itself, `state.js`, `store.js` against `fake-indexeddb`, and every `ui/` renderer and primitive.
- **Integration** (`tests/integration/app.test.js`, Vitest + `jsdom`): boots the real `src/main.js` with a faked clock, driving boot/preview/confirm/reload/weekend flows end to end.
- **Coverage gate**: `npm test` (`vitest run --coverage`) enforces 90% lines/branches/functions/statements over `src/**/*.js` and is what CI's `test` job runs.
- **End-to-end** (`e2e/**`, `@playwright/test`, config at `playwright.config.js`): a real Chromium against `vite preview` on `:4173`, covering what jsdom can't — boot on today's weekday with the correct section open for the time; preview/Volver/confirm/reload flows including a stale override being dropped; Saturday and Sunday rendering the weekend block; the manifest response; an active service worker; and a page reload while offline after the first visit. `npm run e2e` is what CI's `e2e` job runs, against the `dist` the `test` job already built (locally, run `npm run build` first). `page.clock.setFixedTime(...)` fakes the wall clock (the dev-only `?now=` override doesn't exist in production builds).

---

## 7. Checklist

- [x] `.nvmrc` with `26`
- [x] `test` and `e2e` scripts in `package.json`
- [x] `.github/workflows/ci.yml`
- [x] GitHub repo created and `main` pushed
- [ ] Cloudflare API token created
- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets added
- [ ] `production` environment with required reviewer and `main` only
- [x] Branch protection on `main` requiring the two check jobs
- [ ] First run approved and Version ID verified
