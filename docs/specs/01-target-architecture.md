# 01 — Target Architecture

**Status:** `planned`

## Goal

Rebuild EZ Audit as two cleanly isolated packages on the SDEE3 stack:

- **`frontend/`** — a Vite SPA (React 18, TypeScript, Chakra UI v2) that renders the
  *exact* UI from `702d652`.
- **`backend/`** — a Convex deployment that owns all data, business logic, queued audit
  processing, and auth validation.

The Laravel app under `backend/` and the Laravel-era `frontend/` are replaced, not
extended. Nothing from the Laravel stack survives except the product requirements and
the archived UI.

## Non-goals

- No UI redesign. See [02-ui-parity](./02-ui-parity.md).
- No React 19 upgrade. React is pinned to 18.3.x for Chakra v2 compatibility.
- No self-managed servers, Docker Compose, MySQL, Redis, or PHP in the target runtime.
- No monorepo package sharing with `../identity` beyond the published `@sdee3/credits`
  package (see [03-identity-auth](./03-identity-auth.md)).

## Stack pins

| Layer | Choice |
|-------|--------|
| Runtime | Node >= 20 (match sibling repos) |
| Package manager | pnpm (single root workspace) |
| Frontend build | Vite |
| Language | TypeScript (strict on new code) |
| UI | React **18.3.x** + Chakra UI v2 + `@emotion/react` + `@emotion/styled` + `react-icons` |
| Routing | `react-router-dom` v7 |
| Forms | `react-hook-form` |
| Cookies/consent | `react-cookie`, `react-cookie-consent` |
| Backend | Convex |
| Auth | SDEE3 Identity (Clerk-issued JWT validated by Convex) |
| Hosting | S3 (private) + CloudFront (OAC), ACM cert, viewer-request function |

## Package boundaries (clean isolation)

Rules, enforced mechanically:

1. `frontend/` may import backend code **only** through Convex-generated artifacts
   (`convex/_generated/api`, `convex/_generated/dataModel`) and explicitly shared
   `backend/convex/lib/*` helpers. This is enforced with a tsconfig path map, mirroring
   astro-mate's frontend→backend boundary.
2. `backend/` never imports anything from `frontend/`.
3. No barrel file re-exports across the boundary; no relative `../../backend/...` imports
   from arbitrary frontend files.
4. No secrets in either package's committed files. `.env.local` is gitignored;
   `.env.production` is generated at deploy time.

## Root workspace

`package.json` (root) exposes the developer entry points:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | run Convex dev + Vite dev concurrently |
| `pnpm dev:frontend` | Vite only |
| `pnpm convex:dev` | `convex dev` from `backend/` |
| `pnpm build` | production frontend build |
| `pnpm test` | frontend + backend tests |
| `pnpm lint` / `pnpm typecheck` | repo-wide checks |
| `pnpm convex:deploy` | deploy to Convex **DEV** |
| `pnpm convex:deploy:prod` | deploy to Convex **PROD** |

`pnpm-workspace.yaml` lists `frontend` and `backend`.

## Environment separation

| File | Scope | Committed? |
|------|-------|------------|
| `frontend/.env.local` | Vite dev vars (`VITE_*`) | no |
| `frontend/.env.example` | documented var names | yes |
| `frontend/.env.production` | written by `scripts/deploy-frontend.sh` | no |
| `backend/.env.local` | Convex dev vars / deploy key | no |
| `backend/.env.production` | Convex prod vars / deploy key | no |
| `scripts/.env` | `BUCKET`, `DISTRIBUTION_ID`, `REGION`, `DIST_DIR` | no |

Full var tables live in specs 03–06.

## Acceptance criteria

- [ ] Root `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` all pass on a fresh clone.
- [ ] `frontend/` and `backend/` are the only app packages; no Laravel/PHP files remain.
- [ ] The tsconfig path map makes any frontend import outside the allowed Convex boundary a compile error.
- [ ] No committed file contains a secret; every env var is documented in an `.env.example`.
- [ ] `pnpm convex:deploy` and `pnpm convex:deploy:prod` target distinct deployments without editing files.
