# 08 — Migration Plan

**Status:** `partial` — Phases 0–6 done (5 fully, 6 with two open boxes), Phase 7 partial
(CI unverifiable, three Cypress-flow test cases missing), Phase 8 partial (prod is live;
smoke run, legacy data import, and repo-root cleanup open).

## Requirement

Convert EZ Audit from Laravel + Laravel-era React to React 18 + Vite + TypeScript + Convex
+ AWS + SDEE3 Identity **without changing the cherished UI**, in reversible phases, each
with an acceptance gate. The source of truth for the UI is git `702d652`; for conventions
it is `../astro-mate`, `../identity`, and `../infrastructure`.

## Phase overview

| Phase | Deliverable | Gate | Status |
|---|---|---|---|
| 0 — Archive | `702d652` worktree + screenshots + recon reports | UI baseline reproducible at `:3100` | done |
| 1 — Scaffold | pnpm workspace, `frontend/` + `backend/` skeletons, env examples | `pnpm install && pnpm build` on a fresh clone | done |
| 2 — UI port | All routes/components on Vite + React 18 + Chakra v2 + React Router | [02](./02-ui-parity.md) port checklist passes | done |
| 3 — Auth | SDEE3 Identity hub SSO + Convex JWT | [03](./03-identity-auth.md) acceptance passes | done |
| 4 — Backend | Convex schema, functions, audit pipeline | [04](./04-backend-convex.md) acceptance passes | mostly done |
| 5 — Infra + deploy | `aws/ezaudit` stack, `scripts/deploy-frontend.sh` | [05](./05-deploy-frontend.md) acceptance passes | done |
| 6 — Convex dev/prod | Dev + prod deployments, key plumbing | [06](./06-convex-dev-prod.md) acceptance passes | done |
| 7 — Tests + CI | Vitest for frontend and backend, CI workflow | [07](./07-testing-and-ci.md) acceptance passes | partial |
| 8 — Cutover | Production deploy, Laravel decommission | Prod smoke + rollback plan | partial |

## Phase 0 — Archive (done)

- [x] Identified `702d652` as the last full-UI revision. Cypress in that tree is not ported.
- [x] Built and served it (`node:18` + pnpm 7); captured 14 screenshots to
      `ezaudit-revive-702/screenshots/`. (Worktree still checked out at `702d652` on
      branch `revive/nextjs-cypress`; all 14 PNGs present.)
- [x] Surveyed `../astro-mate`, `../identity`, `../infrastructure`; reports in
      `.scratch/recon/` (astro-mate-frontend, astro-mate-backend, identity-auth,
      infrastructure).

## Phase 1 — Scaffold (done — `73e7548`)

- [x] Root `package.json` (`private`, `packageManager: pnpm@12.6.0`, `engines.node >= 20`)
      and `pnpm-workspace.yaml` (`frontend`, `backend`).
- [x] `frontend/` (Vite + React 18 + TS + Chakra v2) and `backend/` (Convex) skeletons.
- [x] `.env.example` files in `frontend/`, `backend/`, `scripts/`; all local/prod env
      files gitignored.
- [x] Gate: `pnpm install` → `pnpm build` → `pnpm test` (then non-empty) all succeed.
      Verified at `f9fef5e`: build, test (17 frontend + 10 backend), lint, typecheck all
      pass locally.

> Note: the planned "remove the Laravel `backend/` contents once the Convex backend is
> functional" step never applied — Laravel lived on the `feature/laravel-revert` branch,
> never in this tree's `backend/`; the Convex package was created fresh. See
> Shipped divergences.

## Phase 2 — UI port (done — `73e7548`)

- [x] All 702d652 routes and components ported per [02-ui-parity](./02-ui-parity.md):
      `/`, `/terms-and-conditions`, `/dashboard`, `/dashboard/audits`,
      `/dashboard/audits/:id`, `/dashboard/password-reset`, plus the added `/sign-in` and
      `/sso-callback`. Every [02](./02-ui-parity.md) component is present in
      `frontend/src` (AuditForm, AuditResult + ShareAuditURLModal, Breadcrumbs, Footer,
      Layout, Loading, Navbar, NoResults, Dashboard module, Print hooks). No `data-cy`
      anywhere (grep: 0 matches).
- [x] `next/*` replaced: `next/head` → a small in-house `Head` component
      (`frontend/src/head.tsx`); routing on `react-router-dom` v7; `next-pwa` →
      `vite-plugin-pwa` + manual SW registration (`3f10b7a`). Theme tokens in
      `utils/theme.ts` are verbatim; Open Sans + normalize.css + manifest load in
      `index.html`; assets copied to `frontend/public/static/` with the manifest path fix.
- [x] Withheld nothing: port checklist assets/tokens verified in the tree; the visual
      pass against `ezaudit-revive-702/screenshots/` was attested during the port and the
      prod deploy is built from this tree.
- [x] Gate: the [02](./02-ui-parity.md) inventory is fully present in `frontend/`
      (code-level check; spec 02 remains the parity authority — no automated pixel diff
      exists, by design).

## Phase 3 — Auth (done — `4d55674`, `42501dc`, `8e3f145`, `f9fef5e`)

- [x] `@clerk/react@6.17.8` pinned (peer range covers React 18.3); recorded in spec 03.
- [x] Clerk SDK + hub SSO per [03-identity-auth](./03-identity-auth.md):
      `ClerkProvider → ConvexProviderWithClerk → BrowserRouter`, `/sign-in` hub handoff
      with typed-email forwarding (`8e3f145`), `/sso-callback` ticket exchange with retry
      path, deep-link preservation.
- [x] Identity-repo allowlist changes and deployment done (03's checklist: `9acdb7c`
      allowlist, credits slug unions deployed to identity dev + prod; Clerk dashboard
      step N/A on the free plan — `38acb1f`).
- [x] `useAuthContext` reimplemented on Clerk preserving its
      `{ user, accessToken, setUserData, clearUser }` shape.
- [x] `ConvexSessionGuard` + token refresh + recovery fallback (`42501dc`, the
      astro-mate session-guard approach). Credits display on the navbar via the vendored
      React-18 subset (`f9fef5e`, deployed to prod).
- [x] Gate: prod sign-in round-trip works with `convex` JWTs (CSP/HSTS for
      Clerk/identity verified live on `https://ezaudit.sdee3.com`, 2026-10-15; prod
      deployment `standing-malamute-74` serves the frontend); identity Convex visit
      logging is recorded as verified in 03's checklist.

## Phase 4 — Backend (mostly done — `899fa27`, `2c884dd`)

- [x] Convex schema and functions per [04-backend-convex](./04-backend-convex.md):
      `audits` + `auditJobs` tables with spec-04 indexes, `auth.config.ts` (Clerk JWT,
      `applicationID: "convex"`), `requireUserId`,
      `submit` / `listMine` / `get` / `setVisibility` with owner + visibility gating, and
      the `auditPipeline` (internalAction `run`/`retry`, bounded attempts + backoff).
- [x] D1–D3 decisions are locked in `docs/adr/` (0001–0003) and implemented in code:
      `lib/lighthouse.ts` (remote worker + dev-seed), `lib/email.ts` (Resend, fail-open).
- [x] Wired to real UI data: reactive `useQuery` lists, share-visibility toggle, submit
      alerts (`2c884dd`); dev deployment `dev:bold-orca-397` pushed (`899fa27`).
- [ ] Legacy `audits` rows are **not** migrated yet: the one-off `importLegacy` mutation
      ([ADR 0004](../adr/0004-migrate-legacy-audits.md)) is not implemented and the
      Laravel DB export has not been imported. The parked legacy tree lives in the
      gitignored `.scratch/laravel-leftovers/`.
- [ ] Real-time dashboard updates (submitted audit appears **without a page reload**)
      are coded but not yet runtime-verified (spec 04's open box).
- [ ] D1 is only half-live: no ezaudit Lighthouse Lambda worker exists in the AWS account
      (only `astro-mate-ota-manifest` and `ai-debates-seo-router`), so
      `lib/lighthouse.ts` currently runs in DEV-SEED mode unless
      `LIGHTHOUSE_WORKER_URL` is set — see Shipped divergences.
- Gate: dashboard is fully driven by Convex queries ([x], `2c884dd`); submissions flow
  queued → done in real time ([~] pipeline + retry proven by tests, real-time rendering
  not yet attested); tests pass ([x] 10 backend cases).

## Phase 5 — Infra + deploy (done — `f34d0aa`, `9a2d53f`, `0bdd9b2`)

- [x] `aws/ezaudit` Terraform stack in `../infrastructure` (S3 `ezaudit-sdee3`, OAC,
      CloudFront distribution `E3581TUKKUJZQP`, ACM + Cloudflare DNS,
      `ezaudit-viewer-request` + `ezaudit-security-headers`), applied 2026-10-14 with the
      "EZAudit (AWS)" README section. `../infrastructure/convex` owns
      `convex_project.ezaudit` + dev/prod deployments.
- [x] `scripts/deploy-frontend.sh`: generated `.env.production`, canonical CSP from
      `../identity/shared/clerk-csp.sh`, S3 sync with the cache classes, CloudFront
      invalidation.
- [x] Gate: `https://ezaudit.sdee3.com` serves the SPA over HTTPS with the correct
      headers and cache classes — verified live 2026-10-15: HTTP 200, HSTS (2 y,
      preload), canonical CSP, `index.html` `no-cache,no-store,must-revalidate`,
      `/assets/*` `public,max-age=31536000,immutable`, deep link
      `/dashboard/audits/123` returns the SPA shell (200), `/sw.js` and
      `/static/manifest/manifest.json` served.

## Phase 6 — Convex dev/prod (done — `899fa27`, `1cc7a84`, `f9fef5e`)

- [x] Dev `dev:bold-orca-397` (project `stefan-djokic:ezaudit-91edc`) and prod
      `prod:standing-malamute-74` both deployed and in sync with the repo (dev push
      `899fa27`; prod deploy recorded with the credits work, `f9fef5e`).
- [x] Scrubbing wrapper trio in `backend/scripts/` (`load-backend-env.sh`,
      `convex-with-env.sh` with `env -i`, `sync-convex-env.sh`); deploys pinned to the
      env-file key (`1cc7a84`). `convex:env:sync` / `:prod` exercised: both deployments'
      env vars set and hash-compared per 03's checklist (including
      `CREDITS_SERVICE_SECRET_EZAUDIT`).
- [ ] `convex:dev` watch/codegen loop: the committed `_generated` artifacts and pushes
      prove it works; it has not been re-attested on record since `899fa27`.
- [ ] The "deploying prod requires passing `pnpm test` first" runbook box is not met
      (no runbook doc exists; see Shipped divergences).
- Gate: one command per environment ([x], `deploy` vs `deploy:prod` through the same
  wrapper); no cross-deployment risk ([x], `env -i` scrub + `--prod` env-file selection).

## Phase 7 — Tests + CI (partial — `899fa27`, `bdd1ace`)

- [x] Vitest only, no Cypress and no Playwright anywhere in the tree (grep: 0).
- [x] Frontend suite: 5 files / 17 tests (`smoke`, `identity`, `identityCreditsApi`,
      `authErrors`, `publicRoutes`), jsdom. Backend suite: `convex/audits.test.ts`,
      10 cases under `edge-runtime` incl. auth-failure paths.
- [x] `.github/workflows/checks.yml`: `pnpm install --frozen-lockfile` → `pnpm lint` →
      `pnpm typecheck` → `pnpm test` on push and PRs (`bdd1ace`); no private-repo clone
      step (credits are vendored; `f9fef5e`).
- [x] `pnpm test` green locally at `f9fef5e` (27 tests pass).
- [ ] The three former Cypress flows' coverage cases (AuditForm validation/submit
      states, audits-table routing, dashboard empty state) **do not exist yet** — the
      current suites cover identity/auth plumbing but no component flow tests.
- [ ] CI green cannot be verified: `gh run list` returns no runs for the repo
      (workflow may never have executed on GitHub).
- Gate: `pnpm test` green ([x] locally); CI green ([ ] unverifiable).

## Phase 8 — Cutover (partial — `0bdd9b2`, `f9fef5e`)

1. [x] Prod frontend + Convex deployed: first production deploy verified live
       (`0bdd9b2`, 2026-10-14); prod Convex pushed with the credits work (`f9fef5e`).
2. [ ] Structured smoke run (home audit submit, hub sign-in, dashboard list, audit
       detail, public share) is not recorded; a real-time end-to-end audit has not been
       attested (blocked in part by the missing Lighthouse worker).
3. [x] DNS/alias handled by the infra stack; `ezaudit.sdee3.com` verified live.
4. [~] Laravel decommission is moot for this tree: no Laravel files were ever tracked on
       `master`; the Laravel code is archived on the `feature/laravel-revert` branch
       (pushed to origin). The **pre-Laravel Next.js-era tree is still tracked at the
       repo root** (see Shipped divergences) and is the remaining deletion item.
5. [x] Legacy code archived: `feature/laravel-revert` (Laravel backend + Gh actions)
       plus the full pre-Laravel Next history on `master`.

**Rollback:** the previous CloudFront objects are retained (assets synced without
`--delete`); re-pointing to the prior build and reverting the Convex deploy restores the
previous state. (The deploy script works as specified; rollback was never exercised in
production.)

## Shipped divergences

1. **There was no Laravel `backend/` in this repo.** The Laravel app lives on the
   `feature/laravel-revert` branch (also on origin), not in `master`'s tree. Phase 1's
   "remove the Laravel `backend/` contents" and Phase 8's Python-style decommission
   steps therefore didn't apply as written; the Convex `backend/` was created fresh.
   Laravel leftovers (incl. `database/database.sqlite` with the legacy `audits` rows)
   are parked in the gitignored `.scratch/laravel-leftovers/`.
2. **The pre-Laravel Next.js-era tree is still tracked at the repo root** — `pages/`,
   `components/`, `models/`, `modules/`, `utils/`, `public/`, `next.config.js`,
   `next-env.d.ts`, root `tsconfig.json` (~100 of 207 tracked paths). It is inert (no
   workspace script references it) but it means "frontend/ and backend/ are the only app
   packages" holds only for the workspace, not the whole tree. This is the main
   outstanding Phase 8 deletion item.
3. **`next/head` replaced by an in-house `Head` component**, not `react-helmet` (the
   spec allowed "or equivalent"); Google Analytics is injected at build time via a Vite
   `transformIndexHtml` plugin instead of a runtime conditional.
4. **D1 is not fully live.** No ezaudit Lighthouse Lambda worker exists in the AWS
   account; unless `LIGHTHOUSE_WORKER_URL` is set on a deployment,
   `backend/convex/lib/lighthouse.ts` returns deterministic dev-seed scores, so
   production audits are not yet real Lighthouse results. ADR 0001's decision stands;
   the worker deployment is open work (likely in `../infrastructure`, outside this
   repo).
5. **Legacy data import not executed.** `audits.importLegacy` (ADR 0004) is not
   implemented; the requirement and decision are unchanged.
6. **Spec 06's `ai/guidelines.md` box conflicts with the shipped choice:**
   `backend/convex.json` sets `aiFiles.enabled: false`, so no
   `convex/_generated/ai/guidelines.md` exists and that acceptance box is treated as
   N/A rather than failing.
7. **CI has no recorded runs.** `.github/workflows/checks.yml` exists since `bdd1ace`,
   but `gh run list` for this repo returns nothing — Actions may be disabled on the
   repository. "CI is green" remains unverified.

## Risks

| Risk | Mitigation |
|---|---|
| React 18 vs Chakra v2 vs Clerk SDK version conflict | Pin the Clerk version that supports React 18 (spec 03); spike first |
| `@sdee3/credits` requires React 19 | Don't depend on it for auth; revisit only if credits are adopted |
| Lighthouse cannot run in Convex | Lambda container + Function URL ([ADR 0001](../adr/0001-lighthouse-on-lambda.md)) |
| Server PDF feature loss | Browser print only ([ADR 0002](../adr/0002-pdf-browser-print.md)) |
| Legacy data migration | One-off `importLegacy`, then delete it ([ADR 0004](../adr/0004-migrate-legacy-audits.md)) |
| Shared CloudFront viewer-request allowlist | Use a dedicated `ezaudit-viewer-request` function |
| Local Terraform state loss | Back up `terraform.tfstate`; the `aws/ezaudit` stack is recreatable |
| Exact-UI drift | Port against the archived `702d652` screenshots and the inventory in spec 02 |

## Acceptance criteria for the whole conversion

- [ ] `ezaudit.sdee3.com` serves the exact `702d652` UI. (Prod is live from this tree and
      the screenshots were the port reference, but visual parity is 02's gate and has no
      automated proof.)
- [x] Auth is SDEE3 Identity only; no Firebase/Laravel auth remains. (No firebase/
      Laravel/Sanctum/JWT code anywhere in the tracked tree; Clerk wiring is live.)
- [x] The backend is Convex; no PHP/MySQL/Redis/Pusher/Laravel remains. (Greps over the
      tracked tree excluding `node_modules`/`.scratch`: only comments referencing the
      *legacy* API shape; no runtime artifact.)
- [x] `pnpm build|test|lint|typecheck` verified locally at `f9fef5e`; `pnpm dev` verified
      by inspection (it runs the same two child scripts); both Convex deploys executed
      (dev `899fa27`, prod `f9fef5e`).
- [x] `scripts/deploy-frontend.sh` publishes to S3 + CloudFront. (Live site served from
      S3 via CloudFront with the correct cache classes and headers.)
- [x] Cypress is gone. Frontend and backend tests are Vitest only. (The 702d652 Cypress
      tree exists only in the archive worktree/branch.)
- [ ] The Laravel-era code is archived and removed. (Archived: `feature/laravel-revert`
      + full pre-Laravel history. Removed: **no** — the Next-era tree is still tracked at
      the repo root; the legacy data import is also pending.)
