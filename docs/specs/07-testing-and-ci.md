# 07 — Testing and CI

**Status:** `partial` — backend Vitest + convex-test is done and verified (15 passing tests at HEAD `ddef9c6`). Frontend has Vitest unit tests for `lib`/`utils`, a session-guard component test, and a route/theme smoke test, but not the component tests the spec lists. The CI workflow matches the spec, plus a worker check step. GitHub Actions runs of `checks` succeed on `master` (verified 2026-10-20).

## Requirement

Vitest is the only test runner. It covers the frontend and the backend. Cypress is
deleted and not replaced. There is no Playwright suite, no browser end-to-end suite,
and no pixel-diff gate.

The three Cypress specs at `702d652` describe behavior. That behavior is covered by
component and unit tests, with Convex and Clerk mocked.

## Cypress → Vitest

| Cypress spec (deleted) | What it asserted | Vitest coverage | Shipped? |
|---|---|---|---|
| `cypress/integration/pages/homepage.ts` | submit disabled on an invalid domain; enabled on a valid one; a successful submit shows the alert | `AuditForm` validation and submit states. Mock the Convex mutation. | **No matching test.** Only the backend's `audits.submit` validation (`audits.test.ts`) covers domain validation. No `AuditForm` component test exists. |
| `cypress/integration/pages/audits.ts` | audits table visible; row click routes to `/dashboard/audits/:id` | render the audits table under `MemoryRouter` with a mocked query | **No matching test.** |
| `cypress/integration/auth/userDashboard.ts` | dashboard button → `/dashboard` → sign-in form → view audits → empty state | signed-out dashboard and empty audits list, Clerk hooks mocked | **No matching test.** Route paths themselves are pinned by `smoke.test.ts`. |

`data-cy` selectors are not part of the new suite. Tests query by role, label, and text.
(Currently moot: the suite has one component test, and it does not query the DOM by
selector.)

## As-shipped test inventory (HEAD `ddef9c6`, verified 2026-10-20)

Frontend — 6 files, 19 tests, all passing (`pnpm test`):

| Test file | Covers |
|---|---|
| `frontend/src/smoke.test.ts` | Route table still matches `702d652` (`ROUTES.*`, `/dashboard/audits/:id` shape) and the Chakra color tokens (`#1976d2` family). |
| `frontend/src/lib/identity.test.ts` | SDEE3 Identity hub URL builders (sign-in / sign-up / account), sign-in ticket reading from both param names, ticket stripping preserving other params, remembered-redirect-path consume-once semantics. Env stubbed with `vi.stubEnv`. |
| `frontend/src/lib/identityCreditsApi.test.ts` | Cross-repo contract: the vendored `users:upsertFromClient` / `credits/queries:getBalance` function paths match the identity deployment. |
| `frontend/src/components/ConvexSessionGuard/ConvexSessionGuard.test.tsx` | Session guard renders the home page without waiting on the Clerk session (`968f855`). |
| `frontend/src/utils/authErrors.test.ts` | `isAuthQueryError` detects "Not authenticated" Convex errors and rejects non-error values. |
| `frontend/src/utils/publicRoutes.test.ts` | App-shell vs public-shell route classification, including `/dashboard/*` behind the session handshake and unknown-path catch-all. |

Backend — 1 file, 15 tests, all passing:

| Test file | Covers |
|---|---|
| `backend/convex/audits.test.ts` | `submit` creates a queued ownerless audit without auth; domain/email validation failure paths; scheduled pipeline run reaching `done` with one `auditJobs` row; `listMine` ordering (newest first) and ownership; `listMine` auth failure; `get` public/private gating (signed-out, other-user, owner); `setVisibility` auth + ownership + toggle; pipeline error path with `LIGHTHOUSE_WORKER_URL` stubbed via `vi.stubEnv` and `fetch` mocked to fail (3 attempts, all `error`); `internal.auditPipeline.retry` completing an errored audit; `toWorkerUrl` adds `https://` only when the scheme is missing. |

## Frontend (Vitest)

- Config: `frontend/vitest.config.ts`, `environment: "jsdom"`, `include:
  ["src/**/*.{test,spec}.{ts,tsx}"]`, alias `@` and the `convex/*` path maps (so Vitest
  resolves the same boundary as Vite/tsc).
- Co-locate tests next to the component. No separate integration-test directory.
- Mock `convex/react` and the Clerk hooks. Render under `MemoryRouter`.
- Cover: `AuditForm` validation and submit states, `AuditResult` owner vs public
  rendering, `NoResults` variants, `Breadcrumbs` and `Footer` print hiding.

> Shipped diverges from this section — see below.

## Backend (Vitest + convex-test)

- Config: `backend/vitest.config.ts`, `environment: "edge-runtime"`,
  `include: ["convex/**/*.test.ts"]`.
- `backend/test/createConvexTest.ts` wires `import.meta.glob("../convex/**/*.ts")` and
  any components; stub env with `vi.stubEnv`.
- Authenticate with `t.withIdentity({ subject: "user_1" })`.
- Cover: `audits.submit` validation, `listMine` ordering and ownership, `get`
  public/private gating, `setVisibility` owner check, pipeline status transitions
  (Lighthouse worker mocked).

This section matches the shipped code, with two trivial notes: the glob additionally
excludes the `*.test.ts` files themselves (`!<glob>` entry, required by convex-test's
`_generated` wiring), and `vi.stubEnv`/`vi.stubGlobal` live in `audits.test.ts` rather
than the wiring file. `t.withIdentity({ subject: "user_1" })` (and `user_2`) is used as
specified. Lighthouse worker mocking is done by stubbing `fetch` when the scheduler runs.

## Worker (`workers/lighthouse-worker`)

`node --test address-filter.test.mjs` runs 13 cases for the public-address filter. CI runs
them in the worker check step. The worker has no Vitest suite.

## CI (`.github/workflows/checks.yml`)

Single workflow on push and pull requests:

1. checkout
2. `pnpm/action-setup`
3. `actions/setup-node` with pnpm cache
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm typecheck`
7. `pnpm test` (frontend Vitest + backend Vitest)
8. Worker checks: `npm ci` in `workers/lighthouse-worker`, `node --check` on four worker files, and `npm test` there

The workflow sets `actions/setup-node` to `node-version: 20`. There is no identity-repo
clone step. `gh run list` shows five successful `checks` runs on `master` through
2026-10-20.

> Note from the astro-mate recon: its CI additionally clones the private `sdee3/identity`
> repo to build the `file:` `@sdee3/credits` dependency, driven by the `IDENTITY_DEPLOY_KEY`
> secret. **EZ Audit avoids that** by not depending on `@sdee3/credits` (spec 03), so CI
> stays self-contained. Credits (2026-10 display adoption) are vendored precisely so this
> remains true — no identity-clone CI step was added. (Verified: no clone step in
> `checks.yml`, no `@sdee3/credits` in any `package.json`.)

## Local commands

| Command | Purpose | Verified |
|---|---|---|
| `pnpm test` | frontend + backend Vitest | yes — 19 + 15 tests pass (2026-10-20) |
| `pnpm test:convex` | backend Vitest only | present at root `package.json`; not run separately |
| `pnpm lint` / `pnpm typecheck` | repo-wide | exit 0 (2026-10-20) |

## Shipped divergences

1. **Frontend Vitest config** (`frontend/vitest.config.ts`): ships `environment: 'node'`,
   not `jsdom`; ships no `@` alias and no `convex/*` path map; adds
   `passWithNoTests: true`. Consistent with the absence of most component tests, but it does
   not match this spec's config bullets. (Backend config ships exactly as specified,
   `edge-runtime` + `convex/**/*.test.ts`, plus `passWithNoTests: true`.)
2. **Frontend coverage**: one component test exists (`ConvexSessionGuard`). The rest are
   missing: no `AuditForm`, `AuditResult` owner/public rendering, `NoResults` variants, or
   `Breadcrumbs`/`Footer` print tests; no `convex/react` or Clerk mocks; no `MemoryRouter`
   renders. The suite instead grew unit tests for routing/session handshake utilities
   (`publicRoutes`), auth error handling (`authErrors`), the identity-hub URL builders
   (`identity`), the credits API contract (`identityCreditsApi`), and a route/theme smoke
   test — all added after this spec was written (auth-drift and credits work), all within
   `src/**/*.{test,spec}.{ts,tsx}`.
3. **Co-location**: unit tests co-locate next to the `lib/` and `utils/` modules they
   test, and `smoke.test.ts` lives at `src/` root; no separate integration-test directory
   exists. The `backend/test/` directory holds only the convex-test wiring, and
   `audits.test.ts` is co-located under `convex/` as specified.
4. **`createConvexTest.ts`**: ships `import.meta.glob(["../convex/**/*.ts", "!../convex/**/*.test.ts"])`
   (tests excluded so convex-test can locate the `_generated` modules). Comment in the
   file says nothing under `convex/` may be excluded except the tests themselves.
5. `pnpm-lock.yaml` declares `@vitest/browser-playwright` as an **optional peer
   dependency** of `vitest@5.0.4` — a lockfile metadata entry, not an installed
   dependency or a Playwright suite. `.gitignore` lists `.playwright-mcp/` (agent
   session dumps, not test tooling). Neither violates the "no Playwright suite /
   no browser e2e / no pixel-diff gate" requirement.

## Acceptance criteria

- [ ] The three former Cypress flows are covered by the Vitest cases in the table above.
- [ ] `pnpm test` passes on a fresh clone with no `.env.local`. (`pnpm test` passes
      locally — 19 frontend + 15 backend tests — with `frontend/.env.local` present;
      the fresh-clone / no-`.env.local` scenario was not reproduced. Nothing in the test
      files reads `.env.local` at module load: `identity.test.ts` stubs its own env vars.)
- [x] Backend tests run under `edge-runtime` and cover auth failure paths.
      (`backend/vitest.config.ts` proves the environment; `audits.test.ts` proves
      unauthenticated + non-owner rejection paths.)
- [x] CI is green on push and pull requests; no private-repo clone step is required.
      (`checks` succeeded on the last five pushes to `master`, through 2026-10-20.
      The workflow has no clone step.)
- [x] Cypress, `cypress.json`, and any Playwright dependency or parity script are absent.
      (Repo-wide grep excluding `node_modules`/.scratch: no Cypress code, config, or deps
      anywhere; commits `73e7548` onward started Vite/Vitest from scratch. See divergence 5
      for the lockfile peer-entry and `.gitignore` notes, which are not test tooling.)
