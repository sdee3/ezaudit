# 01 — Target Architecture

**Status:** `partial` (verified at HEAD `ddef9c6` on 2026-10-20; open: the legacy Next.js tree at the repo root) — workspace + isolation live and verified; deploy scripts shipped (f34d0aa, 9a2d53f, 1cc7a84); the frontend was deployed to production (0bdd9b2), and the Terraform stack it deploys against lives in the sibling `infrastructure` repo at `aws/ezaudit` (see Shipped divergences). One caveat remains, recorded there: the legacy Next.js package tree still sits at the repo root.

## Goal

Rebuild EZ Audit as two cleanly isolated packages on the SDEE3 stack:

- **`frontend/`** — a Vite SPA (React 18, TypeScript, Chakra UI v2) that renders the
  *exact* UI from `702d652`. ✅ Scaffolded with the UI port (`73e7548 feat: scaffold the Vite workspace and port the 702d652 UI`); exact-parity rendering is spec 02's concern.
- **`backend/`** — a Convex deployment that owns all data, business logic, queued audit
  processing, and auth validation. ✅ (`899fa27 feat(backend): Convex audits domain — schema, auth config, functions, pipeline, tests`); wired to the real frontend in `2c884dd`.

The Laravel app under `backend/` and the Laravel-era `frontend/` are replaced, not
extended. Nothing from the Laravel stack survives except the product requirements and
the archived UI.

> **Note.** The repo's actual predecessor tree is the pre-Laravel Next.js app at the
> repo root (see Shipped divergences); no PHP/Laravel files are tracked, so the
> replacement outcome holds even where the description's "Laravel" wording doesn't
> match history.

## Non-goals

- No UI redesign. See [02-ui-parity](./02-ui-parity.md).
- No React 19 upgrade. React is pinned to 18.3.x for Chakra v2 compatibility. ✅ `frontend/package.json` pins `react`/`react-dom` to `18.3.1`.
- No self-managed servers, Docker Compose, MySQL, Redis, or PHP in the target runtime. ✅ No PHP/Docker/MySQL/Redis code or config is tracked.
- No monorepo package sharing with `../identity` beyond the published `@sdee3/credits`
  package (see [03-identity-auth](./03-identity-auth.md)). ✅ No workspace dep on
  `../identity`; the only cross-repo reach is `scripts/deploy-frontend.sh` sourcing
  `identity/shared/clerk-csp.sh` and `../infrastructure` (see Shipped divergences).

## Stack pins

| Layer | Choice | Verified |
|-------|--------|----------|
| Runtime | Node >= 20 (match sibling repos) | ✅ root `package.json` `engines.node: ">=20"`; CI pins Node 20 |
| Package manager | pnpm (single root workspace) | ✅ `packageManager: pnpm@12.6.0`, `pnpm-workspace.yaml` |
| Frontend build | Vite | ✅ `vite ^8.3.4` + rolldown config; `pnpm build` runs clean |
| Language | TypeScript (strict on new code) | ✅ strict in `frontend/tsconfig.json`, `backend/tsconfig.json`, backend typecheck project |
| UI | React **18.3.x** + Chakra UI v2 + `@emotion/react` + `@emotion/styled` + `react-icons` | ✅ all in `frontend/package.json` |
| Routing | `react-router-dom` v7 | ✅ `^7.9.4` |
| Forms | `react-hook-form` | ✅ `^7.63.0` |
| Cookies/consent | `react-cookie`, `react-cookie-consent` | ✅ `^8.1.2` / `^10.0.2` |
| Backend | Convex | ✅ `convex ^1.47.0` in both packages |
| Auth | SDEE3 Identity (Clerk-issued JWT validated by Convex) | ✅ `@clerk/react ^6.17.8`; `backend/convex/auth.config.ts` |
| Hosting | S3 (private) + CloudFront (OAC), ACM cert, viewer-request function | ✅ live; Terraform in sibling `../infrastructure/aws/ezaudit`; `scripts/deploy-frontend.sh` does env-write → build → S3 sync/upload → CloudFront invalidation |

## Package boundaries (clean isolation)

Rules, enforced mechanically:

1. `frontend/` may import backend code **only** through Convex-generated artifacts
   (`convex/_generated/api`, `convex/_generated/dataModel`) and explicitly shared
   `backend/convex/lib/*` helpers. This is enforced with a tsconfig path map, mirroring
   astro-mate's frontend→backend boundary. ✅ `frontend/tsconfig.json` maps exactly those
   three prefixes onto `../backend/convex/*`; `vite.config.ts` mirrors the same map as
   resolve aliases for bundling. Verified in source: the only backend imports are
   `convex/_generated/*`, `convex/react`, `convex/react-clerk`, `convex/server`.
2. `backend/` never imports anything from `frontend/`. ✅ Not enforced by a tsconfig knob,
   but verified by inspection and `grep -rn "frontend" backend/convex` (comment
   references only).
3. No barrel file re-exports across the boundary; no relative `../../backend/...` imports
   from arbitrary frontend files. ✅ `grep -rn "../backend" frontend/` matches only the
   boundary definitions themselves (`tsconfig.json` path map, `vite.config.ts` aliases);
   no source files reach into the backend tree.
4. No secrets in either package's committed files. `.env.local` is gitignored;
   `.env.production` is generated at deploy time. ✅ Both are in `.gitignore`;
   `scripts/deploy-frontend.sh` `write_production_env()` writes
   `frontend/.env.production` and `backend/scripts/load-backend-env.sh` loads the backend
   pair as dotenv (never `source`). Grep for `pk_live/pk_test/sk_live/sk_test/prod:`
   shapes over tracked files found only placeholders in `.env.example` files and prose.

## Root workspace

`package.json` (root) exposes the developer entry points:

| Script | Purpose | Verified |
|--------|---------|----------|
| `pnpm dev` | run Convex dev + Vite dev concurrently | ✅ `concurrently` wrapping `convex:dev` + `dev:frontend` (both child commands individually verified; dev server session not run here) |
| `pnpm dev:frontend` | Vite only | ✅ `pnpm --filter ezaudit-frontend dev` |
| `pnpm convex:dev` | `convex dev` from `backend/` | ✅ `pnpm --filter ezaudit-backend dev` |
| `pnpm build` | production frontend build | ✅ runs locally clean (`✓ built in 184ms`, 15-entry PWA precache) |
| `pnpm test` | frontend + backend tests | ✅ 19 frontend + 15 backend tests passing (2026-10-20) |
| `pnpm lint` / `pnpm typecheck` | repo-wide checks | ✅ both exit clean (backends' `lint`/`typecheck` are TS checks; frontend lints with `eslint src`) |
| `pnpm convex:deploy` | deploy to Convex **DEV** | ✅ `pnpm --filter ezaudit-backend deploy` → `convex-with-env.sh deploy` with `CONVEX_DEPLOYMENT=dev:bold-orca-397` default |
| `pnpm convex:deploy:prod` | deploy to Convex **PROD** | ✅ `deploy:prod` → same wrapper in `--prod` mode, needing `CONVEX_DEPLOYMENT=prod:<ref>` in `backend/.env.production` |

Also present (not in the spec's table — noted, spec unchanged): `convex:env:sync` /
`convex:env:sync:prod` (push Clerk/Lighthouse/Resend/Credits deploy envs through
`backend/scripts/sync-convex-env.sh`) and `test:convex`.

`pnpm-workspace.yaml` lists `frontend` and `backend`. ✅ (plus pnpm `allowBuilds` allowlisting esbuild).

## Environment separation

| File | Scope | Committed? | Verified |
|------|-------|------------|----------|
| `frontend/.env.local` | Vite dev vars (`VITE_*`) | no | ✅ gitignored |
| `frontend/.env.example` | documented var names | yes | ✅ GA, Clerk, Convex, app origin, identity Convex URL |
| `frontend/.env.production` | written by `scripts/deploy-frontend.sh` | no | ✅ heredoc in the script |
| `backend/.env.local` | Convex dev vars / deploy key | no | ✅ gitignored |
| `backend/.env.production` | Convex prod vars / deploy key | no | ✅ gitignored |
| `scripts/.env` | `BUCKET`, `DISTRIBUTION_ID`, `REGION`, `DIST_DIR` | no | ✅ gitignored; `.env.example` documents all four |

Full var tables live in specs 03–06.

## Acceptance criteria

- [x] Root `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` all pass on a fresh clone.
  (Verified locally for build/test/lint/typecheck; `pnpm dev` verified by inspection of
  its two child commands only. The fresh-clone claim is further backed by CI
  (bdd1ace): frozen-lockfile install + lint + typecheck + test on every push/PR.)
- [ ] `frontend/` and `backend/` are the only app packages; no Laravel/PHP files remain.
  (Second half holds — no PHP/Laravel files are tracked. First half does not hold
  literally: the legacy Next.js app still sits at the repo root — 57 of 221 tracked files
  (`pages/`, `components/`, `models/`, `modules/`, `utils/`, `public/`, root
  `tsconfig.json`, `next.config.js`, root `.env.example`. See Shipped divergences 1.)
- [x] The tsconfig path map makes any frontend import outside the allowed Convex boundary a compile error.
  (`frontend/tsconfig.json` maps only the three allowed prefixes; source inspection
  confirms imports stay within them. pnpm test/lint/typecheck green.)
- [x] No committed file contains a secret; every env var is documented in an `.env.example`.
  (grep for `pk_live|pk_test|sk_live|sk_test|prod:<name>|…` secret shapes across
  tracked files → only `REPLACE_ME` placeholders in `.env.example` files and doc prose;
  committed env docs exist in `frontend/.env.example`, `backend/.env.example`,
  `scripts/.env.example`, `.env.example`.)
- [x] `pnpm convex:deploy` and `pnpm convex:deploy:prod` target distinct deployments without editing files.
  (`backend/package.json` maps them to two scripts; `backend/scripts/convex-with-env.sh`
  reads `backend/.env.local` vs `backend/.env.production`, dev defaults
  `CONVEX_DEPLOYMENT=dev:bold-orca-397` when unset, prod requires an explicit
  `prod:<ref>`; deploys run under a scrubbed env so a stray parent `CONVEX_DEPLOY_KEY`
  can't select another deployment.)

## Shipped divergences

1. **Legacy Next.js package still at the repo root.** The predecessor tree is the
   original Next.js app sitting directly in the repo root — `pages/`, `components/`,
   `models/`, `modules/`, `utils/`, `public/`, root `tsconfig.json`, `next.config.js`,
   root `.env.example` and ESLint config — 57 of 221 tracked files. It is not wired
   into the workspace scripts and is not part of the target app, but it still means
   `frontend/` and `backend/` are not literally "the only app packages" at the repo
   root, which keeps that acceptance criterion unchecked. Requirement text left as-is;
   the remaining work is deleting this tree (plus the root `tsconfig.json` /
   `next.config.js`, which currently include `next-env.d.ts` and exclude `frontend`/
   `backend`).
2. **Terraform wrapper trio lives in a sibling repo, not here.** There is no
   `infrastructure/` directory in this repo; the S3+CloudFront+ACM stack (with
   `viewer-request.js`, `tf.sh`, `load-env.sh` — the "wrapper trio" this spec's status
   line referred to as "pending") is Terraform in `../infrastructure/aws/ezaudit`,
   including a root `public/*` guard. `scripts/.env.example` points `DISTRIBUTION_ID`
   at that repo's outputs, and commit 0bdd9b2 records the production deploy as verified
   live. Same infrastructure, different parent directory than this spec originally
   implied.
3. **Dev Convex deploy leans on a file outside this spec's table.**
   `backend/package.json` `deploy` passes `--env-file ../frontend/.env.local` around the
   Convex CLI rather than only relying on Convex's standard env-file semantics —
   intentional (commit 1cc7a84, pinned via `convex-with-env.sh`), but it means the dev
   deployment selection depends on a file whose documented role here is "Vite dev
   vars". No requirement change proposed; just a coupling worth knowing when pruning
   legacy files.
