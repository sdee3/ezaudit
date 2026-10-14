# 08 — Migration Plan

**Status:** `planned`

## Requirement

Convert EZ Audit from Laravel + Laravel-era React to React 18 + Vite + TypeScript + Convex
+ AWS + SDEE3 Identity **without changing the cherished UI**, in reversible phases, each
with an acceptance gate. The source of truth for the UI is git `702d652`; for conventions
it is `../astro-mate`, `../identity`, and `../infrastructure`.

## Phase overview

| Phase | Deliverable | Gate |
|---|---|---|
| 0 — Archive | `702d652` worktree + screenshots + recon reports | UI baseline reproducible at `:3100` |
| 1 — Scaffold | pnpm workspace, `frontend/` + `backend/` skeletons, env examples | `pnpm install && pnpm build` on a fresh clone |
| 2 — UI port | All routes/components on Vite + React 18 + Chakra v2 + React Router | [02](./02-ui-parity.md) port checklist passes |
| 3 — Auth | SDEE3 Identity hub SSO + Convex JWT | [03](./03-identity-auth.md) acceptance passes |
| 4 — Backend | Convex schema, functions, audit pipeline | [04](./04-backend-convex.md) acceptance passes |
| 5 — Infra + deploy | `aws/ezaudit` stack, `scripts/deploy-frontend.sh` | [05](./05-deploy-frontend.md) acceptance passes |
| 6 — Convex dev/prod | Dev + prod deployments, key plumbing | [06](./06-convex-dev-prod.md) acceptance passes |
| 7 — Tests + CI | Vitest for frontend and backend, CI workflow | [07](./07-testing-and-ci.md) acceptance passes |
| 8 — Cutover | Production deploy, Laravel decommission | Prod smoke + rollback plan |

## Phase 0 — Archive (done)

- [x] Identified `702d652` as the last full-UI revision. Cypress in that tree is not ported.
- [x] Built and served it (`node:18` + pnpm 7); captured 14 screenshots to
      `ezaudit-revive-702/screenshots/`.
- [x] Surveyed `../astro-mate`, `../identity`, `../infrastructure`; reports in
      `.scratch/recon/`.

## Phase 1 — Scaffold

- Create root `package.json` (`private`, `packageManager: pnpm`, `engines.node >= 20`) and
  `pnpm-workspace.yaml` (`frontend`, `backend`).
- Create `frontend/` (Vite + React 18 + TS + Chakra v2) and `backend/` (Convex) skeletons.
- Add `.env.example` files and gitignore the local/prod env files.
- Remove the Laravel `backend/` contents once the Convex backend is functional (keep until
  Phase 4 to allow data migration).

**Gate:** fresh clone → `pnpm install` → `pnpm build` → `pnpm test` (empty) all succeed.

## Phase 2 — UI port

- Port components/routes per [02-ui-parity](./02-ui-parity.md). Do not preserve `data-cy`.
- Replace `next/image`, `next/link`, `next/router`, `next/head` with
  `img`/`Link`/`useNavigate`/`react-helmet` (or equivalent) without changing markup.
- Move the Chakra theme and assets verbatim; load Open Sans + normalize.css + manifest in
  `index.html`.
- Check the port against the archived screenshots in `ezaudit-revive-702/screenshots/`.

**Gate:** the [02](./02-ui-parity.md) port checklist passes.

## Phase 3 — Auth

- Add the Clerk SDK (React-18-compatible version) + hub SSO per
  [03-identity-auth](./03-identity-auth.md).
- Land the identity-repo allowlist changes and Clerk dashboard onboarding.
- Reimplement `useAuthContext` on Clerk while keeping its shape.

**Gate:** hub sign-in round-trips, Convex `getUserIdentity()` works, identity Convex logs
the visit.

## Phase 4 — Backend

- Implement the Convex schema and functions per [04-backend-convex](./04-backend-convex.md).
- D1–D3 and D6 are accepted: Lambda Lighthouse worker, browser-print PDF, Resend, and
  legacy `audits` import. See `docs/adr/`.
- Migrate the Laravel `audits` rows with the one-off `importLegacy` mutation
  ([ADR 0004](../adr/0004-migrate-legacy-audits.md)).

**Gate:** dashboard is fully driven by Convex queries; submissions flow queued → done in
real time; tests pass.

## Phase 5 — Infra + deploy

- Add `aws/ezaudit` and the Convex project/deployments in `../infrastructure`.
- Add `scripts/deploy-frontend.sh` and deploy to `ezaudit.sdee3.com`.

**Gate:** production URL serves the SPA over HTTPS with the correct headers and cache
classes.

## Phase 6 — Convex dev/prod

- Wire dev and prod deployments and the scrubbing wrapper per
  [06-convex-dev-prod](./06-convex-dev-prod.md).

**Gate:** one command per environment; no cross-deployment risk.

## Phase 7 — Tests + CI

- Add frontend and backend Vitest suites per [07-testing-and-ci](./07-testing-and-ci.md).
  Delete Cypress. Do not add Playwright.

**Gate:** `pnpm test` and CI are green.

## Phase 8 — Cutover

1. Deploy prod frontend + Convex.
2. Smoke test: home audit submit, hub sign-in, dashboard list, audit detail, public share.
3. Point DNS/alias (already handled by the infra stack) and verify.
4. Keep Laravel running until prod smoke passes; then delete `backend/` Laravel files,
   the Laravel Docker Compose, MySQL/Redis config, and the old `frontend/`.
5. Archive the Laravel code on a git branch/tag before deletion.

**Rollback:** the previous CloudFront objects are retained (assets synced without
`--delete`); re-pointing to the prior build and reverting the Convex deploy restores the
previous state.

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

- [ ] `ezaudit.sdee3.com` serves the exact `702d652` UI.
- [ ] Auth is SDEE3 Identity only; no Firebase/Laravel auth remains.
- [ ] The backend is Convex; no PHP/MySQL/Redis/Pusher/Laravel remains.
- [ ] `pnpm dev|build|test|lint|typecheck` and both Convex deploys work.
- [ ] `scripts/deploy-frontend.sh` publishes to S3 + CloudFront.
- [ ] Cypress is gone. Frontend and backend tests are Vitest only.
- [ ] The Laravel-era code is archived and removed.
