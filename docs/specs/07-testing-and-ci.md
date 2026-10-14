# 07 — Testing and CI

**Status:** `planned`

## Requirement

Vitest is the only test runner. It covers the frontend and the backend. Cypress is
deleted and not replaced. There is no Playwright suite, no browser end-to-end suite,
and no pixel-diff gate.

The three Cypress specs at `702d652` describe behavior. That behavior is covered by
component and unit tests, with Convex and Clerk mocked.

## Cypress → Vitest

| Cypress spec (deleted) | What it asserted | Vitest coverage |
|---|---|---|
| `cypress/integration/pages/homepage.ts` | submit disabled on an invalid domain; enabled on a valid one; a successful submit shows the alert | `AuditForm` validation and submit states. Mock the Convex mutation. |
| `cypress/integration/pages/audits.ts` | audits table visible; row click routes to `/dashboard/audits/:id` | render the audits table under `MemoryRouter` with a mocked query |
| `cypress/integration/auth/userDashboard.ts` | dashboard button → `/dashboard` → sign-in form → view audits → empty state | signed-out dashboard and empty audits list, Clerk hooks mocked |

`data-cy` selectors are not part of the new suite. Tests query by role, label, and text.

## Frontend (Vitest)

- Config: `frontend/vitest.config.ts`, `environment: "jsdom"`, `include:
  ["src/**/*.{test,spec}.{ts,tsx}"]`, alias `@` and the `convex/*` path maps (so Vitest
  resolves the same boundary as Vite/tsc).
- Co-locate tests next to the component. No separate integration-test directory.
- Mock `convex/react` and the Clerk hooks. Render under `MemoryRouter`.
- Cover: `AuditForm` validation and submit states, `AuditResult` owner vs public
  rendering, `NoResults` variants, `Breadcrumbs` and `Footer` print hiding.

## Backend (Vitest + convex-test)

- Config: `backend/vitest.config.ts`, `environment: "edge-runtime"`,
  `include: ["convex/**/*.test.ts"]`.
- `backend/test/createConvexTest.ts` wires `import.meta.glob("../convex/**/*.ts")` and
  any components; stub env with `vi.stubEnv`.
- Authenticate with `t.withIdentity({ subject: "user_1" })`.
- Cover: `audits.submit` validation, `listMine` ordering and ownership, `get`
  public/private gating, `setVisibility` owner check, pipeline status transitions
  (Lighthouse worker mocked).

## CI (`.github/workflows/checks.yml`)

Single workflow on push and pull requests:

1. checkout
2. `pnpm/action-setup`
3. `actions/setup-node` with pnpm cache
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm typecheck`
7. `pnpm test` (frontend Vitest + backend Vitest)

> Note from the astro-mate recon: its CI additionally clones the private `sdee3/identity`
> repo to build the `file:` `@sdee3/credits` dependency, driven by the `IDENTITY_DEPLOY_KEY`
> secret. **EZ Audit avoids that** by not depending on `@sdee3/credits` (spec 03), so CI
> stays self-contained. If credits are later adopted, this step must be added.

## Local commands

| Command | Purpose |
|---|---|
| `pnpm test` | frontend + backend Vitest |
| `pnpm test:convex` | backend Vitest only |
| `pnpm lint` / `pnpm typecheck` | repo-wide |

## Acceptance criteria

- [ ] The three former Cypress flows are covered by the Vitest cases in the table above.
- [ ] `pnpm test` passes on a fresh clone with no `.env.local`.
- [ ] Backend tests run under `edge-runtime` and cover auth failure paths.
- [ ] CI is green on push and pull requests; no private-repo clone step is required.
- [ ] Cypress, `cypress.json`, and any Playwright dependency or parity script are absent.
