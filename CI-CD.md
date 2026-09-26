# CI/CD plan: GitHub Actions → Cloudflare Workers

Goal: every push runs the pipeline (install, build, unit tests, e2e). A deploy to Cloudflare only happens on `main`, only after the pipeline is green, and only when you approve it by hand in the GitHub UI.

Status: plan. Nothing in `.github/` exists yet. Unit and e2e tests do not exist yet either; the pipeline is written so those steps pass while empty and become real as soon as the test tooling lands.

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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist
          retention-days: 7

  e2e:
    name: End-to-end
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Check for Playwright config
        id: has-e2e
        run: |
          if ls playwright.config.* >/dev/null 2>&1; then echo "present=true" >> "$GITHUB_OUTPUT"; else echo "present=false" >> "$GITHUB_OUTPUT"; fi
      - if: steps.has-e2e.outputs.present == 'false'
        run: echo "No playwright.config found, skipping e2e."
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm ci
      - if: steps.has-e2e.outputs.present == 'true'
        run: npx playwright install --with-deps chromium
      - if: steps.has-e2e.outputs.present == 'true'
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist
      - if: steps.has-e2e.outputs.present == 'true'
        run: npm run e2e
      - if: always() && steps.has-e2e.outputs.present == 'true'
        uses: actions/upload-artifact@v4
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: wrangler deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

Notes:
- The deploy job rebuilds instead of reusing the artifact so the deployed bundle always comes from the exact checked-out commit.
- `cloudflare/wrangler-action@v3` uses the `wrangler` version from `package.json`, so CI and local deploys match.
- Check the action's current major version on its GitHub page before first use.

---

## 3. Repo changes to make alongside the workflow

1. **Pin Node.** Create `.nvmrc` containing `26`. `setup-node` reads it, and it documents the local version.
2. **Add script placeholders to `package.json`** so the pipeline is green before tests exist:
   ```json
   "test": "vitest run --passWithNoTests",
   "e2e": "playwright test"
   ```
   Until Vitest is installed, use `"test": "echo \"no unit tests yet\""` instead. Swap to the Vitest line when you add it.
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

## 6. Future test work this pipeline is ready for

Unit (Vitest, `npm i -D vitest`), good first targets:
- `src/time.js`: `nowInZone` with fixed `Date` inputs across the 18:30 boundary and midnight in Costa Rica.
- `src/routine.js`: `groupSupersets` grouping (A1/A2 pairs, lone D1, plain letters) and weekend lookup.

End-to-end (Playwright, `npm i -D @playwright/test` + `npx playwright init`), mirroring the flows already verified by hand:
- Home opens on today's weekday with the correct section open for the time.
- Tapping another day shows the preview tag and the bottom confirm bar; reload without confirming resets.
- Confirming persists across reload and shows the changed tag; a stale override is dropped.
- Saturday and Sunday render the weekend block.
- Manifest and service worker are served; page loads offline after first visit.

Playwright config should point `baseURL` at `http://localhost:4173` and use `webServer: { command: 'npx vite preview --port 4173 --strictPort', reuseExistingServer: true }`. The dev-only `?now=` clock override does not exist in production builds, so e2e tests that need a fixed time should use Playwright's `page.clock` API instead.

---

## 7. Checklist

- [ ] `.nvmrc` with `26`
- [ ] `test` and `e2e` scripts in `package.json`
- [ ] `.github/workflows/ci.yml`
- [ ] GitHub repo created and `main` pushed
- [ ] Cloudflare API token created
- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets added
- [ ] `production` environment with required reviewer and `main` only
- [ ] Branch protection on `main` requiring the two check jobs
- [ ] First run approved and Version ID verified
