# 06 — Convex DEV and PROD Deployment

**Status:** `partial`

Dev is `dev:bold-orca-397`. Prod is provisioned as `prod:standing-malamute-74`
(both present in `../infrastructure/convex` state). The scrubbing wrappers are in
`backend/scripts/` (added in `1cc7a84`) and are wired into `package.json`. Both ran
against `standing-malamute-74` on 2026-10-20. `backend/.env.production` (the prod key
source) exists locally and is gitignored. Recreate it with
`npx convex deployment token create <name> --prod --save-env .env.production`.

## Requirement

One command deploys the Convex backend to **DEV**, and one to **PROD**, without editing
files or risking a cross-deployment push. Deployment *projects* and their dev/prod
deployments are provisioned by Terraform in `../infrastructure/convex`; **secrets and
deploy keys are never managed by Terraform** — they live in env files and the Convex
dashboard.

## Deployments

| Env | `CONVEX_DEPLOYMENT` | Convex URL (frontend) | Key source |
|---|---|---|---|
| dev | `dev:bold-orca-397` (project `ezaudit`) | `https://bold-orca-397.convex.cloud` | `backend/.env.local` |
| prod | `prod:standing-malamute-74` | `https://standing-malamute-74.convex.cloud` | `backend/.env.production` (not yet created) |

> Both deployments verified against `../infrastructure/convex/terraform.tfstate`
> (`convex_deployment.ezaudit_dev` → `bold-orca-397`, `convex_deployment.ezaudit_prod`
> → `standing-malamute-74`, project id `3209319`). Provisioned with
> `npx convex project create ezaudit` + `npx convex dev --configure new --team
> stefan-djokic --project ezaudit --dev-deployment cloud`, then adopted by import
> (`projects.tf` records the manual-create comment). `CLERK_JWT_ISSUER_DOMAIN` is
> reported set on the dev deployment (`https://winning-jaybird-28.clerk.accounts.dev`,
> derived from the shared Clerk dev publishable key) — not verifiable from repo code.

## Root scripts

```jsonc
{
  "dev": "concurrently -n convex,frontend -c blue,magenta \"pnpm convex:dev\" \"pnpm dev:frontend\"",
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
  "typecheck": "tsc --noEmit -p tsconfig.typecheck.json",
  "lint": "tsc --noEmit -p tsconfig.json"
}
```

> Unlike astro-mate's `deploy:prod` (a bare `CONVEX_DEPLOYMENT=prod:… convex deploy`),
> both here go through the scrubbing wrapper so prod always pins the key from
> `backend/.env.production`. This closes the asymmetry called out in the astro-mate recon.

## The scrubbing wrapper (`backend/scripts/`)

Three pieces, copied in shape from astro-mate (all committed in `1cc7a84`):

1. `load-backend-env.sh` — safe dotenv parser (**never `source`**; deploy keys contain `|`
   and a trailing `=` that bash would mis-parse). Selects `backend/.env.production` with
   `--prod`, else `backend/.env.local`; errors out if the file is missing.
2. `convex-with-env.sh` — parses `--prod`, resolves the deployment + key, then runs the CLI
   under a **scrubbed environment** (verbatim from the script):

   ```bash
   cd "${BACKEND_ROOT}"
   exec env -i \
     PATH="${PATH:-/usr/bin:/bin}" \
     HOME="${HOME:-}" \
     USER="${USER:-}" \
     TMPDIR="${TMPDIR:-/tmp}" \
     CONVEX_DEPLOYMENT="${CONVEX_DEPLOYMENT}" \
     CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY}" \
     npx convex "${ARGS[@]}"
   ```

   `env -i` guards against a stray `export CONVEX_DEPLOY_KEY` in a shared shell silently
   pushing to another app's deployment. When `CONVEX_DEPLOYMENT` is absent from the env
   file, dev falls back to the hard-coded `dev:bold-orca-397`; prod requires it and fails
   otherwise.
3. `sync-convex-env.sh` — pushes per-env secrets to the selected deployment with
   `convex env set`, routing each set through `convex-with-env.sh` (`--prod` selects
   dev vs prod). Skips unset keys; syncs `CLERK_JWT_ISSUER_DOMAIN`,
   `LIGHTHOUSE_WORKER_URL`, `LIGHTHOUSE_WORKER_SECRET`,
   `LIGHTHOUSE_AWS_ACCESS_KEY_ID`, `LIGHTHOUSE_AWS_SECRET_ACCESS_KEY`,
   `LIGHTHOUSE_AWS_SESSION_TOKEN`, `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, `CREDITS_SERVICE_SECRET_EZAUDIT`.

## Required deployment env vars

Set on the ezaudit Convex deployments (dev and prod), via `convex env set` / dashboard:

| Variable | dev | prod |
|---|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk dev FAPI URL | `https://clerk.sdee3.com` |
| `LIGHTHOUSE_WORKER_URL` | Lambda Function URL if enabled | required Lambda Function URL |
| `LIGHTHOUSE_AWS_ACCESS_KEY_ID` | caller key ID if enabled | required dedicated worker caller key ID |
| `LIGHTHOUSE_AWS_SECRET_ACCESS_KEY` | caller key secret if enabled | required dedicated worker caller secret |
| `LIGHTHOUSE_AWS_SESSION_TOKEN` | optional for temporary credentials | optional for temporary credentials |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | not set (email skipped and logged) | set 2026-10-20, sender `ezaudit@sdee3.com` |
| `CREDITS_SERVICE_SECRET_EZAUDIT` | set 2026-10 (credits display adopted; matches identity dev) | set 2026-10 (matches identity prod) |

`LIGHTHOUSE_WORKER_URL`, `LIGHTHOUSE_AWS_ACCESS_KEY_ID`, and
`LIGHTHOUSE_AWS_SECRET_ACCESS_KEY` are required for the remote IAM path. The session
token is required only for temporary AWS credentials. `LIGHTHOUSE_WORKER_SECRET` is
not read by the production IAM handler. See the worker runbook for the Lambda
environment values, IAM policy, release, rotation, rollback, and cost estimate.

Non-secret vars can be `env set`; secrets should be pushed with `convex:env:sync[:prod]`
from the gitignored env files.

## Infrastructure

`../infrastructure/convex` declares the Convex projects (`projects.tf`) and their
dev/prod deployments (`deployments.tf`). The ezaudit project (`3209319`) plus
`ezaudit_dev` and `ezaudit_prod` are declared and adopted by import — the infra
change this spec called for has been made. Deploy keys and env vars stay out of
Terraform state.

## Acceptance criteria

- [ ] `pnpm convex:dev` watches, codegens, and pushes to the dev deployment only. *(Wiring exists: `convex:dev` → `backend` `dev` → `convex dev`; live watch/push not exercised from repo evidence.)*
- [ ] `pnpm convex:deploy` deploys to dev; `pnpm convex:deploy:prod` deploys to prod. *(Scripts exist and are wired: `backend` `deploy` / `deploy:prod` → `convex-with-env.sh` [+ `--prod`]; only the dev branch has ever been runnable here — `backend/.env.production` is absent.)*
- [x] Neither command is affected by a stray exported `CONVEX_DEPLOY_KEY`. *(Proven by `exec env -i` in `convex-with-env.sh`; `CONVEX_DEPLOY_KEY` is set only inside the scrubbed env from the env file.)*
- [ ] `pnpm convex:env:sync` / `:prod` set the correct deployment's env from the matching env file. *(Script exists and routes through the same wrapper via `--prod`, selecting `.env.local` / `.env.production` respectively; not yet run against a deployment from repo evidence.)*
- [ ] `npx convex ai-files install` output (`convex/_generated/ai/guidelines.md`) is committed. *(Not satisfied: `backend/convex.json` sets `aiFiles.enabled: false`; no `ai/` dir under `convex/_generated/`, nothing in git history — see Shipped divergences.)*
- [ ] Deploying prod requires passing `pnpm test` first (documented in the runbook). *(Not satisfied: no runbook doc in the repo; `.github/workflows/checks.yml` runs `pnpm test` in CI, but nothing gates the prod deploy on it.)*

## Shipped divergences

- **ai-files deliberately disabled.** `backend/convex.json` has
  `{"aiFiles": {"enabled": false}}`; the acceptance criterion expecting
  `convex/_generated/ai/guidelines.md` committed contradicts shipped config. The
  requirement-vs-config conflict is left as-is here; the checkbox stays unchecked.
- **Prod is provisioned.** The spec previously said prod was "not provisioned"
  (`prod:<ezaudit-prod-ref>` placeholder). Terraform state shows
  `prod:standing-malamute-74` adopted by import. This section reflects the shipped
  state; the deployment table above is updated accordingly.
- **Project naming.** Terraform state records the project as name/slug `ezaudit`
  (project id `3209319`). The previously documented `ezaudit-91edc` CLI-suffixed
  slug and the "empty `ezaudit` shell project to delete" note could not be
  confirmed from any tracked file; the table now uses the state-verified name.
- **Root `dev` label.** `concurrently -n convex,frontend …` (shipped) vs the
  previously documented `-n backend,frontend` label — cosmetic, requirement unchanged.
- **Extra `lint` script** in `backend/package.json` (`tsc --noEmit -p tsconfig.json`)
  not previously listed in this spec's scripts block — now included above.
