# 04 — Backend (Convex)

**Status:** `partial` (backend domain shipped and verified; the Lambda worker is deployed to dev in `us-east-1`, and its configuration was re-checked read-only on 2026-10-20. The prod worker wiring and the D6 import remain open; see Shipped divergences).

Dev deployment `dev:bold-orca-397` (project `ezaudit`, id `3209319`) has the schema, functions, and tests. Auth is enforced on owner-only functions. The dev deployment is seeded with 4 sample audits. Real-time dashboard updates are wired at the code level (reactive `useQuery`); no browser-runtime session was recorded to confirm it live.

## Requirement

Replace the Laravel backend (PHP, MySQL, Redis, queue worker, Pusher, Snappy PDF) with a
single Convex deployment that owns:

- audit records and their results,
- the audit submission queue and processing orchestration,
- real-time dashboard updates (replacing Pusher),
- all authorization checks (Clerk JWT → `identity.subject`).

The frontend reaches this backend only through generated Convex artifacts and shared
`convex/lib/*` helpers (see [01-target-architecture](./01-target-architecture.md)).

## Capability mapping (Laravel → Convex)

| Laravel/legacy capability | Convex replacement | Shipped |
|---|---|---|
| MySQL `audits` table | Convex `audits` table | ✅ |
| JWT/Sanctum auth | Clerk JWT via `auth.config.ts` + `requireUserId` | ✅ |
| Redis queue + `php artisan queue:work` | Convex `scheduler` + an `auditJobs` table + `internalAction` | ✅ |
| Pusher real-time | Convex reactive queries (`useQuery` auto-updates) | ✅ |
| Laravel Echo / `useEcho` | delete; use `useQuery` subscriptions | ✅ (no Echo consumer remains) |
| Snappy server PDF | browser print ([ADR 0002](../adr/0002-pdf-browser-print.md)) | ✅ (`AuditResult.tsx` → `window.print()`) |
| Lighthouse via queue job | AWS Lambda container + Function URL ([ADR 0001](../adr/0001-lighthouse-on-lambda.md)) | ◐ client shipped; worker deployed to dev in `us-east-1`; prod not wired |
| Laravel mail | Resend from the Convex action ([ADR 0003](../adr/0003-email-resend.md)) | ✅ (no-op-logged when keys unset) |
| MySQL/Redis/PHP in Docker | removed entirely | ✅ |

## Layout (mirrors astro-mate)

```
backend/
├── package.json                 # name ezaudit-backend; dev/deploy/deploy:prod/test/typecheck/lint
├── convex.json                  # { "$schema": …, "aiFiles": { "enabled": false } }
├── convex/
│   ├── auth.config.ts           # Clerk provider (spec 03)
│   ├── schema.ts                # spreads per-domain fragments
│   ├── schema/
│   │   ├── audits.ts            # audits table + validators
│   │   └── auditJobs.ts         # queue table
│   ├── lib/
│   │   ├── auth.ts              # requireUserId(ctx)
│   │   ├── boundary.ts          # frontend-importable re-exports (no business logic yet)
│   │   ├── lighthouse.ts        # score parsing and dev-seed helpers
│   │   └── email.ts             # Resend audit-ready notification
│   ├── audits.ts                # public queries/mutations (submit/list/get/setVisibility)
│   ├── lighthouseWorker.ts      # Node action: SigV4 call to the Lambda Function URL
│   ├── auditPipeline.ts         # internal actions: enqueue → run → persist → notify
│   ├── audits.test.ts           # co-located convex-test
│   └── _generated/              # committed codegen
├── scripts/
│   ├── load-backend-env.sh
│   ├── convex-with-env.sh
│   └── sync-convex-env.sh
├── test/createConvexTest.ts
├── tsconfig.typecheck.json
└── vitest.config.ts             # edge-runtime, convex/**/*.test.ts
```

Confirmed from the tree: all files above exist, `convex.json` matches, and
`package.json` additionally ships a `lint` script (spec ran with `typecheck` only
in earlier drafts).

## Data model

### `audits` — shipped

| Field | Type | Notes |
|---|---|---|
| `userId` | `string \| null` | `identity.subject` of the owner; **null for signed-out submissions** (the schema uses a union — the table row was updated to match the shipped validator). Index `by_userId`. |
| `email` | `string` | submission email (may differ from the Clerk email for logged-out audits) |
| `domain` | `string` | audited URL |
| `status` | `"queued" \| "running" \| "done" \| "error"` | drives real-time status |
| `audit_result` | `object \| null` | `{ accessibility, bestPractices, performance, seo }` each `{ score }`. Deviation: the key is `bestPractices`, not `best-practices`, because Convex rejects hyphenated identifiers in validators. |
| `is_public` | `boolean` | replaces the legacy `0/1` integer |
| `date_of_request` | `number` | ms epoch; UI formats with `new Date(...).toString()` |
| `error` | `string?` | populated on failure |
| `createdAt` / `updatedAt` | `number` | |

Indexes (shipped, `schema/audits.ts`): `by_userId`, `by_userId_and_date`, `by_public_and_date`, `by_status`.

> The frontend's `AuditResultFromAPI` used `is_public: number` and a JSON-string
> `audit_result`. The conversion returns real objects/booleans; the frontend parses
> nothing (a deliberate, non-visual improvement — see the parity note in spec 02).
>
> Shipped check: `frontend/src/models/Audit.ts` now derives `AuditResultCategories`
> from the real Convex doc with the canonical `bestPractices` key, and no
> `AuditResultFromAPI` consumer remains. No dedicated parity note was found in spec 02
> for this conversion (the cross-reference points there without a matching anchor).

### `profiles` (optional, minimal) — not shipped (deliberate)

Identity Convex is the canonical user registry. EZ Audit only needs a lightweight cache if
it wants to display a name/email without a second client: `userId`, `email`, `name`,
`createdAt`. Skip it if `getUserIdentity()` supplies enough. Shipped: no `profiles`
fragment in `schema.ts` — the option was skipped as allowed.

### `auditJobs` — shipped (`schema/auditJobs.ts`)

Queue/observability row per attempt: `auditId`, `attempt`, `startedAt`, `finishedAt`,
`status`, `error`, `workerRequestId`. Enables retry/backoff and avoids re-running
duplicate submissions. Index: `by_auditId` (used by `countAttempts` / `markRunning`
to derive the 1-based attempt counter).

## Functions — shipped (`convex/audits.ts`, `convex/auditPipeline.ts`)

| Function | Kind | Auth | Purpose |
|---|---|---|---|
| `audits.submit` | mutation | optional (public form) | validate domain/email, insert `audits` row `status: queued`, schedule `auditPipeline.run` (ownerless rows carry `userId: null`) |
| `audits.listMine` | query | required | owner's audits, newest first via `by_userId_and_date` (drives the table) |
| `audits.get` | query | optional | one audit; public if `is_public`, else owner-only; returns `null` for missing **and** forbidden (existence not leaked) |
| `audits.setVisibility` | mutation | required + owner | toggle `is_public` (replaces the legacy PUT status endpoint); throws `Not found` for non-owners |
| `auditPipeline.run` | internalAction | internal | call Lighthouse worker, persist result, set status, send email |
| `auditPipeline.retry` | internalAction | internal | bounded retry on worker failure (max 3 attempts total, 5 s × attempt backoff scheduled from within the failed attempt) |

Pipeline internals (shipped): `getAudit`/`countAttempts` internal queries and
`markRunning`/`markDone`/`markError` internal mutations maintain the `auditJobs` row per
attempt. Completed audits are skipped on re-run (`status === "done"` short-circuit).

Real-time status: the dashboard subscribes to `audits.listMine` and `audits.get`; no
Pusher/Echo. Frontend wiring (commit 2c884dd) confirms the subscription path at the code
level: `main.tsx` mounts `ConvexProviderWithClerk` over a `ConvexReactClient`
(`VITE_CONVEX_URL`), `pages/dashboard/audits/index.tsx` renders from
`useQuery(api.audits.listMine, …)` ("Reactive subscription: the table updates live as
audits progress") and `AuditById.tsx` uses `useQuery(api.audits.get, …)` with the
share toggle left to the reactive query after `setVisibility`. Status patches from
`auditPipeline` invalidate these queries; no page reload is involved.

## Decisions

Recorded in `docs/adr/`. Research for D1: [d1-lighthouse-host](../research/d1-lighthouse-host.md).

### D1 — Lighthouse execution environment

**Accepted:** AWS Lambda container image (arm64, ~2048 MB, 120s timeout) behind an
`AWS_IAM` Function URL, not in a VPC. The `lighthouseWorker` Node action signs `{ url }`
with SigV4 and stores the four category scores. See
[ADR 0001](../adr/0001-lighthouse-on-lambda.md).

Lambda's always-free tier (1,000,000 requests and 400,000 GB-seconds per month) covers
roughly 3,300 such audits before any compute charge. Fargate has no free tier.
Cloudflare Workers cannot run Lighthouse (10 ms CPU). Browser Run is a browser only,
capped at 10 minutes a day on the free plan. Cloudflare Containers require the
$5/month Workers Paid plan.

Shipped note: the remote path is implemented and env-keyed
(`LIGHTHOUSE_WORKER_URL` and IAM signing credentials; all are in
`scripts/sync-convex-env.sh`'s key list). The local proof in
`workers/lighthouse-worker/` returned all four scores for `ezaudit.sdee3.com` in
9.5 seconds at 2048 MB through a local egress proxy. The proxy rejected a direct
loopback request and filters proxy requests by public IP. Chromium sends normal
navigation, redirect, and page resource requests through it. It supports public web
domains on ports 80 and 443. It does not provide AWS network isolation or block every
possible direct browser network path. The dev deployment
calls the attached worker. No image publish workflow exists in CI. Without a worker URL,
the runner uses the **dev-seed fallback** only when the flag is set. The Convex Lighthouse action fails when
`LIGHTHOUSE_WORKER_URL` is unset, unless `LIGHTHOUSE_ALLOW_SEEDED_SCORES` is
`"true"`. With that override, it returns deterministic FNV-1a-hashed placeholder
scores per domain so the submit → run → done flow completes without a worker. Tests
exercise the remote path by stubbing the URL + `fetch`.

### D2 — PDF generation

**Accepted:** keep `AuditResult` → `window.print()`. No server renderer. See
[ADR 0002](../adr/0002-pdf-browser-print.md). Shipped as decided (`AuditResult.tsx`
line 56).

### D3 — Email notification

**Accepted:** Resend from the action (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`), matching
`../astro-mate`. A missing key or a Resend error is logged and does not fail the audit.
See [ADR 0003](../adr/0003-email-resend.md). Shipped exactly as decided:
`lib/email.ts` never throws / rethrows.

## Data migration

**Accepted (D6):** migrate. Export the Laravel `audits` rows to JSON and import them
with a temporary `internalMutation` (`audits.importLegacy`), then remove it. Map
`audit_result` JSON strings to objects, `is_public` 0/1 to booleans, and legacy user
ids to Clerk subjects where Identity has the same email. Rows with no matching email
are imported ownerless, not dropped. See
[ADR 0004](../adr/0004-migrate-legacy-audits.md).

Shipped status: **not started** — no `importLegacy` function has ever been committed
(`git log -S importLegacy -- backend/` is empty), and no legacy JSON export exists in
the repo. The decision stands unchanged; the execution belongs to spec 08's migration
plan.

## Shipped divergences

Code or runtime behaviour that differs from the requirement as written above
(requirements themselves are unchanged):

1. **Dev-seed Lighthouse fallback** — `lighthouseWorker.ts` returns deterministic
   placeholder scores only when `LIGHTHOUSE_ALLOW_SEEDED_SCORES` is `"true"` and
   `LIGHTHOUSE_WORKER_URL` is unset. ADR 0001 specifies the Lambda Function URL as the
   execution environment only; the shipped code adds a documented local fallback so
   the pipeline completes end to end in dev. Without the flag a missing URL fails the
   audit. The remote path is exercised in tests by stubbing the env var and `fetch`.
2. **Lambda worker is deployed to dev, not prod** —
   `workers/lighthouse-worker/` contains the arm64 container, the handler, and
   `provision.sh`. The function `ezaudit-lighthouse-worker` runs in `us-east-1`, and
   the dev deployment returns real Lighthouse scores. The 2026-10-20 read-only AWS check
   confirmed `Active`, arm64, 2048 MB, 120 s, and `AWS_IAM`. No Terraform stack or image
   publish workflow exists yet. The prod deployment (`standing-malamute-74`) still
   needs `LIGHTHOUSE_WORKER_URL` and the caller credentials.
3. **D6 migration not executed** — `audits.importLegacy` has never been written or
   run; no legacy rows have been imported to either deployment.
4. **`userId` nullability** — the original data-model table said `string`; shipped
   schema is `v.union(v.string(), v.null())` because signed-out submissions exist
   (ownerless rows). The table above reflects the shipped type.
5. **`audits.test.ts` header says "spec 07"** — the co-located suite's doc-comment
   references spec 07 (testing) even though the cases belong to this spec's
   acceptance criteria; harmless comment drift, tests are the same ones spec 04
   requires.
6. **Optional auth on `audits.get` reads `userId` via `getOptionalUserId`** — the
   Functions table called it "optional", which is accurate; the only nuance is that
   forbidden reads return `null` rather than an error, deliberately matching the
   "existence is not leaked" behaviour. Recorded here so the contract is explicit.

## Acceptance criteria

- [x] `pnpm --filter ezaudit-backend test` passes with co-located `convex-test` cases for submit/list/get/setVisibility and pipeline transitions. *(re-run at HEAD ddef9c6: 15/15 passed)
- [x] `ctx.auth` is enforced on all owner-only functions; unauthenticated calls throw `Not authenticated`. *(proved in `audits.test.ts`: `listMine` unauthenticated, `setVisibility` unauthenticated + non-owner)
- [x] A submitted audit appears in the dashboard **without a page reload** (real-time query). *(code-level: reactive `useQuery(api.audits.listMine)` over `ConvexReactClient`; pipeline mutations patch the subscribed doc. Not verified in a live browser session.)
- [x] Public audits are readable signed-out; private audits are not. *(`audits.get` + tests cover signed-out/other-user/owner cases; existence not leaked.)*
- [x] No MySQL, Redis, PHP, Pusher, or Laravel artifact remains in `backend/`. *(grep over `backend/` finds only doc comments mentioning the legacy API — no code, config, or dependency.)*
- [x] `convex/_generated` is committed and a fresh clone builds and tests without codegen. *(all 5 `_generated` files tracked in git; `tsc --noEmit` typecheck passes at HEAD with no codegen step.)*
- [x] D1–D3 decisions are recorded as ADRs with the chosen path. *(docs/adr/0001–0003 all `accepted`; D6/0004 also recorded as accepted and unchanged.)*

## Verification log

- 2026-10-20, HEAD `ddef9c6`: `pnpm --filter ezaudit-backend test` passed, 1 file, 15 tests.
- 2026-10-20, read-only: `aws lambda get-function-configuration` and `get-function-url-config` returned `Active`, arm64, 2048 MB, 120 s, and `AWS_IAM`.

Earlier entries are attested from the working tree at HEAD f9fef5e:

- `pnpm --filter ezaudit-backend test` — 1 file, 10 tests, all passed (vitest 5, edge-runtime).
- `pnpm --filter ezaudit-backend typecheck` — `tsc --noEmit -p tsconfig.typecheck.json`, clean.
- Layout, `convex.json`, `vitest.config.ts`, and the three `backend/scripts/*` helpers match the Layout section.
- Frontend subscription path read in full: `main.tsx`, `pages/dashboard/audits/index.tsx`, `AuditById.tsx`, `AuditForm/hooks/index.tsx`, `models/Audit.ts`.
