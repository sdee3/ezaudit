# 05 — Deploy Frontend (S3 + CloudFront)

**Status:** `partial` — deploy script shipped in this repo (commits f34d0aa, 9a2d53f) and the first
production deploy is recorded 2026-10-14 (HTTP 200 + canonical CSP verified live; attested in
commit 0bdd9b2 — not re-provable from this repo). Script/app-side claims below are verified
against the code as shipped; note the shipped script diverges from this spec in several ways
(see *Shipped divergences*).

## Requirement

`./scripts/deploy-frontend.sh` builds the production frontend and publishes it to the
`ezaudit.sdee3.com` S3/CloudFront distribution, exactly like the sibling apps. AWS
resources are created by a dedicated Terraform stack in `../infrastructure`; the script
only syncs objects, manages the security-headers policy, and invalidates the cache.

> **Verified:** the script exists and does build → sync → invalidate. *"Manages the
> security-headers policy"* is no longer true of the script — the policy moved to
> Terraform in `../infrastructure` (see divergences).

## Target AWS resources

| Resource | Value |
|---|---|
| S3 bucket | `ezaudit-sdee3` (private, OAC-only) — live |
| Distribution | `E3581TUKKUJZQP` in `aws/ezaudit/` (created, not adopted) — applied 2026-10-14 |
| Alternate domain | `ezaudit.sdee3.com` |
| ACM cert | us-east-1, DNS-validated via Cloudflare |
| Default root object | `index.html` |
| Cache policies | `CachingOptimized` for `/assets/*`, `CachingDisabled` for the HTML shell |
| Error mapping | 403/404 → `/index.html` (SPA fallback, TTL 0–10) |
| Viewer-request fn | `ezaudit-viewer-request` (owns the host allowlist + SPA rewrite) |
| Response headers | `ezaudit-security-headers` (CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options + 4 custom headers) |

All rows in this table describe Terraform in `../infrastructure/aws/ezaudit/`, which exists
locally (checked read-only): `providers.tf`, `versions.tf`, `variables.tf`, `storage.tf`,
`distribution.tf`, `dns.tf`, `viewer-request.js`, `outputs.tf`, `tf.sh`, `load-env.sh`,
`README.md` — plus a `terraform.tfstate` dated 2026-10-14, consistent with "applied".
`distribution.tf` confirms OAC, `default_root_object = "index.html"`, CachingOptimized on
`/assets/*` and `/static/*`, CachingDisabled default behavior, ACM + SNI viewer certificate,
403/404 → `/index.html` (200) error responses, and the `ezaudit-viewer-request` function
association; `storage.tf` confirms private bucket + OAC bucket policy; `dns.tf` creates the
Cloudflare ACM-validation and apex records in zone `sdee3.com`. The table's claims about the
*applied live* state (cert issued, distribution serving, cache headers on live responses)
cannot be proven from this repo.

> **Why a new stack, not a row in `sdee3-frontends`:** that stack adopts existing
> frontends and deliberately does **not** create ACM certificates or DNS records. EZ Audit
> is new, so it needs both. The precedent is `aws/cloud-sdee3/` (a single-app stack that
> owns bucket + distribution + cert + DNS end to end). See `../infrastructure/README.md`.

## Infrastructure change list (`../infrastructure`, owned by that repo)

1. Create `aws/ezaudit/` by copying `aws/cloud-sdee3/`: `providers.tf`, `versions.tf`,
   `variables.tf`, `storage.tf`, `distribution.tf`, `dns.tf`, `viewer-request.js`,
   `outputs.tf`, `tf.sh`, `load-env.sh`, `README.md`. — **exists in
   `../infrastructure/aws/ezaudit/` (all listed files present, read-only check)**
   - `hostname = "ezaudit.sdee3.com"`, `bucket_name = "ezaudit-sdee3"`. ✓
     (defaults in `variables.tf`)
   - Keep `cloudflare_zone_id = d23be24bed949423c8b97d05c2a8eddd` (zone `sdee3.com`). ✓
     (default in `variables.tf`)
   - `viewer-request.js` allows `ezaudit.sdee3.com` and rewrites SPA paths to
     `/index.html` ✓ (non-ezaudit hosts get 403; `/assets/*` and any path with a
     file extension pass through; everything else is rewritten to `/index.html`).
2. Add `convex_project.ezaudit` + `convex_deployment.ezaudit_dev` / `ezaudit_prod`
   (see [06-convex-dev-prod](./06-convex-dev-prod.md)). — **exists in
   `../infrastructure/convex/` (`projects.tf`, `deployments.tf`); dev
   `bold-orca-397`, prod `standing-malamute-74` per its README**
3. Apply: `cd aws/ezaudit && ./tf.sh init && ./tf.sh plan && ./tf.sh apply` (cert validation
   and CloudFront deploy take minutes). Capture the distribution id. — **attested only**
   (a local `terraform.tfstate` exists; the apply itself is not provable from this repo)
4. `cd convex && ./tf.sh init && ./tf.sh plan && ./tf.sh apply` (read the plan carefully —
   this stack can destroy real projects). — **attested only**
5. Add an "EZAudit (AWS)" section to the infrastructure root `README.md`. — **exists**
   (section documents bucket, distribution `E3581TUKKUJZQP`, viewer-request function,
   headers policy, and the paired Convex deployments)

> If instead the shared `allow-custom-domains-only` viewer-request function is reused, the
> host **must** be added to its hardcoded allowlist in the identity repo
> (`identity/infra/cloudfront/identity-viewer-request.js`), or the new host 403s. The
> self-contained `ezaudit-viewer-request` avoids that coupling and is preferred.
> — the preferred route was taken; `../identity/infra/cloudfront/identity-viewer-request.js`
> exists locally but was not modified for this (no allowlist change needed).

## App-side files

```
scripts/
  .env                 # gitignored: BUCKET, DISTRIBUTION_ID, REGION, DIST_DIR, prod VITE_* values
  .env.example         # committed template
  deploy-frontend.sh   # build → sync → headers policy → invalidate
  cloudfront/
    ezaudit-viewer-response.js   # optional per-app security-headers function
frontend/
  .env.production      # generated by the deploy script (never hand-edited)
```

Verified: `scripts/.env` (gitignored ✓, values standing for `E3581TUKKUJZQP`) and
`scripts/.env.example` exist; `scripts/.env.example` additionally carries `VITE_APP_ORIGIN`
and `VITE_IDENTITY_CONVEX_URL` (identity creds badge, prod URL pairing — commit f9fef5e).
`scripts/deploy-frontend.sh` exists and is executable. `frontend/.env.production` exists
(generated, also gitignored ✓). **`scripts/cloudfront/` exists but is empty —
`ezaudit-viewer-response.js` was never committed** (optional per spec; see divergences).

`scripts/.env` (as committed in `.env.example`; the local copy adds
`VITE_IDENTITY_CONVEX_URL`):

```bash
BUCKET=ezaudit-sdee3
REGION=us-east-1
DISTRIBUTION_ID=<from the infrastructure apply>   # locally set to E3581TUKKUJZQP
DIST_DIR=frontend/dist
VITE_CONVEX_URL=https://standing-malamute-74.convex.cloud
VITE_APP_ORIGIN=https://ezaudit.sdee3.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_ME
VITE_IDENTITY_CONVEX_URL=https://<identity-prod>.convex.cloud
```

## `scripts/deploy-frontend.sh` behavior

*Verified against the shipped script (f34d0aa + the 9a2d53f rewrite/head f9fef5e). The
original commit implemented steps 1–7 including `--force`/`--clean`/`-h` flags; the
9a2d53f rewrite shipped a leaner script. Items marked ✗ diverge — detail in
*Shipped divergences*.*

1. `set -euo pipefail` ✓; `source scripts/.env` ✓; source
   `../identity/shared/clerk-csp.sh` for the canonical CSP — **the source is present, but it
   uses a hardcoded absolute path that exists only on the author's machine, and the script
   never uses the CSP it loads ✗** (headers moved to Terraform). It also contains a small
   dead `if … true` block.
2. Write `frontend/.env.production` ✓ — but with `VITE_APP_ORIGIN` and
   `VITE_IDENTITY_CONVEX_URL` taken from `scripts/.env`, in place of the spec's block:

   ```
   VITE_APP_ORIGIN=https://ezaudit.sdee3.com            # from scripts/.env (required)
   VITE_CONVEX_URL=https://<ezaudit-prod>.convex.cloud  # standing-malamute-74
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_…
   VITE_IDENTITY_CONVEX_URL=https://<identity-prod>.convex.cloud  # added in f9fef5e
   VITE_CLERK_SIGN_IN_URL=https://identity.sdee3.com/sign-in
   VITE_CLERK_SIGN_UP_URL=https://identity.sdee3.com/sign-up
   ```

3. `pnpm --dir ./frontend build --mode production` ✓
   (resolved via `${ROOT_DIR}/frontend`, guard for a missing `index.html` after build).
4. Upload to S3 with cache classes — **partially ✗**:
   - `index.html` → `no-cache, no-store, must-revalidate` ✓ (explicit `aws s3 cp`);
   - assets → `public, max-age=31536000, immutable` ✓, **but the shipped script syncs the
     whole `dist` tree (minus `index.html`) with `--delete`** instead of syncing hashed
     `assets/*` without `--delete`;
   - static images (`static/**`) → immutable, but only with `--force` ✗ (no `--force`
     handling; `static/**` rides along in the main `--delete` sync);
   - `--clean` empties the bucket first ✗ (flag dropped in the rewrite).
5. Upsert the `ezaudit-security-headers` CloudFront response-headers policy using
   `CONTENT_SECURITY_POLICY="${CONTENT_SECURITY_POLICY:-${SDEE3_CLERK_CONTENT_SECURITY_POLICY}}"`,
   and (if used) publish the `ezaudit-viewer-response.js` function ✗ — **not in the
   shipped script**. The headers policy (same canonical CSP, committed verbatim as
   `variables.clerk_content_security_policy`) and the `ezaudit-viewer-request` function
   are instead created and attached in `../infrastructure/aws/ezaudit/distribution.tf`.
6. `aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"` ✓
7. Echo a summary of the cache classes applied ✓ (shorter than the original: identity
   no-cache, assets+static immutable).

Flags: `--force` (sync static images), `--clean` (empty bucket), `-h`. ✗ **All were
implemented in f34d0aa but removed by the 9a2d53f rewrite; the shipped script ignores
unknown arguments instead of rejecting them.**

## SPA routing

React Router routes (`/dashboard/audits/:id`, etc.) must resolve to `index.html`. The
distribution's 403/404 → `/index.html` (200) custom error response, plus the
`ezaudit-viewer-request` rewrite, cover this. — **config verified in
`../infrastructure/aws/ezaudit/` (`distribution.tf` error responses + `viewer-request.js`
rewrite); live deep-link behavior attested, not re-provable here.** The manifest is served
at `/static/manifest/…`; `manifest.json` icon paths are fixed to match ✓
(`frontend/public/static/manifest/manifest.json` uses `/static/manifest/icon-*.png`;
`frontend/index.html` links `/static/manifest/manifest.json` — see
[02-ui-parity](./02-ui-parity.md)).

## Root scripts

| Command | Purpose |
|---|---|
| `./scripts/deploy-frontend.sh` | build + publish + invalidate ✓ |
| `pnpm build` | local production build only ✓ (delegates to the frontend workspace) |
| `pnpm preview` | serve `frontend/dist` locally ✗ — no root `preview` script exists (only `frontend` has one; run `pnpm --filter ezaudit-frontend preview`) |

## Shipped divergences

Requirement **intent unchanged** — build, publish with the spec's cache classes, and
invalidate. Divergences in the shipped code:

1. **Security-headers policy moved out of the script into Terraform.** The spec's step 5
   (script upserts `ezaudit-security-headers` via `CONTENT_SECURITY_POLICY=…`, plus the
   optional `ezaudit-viewer-response.js` publish) is gone; `../infrastructure/aws/ezaudit/`
   creates and attaches the policy (CSP sourced from the canonical `clerk-csp.sh`
   equivalent in `variables.tf`), and `scripts/cloudfront/` is empty. The shipped script
   still runs `source "/Users/stefandjokic/Developer/identity/shared/clerk-csp.sh"` (line 8)
   under `set -euo pipefail`, although nothing it defines is used. This is a hard dependency,
   not dead weight: on any machine or CI runner without that exact absolute path, the deploy
   script fails before it builds or uploads anything.
2. **Sync shape changed.** Shipped: one `aws s3 sync dist → s3://$BUCKET` with `--delete`
   and `--exclude index.html`, then an explicit `cp` for `index.html`. Spec required
   `assets/*` synced **without** `--delete` so an in-flight tab's lazy `import()` never
   404s, and `static/**` touched only with `--force`. The `--delete` sync can delete
   lazy chunks that in-flight tabs still need mid-deploy (the PWA update-reload added in
   3f10b7a mitigates but does not eliminate this).
3. **No `--size-only`** ⇒ "re-run with no changes is a no-op" relies on default mtime+size
   comparison; fresh builds get new mtimes, so unchanged-size objects may re-upload.
4. **Flags dropped.** `--force`, `--clean`, `-h` (implemented in f34d0aa, removed in
   9a2d53f); unknown args are silently ignored.
5. **Env additions.** `VITE_APP_ORIGIN` and `VITE_IDENTITY_CONVEX_URL` were added to
   `scripts/.env(.example)` and the generated `frontend/.env.production`
   (VITE_APP_ORIGIN is required via `${VITE_APP_ORIGIN:?…}`); the generated file no
   longer hardcodes the sign-in/up URLs' source — they're still written by the script.
6. **CSP path is non-portable.** The shipped script sources
   `/Users/stefandjokic/Developer/identity/shared/clerk-csp.sh` by hardcoded absolute
   path (the f34d0aa version searched sibling paths with a fallback CSP instead). It
   also leaves a dead `if [[ ! -f … ]]; then true; fi` block.
7. **Response-headers policy shape differs from the spec table.** The Terraform policy
   ships 2 custom headers (`X-SDEE3-App`, `X-SDEE3-Region`), not the 4 the spec table
   named; CSP/HSTS/XFO/RP/CTO all match.

## Verification notes (2026-10-15)

- `docs/` intended replacement reviewed against `git log`/`git show f34d0aa`, `9a2d53f`,
  `0bdd9b2`, `3f10b7a`, `f9fef5e` and current HEAD files; no repo file changed by this
  audit.
- `../infrastructure` and `../identity` exist locally; read-only checks as reported above.
  `aws/ezaudit` holds a `terraform.tfstate` (2026-10-14), which is local evidence the
  stack was applied, but no AWS account check was (or can be) performed from this repo.
- Live-CloudFront acceptance criteria (curl, deep links, live headers) remain attested via
  commit 0bdd9b2's spec status line only.

## Acceptance criteria

- [ ] `aws/ezaudit` stack applies bucket, OAC, distribution, ACM cert, and Cloudflare DNS. *(stack config + local tfstate exist in `../infrastructure`; the apply itself is not provable from this repo)*
- [ ] `curl -I https://ezaudit.sdee3.com` returns the distribution with a valid cert and HSTS. *(live check — not proven from this repo; HTTP 200 recording in commit 0bdd9b2 only attests it)*
- [ ] Deep links (`/dashboard/audits/123`) load the SPA, not a 403/404. *(error mapping + viewer-request rewrite are in `../infrastructure` config; live behavior not provable here)*
- [ ] `index.html` is `no-store`; `/assets/*` is `immutable, max-age=31536000`. *(upload commands in the script match; live response headers not verified from this repo)*
- [ ] CSP from `identity/shared/clerk-csp.sh` is attached and allows Clerk/identity frames. *(canonical CSP exists locally and is embedded in the Terraform policy — the "attached and live" part is AWS-only)*
- [ ] A deploy invalidates CloudFront and the new build is live. *(create-invalidation is in the script; "live" is a live check)*
- [ ] Re-running the deploy with no changes is a no-op (size-only sync). — **fails as specified: the shipped script dropped `--size-only` (divergence 3)**
