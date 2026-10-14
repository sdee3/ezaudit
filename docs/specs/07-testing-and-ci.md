# 07 — Testing and CI

**Status:** `planned`

## Requirement

The converted app keeps automated coverage of the flows the Cypress suite protected, adds
the UI-parity gate from [02-ui-parity](./02-ui-parity.md), and runs the same
lint/typecheck/test gates as the sibling repos.

## Cypress → target mapping

The source suite (`702d652`) has three specs. They are re-expressed as Playwright tests
(they are end-to-end UI flows) plus fast Vitest unit tests where practical.

| Cypress spec | Asserts | Target |
|---|---|---|
| `cypress/integration/pages/homepage.ts` | submit disabled on invalid domain; enabled on valid; `/api/audit` POST shows `[data-cy=alert]` | Playwright E2E + Vitest for the form's validation rules |
| `cypress/integration/pages/audits.ts` | `auditsTable` visible; row click routes to `/dashboard/audits/:id` | Playwright E2E (mocked Convex or seeded test deployment) |
| `cypress/integration/auth/userDashboard.ts` | `userDashboardBtn` click → `/dashboard` → sign-in form → `viewAuditsBtn` → `/dashboard/audits` → empty state | Playwright E2E via hub SSO (or a direct-Clerk test mode) |

All `data-cy` selectors listed in spec 02 remain the test contract.

## Frontend unit/component tests (Vitest)

- Config: `frontend/vitest.config.ts`, `environment: "jsdom"`, `include:
  ["src/**/*.{test,spec}.{ts,tsx}"]`, alias `@` and the `convex/*` path maps (so Vitest
  resolves the same boundary as Vite/tsc).
- Co-locate tests with components; integration tests under `src/test/`.
- Mock `convex/react` and the Clerk hooks; render under `MemoryRouter`.
- Cover: `AuditForm` validation + submit states, `AuditResult` owner vs public rendering,
  `NoResults` variants, `Breadcrumbs`/`Footer` print hiding.

## Backend tests (Vitest + convex-test)

- Config: `backend/vitest.config.ts`, `environment: "edge-runtime"`,
  `include: ["convex/**/*.test.ts"]`.
- `backend/test/createConvexTest.ts` wires `import.meta.glob("../convex/**/*.ts")` and any
  components; stub env with `vi.stubEnv`.
- Authenticate with `t.withIdentity({ subject: "user_1" })`.
- Cover: `audits.submit` validation, `listMine` ordering + ownership, `get` public/private
  gating, `setVisibility` owner check, pipeline status transitions (worker mocked).

## Playwright

The sibling repos use Playwright as an **ad-hoc script harness** (no `@playwright/test`
config), run with `node --experimental-strip-types`. Adopt the same:

- `scripts/parity-capture.mts` — screenshot every route/state from both the source app
  (`ezaudit-revive-702`, `:3100`) and the converted app against identical mock data.
- `scripts/parity-diff.mts` — pixel-compare the pairs; fail on visible diff.
- `scripts/auth-playwright.mts` — sign-in helper for seeded runs (adapt astro-mate's).

Local dev can use a direct-Clerk mode (like astro-mate's `VITE_CLERK_DIRECT_SIGN_IN=true`)
to avoid the hub round-trip in tests.

## CI (`.github/workflows/checks.yml`)

Single workflow on push to `main` and PRs:

1. checkout
2. `pnpm/action-setup`
3. `actions/setup-node` with pnpm cache
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm typecheck`
7. `pnpm test` (frontend + backend)
8. (optional, non-blocking initially) `pnpm test:parity`

> Note from the astro-mate recon: its CI additionally clones the private `sdee3/identity`
> repo to build the `file:` `@sdee3/credits` dependency, driven by the `IDENTITY_DEPLOY_KEY`
> secret. **EZ Audit avoids that** by not depending on `@sdee3/credits` (spec 03), so CI
> stays self-contained. If credits are later adopted, this step must be added.

## Local commands

| Command | Purpose |
|---|---|
| `pnpm test` | frontend + backend unit tests |
| `pnpm test:convex` | backend only |
| `pnpm lint` / `pnpm typecheck` | repo-wide |
| `node --experimental-strip-types scripts/parity-capture.mts` | capture source + target screenshots |
| `node --experimental-strip-types scripts/parity-diff.mts` | pixel-diff gate |

## Acceptance criteria

- [ ] Every Cypress assertion in the table has a passing Playwright equivalent.
- [ ] `pnpm test` passes on a fresh clone with no `.env.local`.
- [ ] Backend tests run under `edge-runtime` and cover auth failure paths.
- [ ] The parity gate runs and reports a pass against the `702d652` baseline.
- [ ] CI is green on `main` and PRs; no private-repo clone step is required.
- [ ] Cypress and its config are removed from the repo once the Playwright suite is green.
