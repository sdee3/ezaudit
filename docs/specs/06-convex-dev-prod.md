# 06 — Convex DEV and PROD Deployment

**Status:** `partial`

Dev is `dev:bold-orca-397`. Prod is not provisioned (`prod:<ezaudit-prod-ref>` is still a placeholder). The scrubbing wrappers are in `backend/scripts/`; they have not been exercised against a live deploy.

## Requirement

One command deploys the Convex backend to **DEV**, and one to **PROD**, without editing
files or risking a cross-deployment push. Deployment *projects* and their dev/prod
deployments are provisioned by Terraform in `../infrastructure/convex`; **secrets and
deploy keys are never managed by Terraform** — they live in env files and the Convex
dashboard.

## Deployments

| Env | `CONVEX_DEPLOYMENT` | Convex URL (frontend) | Key source |
|---|---|---|---|
| dev | `dev:bold-orca-397` (project `stefan-djokic:ezaudit-91edc`) | `https://bold-orca-397.convex.cloud` | `backend/.env.local` |
| prod | `prod:standing-malamute-74` | `https://standing-malamute-74.convex.cloud` | `backend/.env.production` |

> Dev was provisioned with `npx convex project create ezaudit` + `npx convex dev --configure new --team stefan-djokic --project ezaudit --dev-deployment cloud` (the CLI auto-suffixed the project to `ezaudit-91edc`; the empty `ezaudit` project shell can be deleted from the dashboard). `CLERK_JWT_ISSUER_DOMAIN` is set on the dev deployment (`https://winning-jaybird-28.clerk.accounts.dev`, derived from the shared Clerk dev publishable key).

## Root scripts

```jsonc
{
  "dev": "concurrently -n backend,frontend -c blue,magenta \"pnpm convex:dev\" \"pnpm dev:frontend\"",
  "convex:dev": "pnpm --filter ezaudit-backend dev",
  "convex:deploy": "pnpm --filter ezaudit-backend deploy",
  "convex:deploy:prod": "pnpm --filter ezaudit-backend deploy:prod",
  "convex:env:sync": "cd backend && bash scripts/sync-convex-env.sh",
  "convex:env:sync:prod": "cd backend && bash scripts/sync-convex-env.sh --prod",
  "test:convex": "pnpm --filter ezaudit-backend test"
}
```

## `backend/package.json` scripts

```jsonc
{
  "dev": "convex dev",
  "deploy": "bash scripts/convex-with-env.sh deploy --env-file ../frontend/.env.local",
  "deploy:prod": "bash scripts/convex-with-env.sh --prod deploy",
  "test": "vitest run",
  "typecheck": "tsc --noEmit -p tsconfig.typecheck.json"
}
```

> Unlike astro-mate's `deploy:prod` (a bare `CONVEX_DEPLOYMENT=prod:… convex deploy`),
> both here go through the scrubbing wrapper so prod always pins the key from
> `backend/.env.production`. This closes the asymmetry called out in the astro-mate recon.

## The scrubbing wrapper (`backend/scripts/convex-with-env.sh`)

Three pieces, copied in shape from astro-mate:

1. `load-backend-env.sh` — safe dotenv parser (**never `source`**; deploy keys contain `|`
   and a trailing `=` that bash would mis-parse). Selects `backend/.env.production` with
   `--prod`, else `backend/.env.local`.
2. `convex-with-env.sh` — parses `--prod`, resolves the deployment + key, then runs the CLI
   under a **scrubbed environment**:

   ```bash
   exec env -i PATH="$PATH" HOME="$HOME" USER="$USER" TMPDIR="${TMPDIR:-/tmp}" \
     CONVEX_DEPLOYMENT="$DEPLOYMENT" CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
     npx convex "${ARGS[@]}"
   ```

   `env -i` guards against a stray `export CONVEX_DEPLOY_KEY` in a shared shell silently
   pushing to another app's deployment.
3. `sync-convex-env.sh` — pushes per-env secrets to the selected deployment with
   `convex env set` (the wrapper selects dev vs prod via the same `--prod` switch). Model
   it on astro-mate's `sync-r2-convex-env.sh`.

## Required deployment env vars

Set on the ezaudit Convex deployments (dev and prod), via `convex env set` / dashboard:

| Variable | dev | prod |
|---|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk dev FAPI URL | `https://clerk.sdee3.com` |
| `LIGHTHOUSE_WORKER_URL` | dev Lambda Function URL | prod Lambda Function URL |
| `LIGHTHOUSE_WORKER_SECRET` | dev secret | prod secret |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | dev | prod |
| `CREDITS_SERVICE_SECRET_EZAUDIT` | set 2026-10 (credits display adopted; matches identity dev) | set 2026-10 (matches identity prod) |

Non-secret vars can be `env set`; secrets should be pushed with `convex:env:sync[:prod]`
from the gitignored env files.

## Infrastructure

`../infrastructure/convex` declares the Convex projects and their dev/prod deployments.
Adding ezaudit requires an infra change (see [05-deploy-frontend](./05-deploy-frontend.md)
and the infra recon report). Deploy keys and env vars stay out of Terraform state.

## Acceptance criteria

- [ ] `pnpm convex:dev` watches, codegens, and pushes to the dev deployment only.
- [ ] `pnpm convex:deploy` deploys to dev; `pnpm convex:deploy:prod` deploys to prod.
- [x] Neither command is affected by a stray exported `CONVEX_DEPLOY_KEY`.
- [ ] `pnpm convex:env:sync` / `:prod` set the correct deployment's env from the matching env file.
- [ ] `npx convex ai-files install` output (`convex/_generated/ai/guidelines.md`) is committed.
- [ ] Deploying prod requires passing `pnpm test` first (documented in the runbook).
