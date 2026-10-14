# 04 — Backend (Convex)

**Status:** `planned`

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

| Laravel/legacy capability | Convex replacement |
|---|---|
| MySQL `audits` table | Convex `audits` table |
| JWT/Sanctum auth | Clerk JWT via `auth.config.ts` + `requireUserId` |
| Redis queue + `php artisan queue:work` | Convex `scheduler` + an `auditJobs` table + `internalAction` |
| Pusher real-time | Convex reactive queries (`useQuery` auto-updates) |
| Laravel Echo / `useEcho` | delete; use `useQuery` subscriptions |
| Snappy server PDF | browser print ([ADR 0002](../adr/0002-pdf-browser-print.md)) |
| Lighthouse via queue job | AWS Lambda container + Function URL ([ADR 0001](../adr/0001-lighthouse-on-lambda.md)) |
| Laravel mail | Resend from the Convex action ([ADR 0003](../adr/0003-email-resend.md)) |
| MySQL/Redis/PHP in Docker | removed entirely |

## Layout (mirrors astro-mate)

```
backend/
├── package.json                 # name ezaudit-backend; dev/deploy/deploy:prod/test/typecheck
├── convex.json                  # { "$schema": …, "aiFiles": { "enabled": false } }
├── convex/
│   ├── auth.config.ts           # Clerk provider (spec 03)
│   ├── schema.ts                # spreads per-domain fragments
│   ├── schema/
│   │   ├── audits.ts            # audits table + validators
│   │   └── auditJobs.ts         # queue table
│   ├── lib/
│   │   ├── auth.ts              # requireUserId(ctx)
│   │   ├── lighthouse.ts        # POST the Lambda Function URL
│   │   └── email.ts             # Resend audit-ready notification
│   ├── audits.ts                # public queries/mutations (submit/list/get/setVisibility)
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

## Data model

### `audits`

| Field | Type | Notes |
|---|---|---|
| `userId` | `string` | `identity.subject` of the owner (index `by_userId`) |
| `email` | `string` | submission email (may differ from the Clerk email for logged-out audits) |
| `domain` | `string` | audited URL |
| `status` | `"queued" \| "running" \| "done" \| "error"` | drives real-time status |
| `audit_result` | `object \| null` | `{ accessibility, 'best-practices', performance, seo }` each `{ score }` |
| `is_public` | `boolean` | replaces the legacy `0/1` integer |
| `date_of_request` | `number` | ms epoch; UI formats with `new Date(...).toString()` |
| `error` | `string?` | populated on failure |
| `createdAt` / `updatedAt` | `number` | |

Indexes: `by_userId`, `by_userId_and_date`, `by_public_and_date`, `by_status`.

> The frontend's `AuditResultFromAPI` used `is_public: number` and a JSON-string
> `audit_result`. The conversion returns real objects/booleans; the frontend parses
> nothing (a deliberate, non-visual improvement — see the parity note in spec 02).

### `profiles` (optional, minimal)

Identity Convex is the canonical user registry. EZ Audit only needs a lightweight cache if
it wants to display a name/email without a second client: `userId`, `email`, `name`,
`createdAt`. Skip it if `getUserIdentity()` supplies enough.

### `auditJobs`

Queue/observability row per attempt: `auditId`, `attempt`, `startedAt`, `finishedAt`,
`status`, `error`, `workerRequestId`. Enables retry/backoff and avoids re-running
duplicate submissions.

## Functions

| Function | Kind | Auth | Purpose |
|---|---|---|---|
| `audits.submit` | mutation | optional (public form) | validate domain/email, insert `audits` row `status: queued`, schedule `auditPipeline.run` |
| `audits.listMine` | query | required | owner's audits, newest first (drives the table) |
| `audits.get` | query | optional | one audit; public if `is_public`, else owner-only |
| `audits.setVisibility` | mutation | required + owner | toggle `is_public` (replaces the legacy PUT status endpoint) |
| `auditPipeline.run` | internalAction | internal | call Lighthouse worker, persist result, set status, send email |
| `auditPipeline.retry` | internalAction | internal | bounded retry on worker failure |

Real-time status: the dashboard subscribes to `audits.listMine` and `audits.get`; no
Pusher/Echo.

## Decisions

Recorded in `docs/adr/`. Research for D1: [d1-lighthouse-host](../research/d1-lighthouse-host.md).

### D1 — Lighthouse execution environment

**Accepted:** AWS Lambda container image (arm64, ~2048 MB, 120s timeout) behind a
Function URL, not in a VPC. `lib/lighthouse.ts` POSTs `{ url }` with
`LIGHTHOUSE_WORKER_SECRET` and stores the four category scores. See
[ADR 0001](../adr/0001-lighthouse-on-lambda.md).

Lambda's always-free tier (1,000,000 requests and 400,000 GB-seconds per month) covers
roughly 3,300 such audits before any compute charge. Fargate has no free tier.
Cloudflare Workers cannot run Lighthouse (10 ms CPU). Browser Run is a browser only,
capped at 10 minutes a day on the free plan. Cloudflare Containers require the
$5/month Workers Paid plan.

### D2 — PDF generation

**Accepted:** keep `AuditResult` → `window.print()`. No server renderer. See
[ADR 0002](../adr/0002-pdf-browser-print.md).

### D3 — Email notification

**Accepted:** Resend from the action (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`), matching
`../astro-mate`. A missing key or a Resend error is logged and does not fail the audit.
See [ADR 0003](../adr/0003-email-resend.md).

## Data migration

**Accepted (D6):** migrate. Export the Laravel `audits` rows to JSON and import them
with a temporary `internalMutation` (`audits.importLegacy`), then remove it. Map
`audit_result` JSON strings to objects, `is_public` 0/1 to booleans, and legacy user
ids to Clerk subjects where Identity has the same email. Rows with no matching email
are imported ownerless, not dropped. See
[ADR 0004](../adr/0004-migrate-legacy-audits.md).

## Acceptance criteria

- [ ] `pnpm --filter ezaudit-backend test` passes with co-located `convex-test` cases for submit/list/get/setVisibility and pipeline transitions.
- [ ] `ctx.auth` is enforced on all owner-only functions; unauthenticated calls throw `Not authenticated`.
- [ ] A submitted audit appears in the dashboard **without a page reload** (real-time query).
- [ ] Public audits are readable signed-out; private audits are not.
- [ ] No MySQL, Redis, PHP, Pusher, or Laravel artifact remains in `backend/`.
- [ ] `convex/_generated` is committed and a fresh clone builds and tests without codegen.
- [x] D1–D3 decisions are recorded as ADRs with the chosen path.
