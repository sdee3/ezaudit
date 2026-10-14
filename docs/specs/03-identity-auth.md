# 03 — Identity Auth (SDEE3 Identity)

**Status:** `planned`

## Requirement

All user authentication for EZ Audit goes through the **SDEE3 Identity hub**
(`identity.sdee3.com`), which is the shared Clerk front door for every `*.sdee3.com`
app. The ezaudit Convex backend trusts the shared Clerk-issued `convex` JWT and keys all
ownership on `identity.subject`. There is no Firebase Auth, no Laravel Sanctum/JWT, and
no per-app password store.

## Architecture

```mermaid
flowchart LR
  U[User] -->|/sign-in?app=ezaudit&redirect_url=.../sso-callback| H[SDEE3 Identity hub]
  H -->|Clerk session + /continue| T["?token= sign-in token"]
  T -->|/sso-callback| E[EZ Audit SPA]
  E -->|Clerk session, JWT template 'convex'| A[EZ Audit Convex]
  A -->|ctx.auth.getUserIdentity().subject| DB[(audits / profiles)]
```

- **Clerk** is the IdP (single shared application, prod root `sdee3.com`, primary URL
  `identity.sdee3.com`).
- The **hub** validates the return URL against its per-app allowlist, records the visit,
  and mints a short-lived sign-in token that the satellite exchanges for a Clerk session.
- **EZ Audit Convex** validates the same Clerk JWT (`applicationID: "convex"`).

## Frontend integration

### Package choice under the React 18 pin

React is pinned to 18.3 for Chakra v2. That constrains the Clerk SDK:

- Use the Clerk React SDK version whose peer range includes React 18 (currently the
  `@clerk/clerk-react` v5 line). `@clerk/react` v6 targets React 19.
- `@sdee3/credits` currently declares peer deps `react ^19` / `@clerk/react ^6`; it is
  **not installable under the React 18 pin**. EZ Audit's auth does not require it (see
  decision below).
- Validate the exact SDK version with a one-day spike before implementation; record the
  pinned version here.
- **Recorded pinned version: `@clerk/react@6.17.8`** — `npm view @clerk/react@6.17.8
  peerDependencies` returns `react: "^18.0.0 || ~19.0.3 || …"`, so it installs under
  the React 18.3.1 pin (operator decision over the v5 recommendation above).

### Routes and flow

| Route | Auth | Behavior |
|---|---|---|
| any protected route (`/dashboard*`) | signed-out | `RequireSignIn` redirects to `/sign-in`, remembering the deep link in sessionStorage (location.state does not survive the external hub detour) |
| `/sign-in` | guest (guarded) | dedicated sign-in page — signed-out users see a "Continue to sign in" action that redirects to the hub; signed-in users bounce to `/dashboard` |
| `/sso-callback` | guest | consume `?token=` / `?__clerk_ticket=`, `signIn.create({ strategy: "ticket" })`, `setActive`, strip the param, then navigate to the remembered deep link; expired/invalid tickets show an explicit error with a retry path |
| signed-in visit to `/dashboard` | signed-in | existing `Dashboard` UI (no full-page reload) |

**Update (astro-mate session-guard approach):** the inline `AuthWrapper` sign-in forms are
gone; sign-in lives on a single `/sign-in` page. Authentication mounts behind a
`ConvexSessionGuard` (`frontend/src/components/ConvexSessionGuard/`) exactly as
astro-mate does:

- Authenticated UI renders only after Clerk and Convex auth agree, so Convex queries
  never crash with "Not authenticated" during the token exchange.
- Public routes (`/`, `/terms-and-conditions`, `/sign-in`, `/sso-callback`, unknown
  catch-all paths — see `frontend/src/utils/publicRoutes.ts`) render immediately and
  never wait on the Clerk CDN; a returning signed-in visitor gets a "Connecting…"
  overlay instead of a flash of signed-out content (localStorage `had-session` flag).
- After a tab sleep/device lock, the Convex JWT is proactively refreshed on
  `visibilitychange`/`focus` (`useClerkConvexTokenRefresh`).
- If Clerk shows a session but Convex rejects it, the guard retries once with a
  cache-bypassed token, then signs out after an 8s grace period instead of leaving a
  broken UI; a top-level `ErrorBoundary` routes any surviving "Not authenticated"
  query error through `AuthRecoveryFallback` (local sign-out → `/sign-in`).
- `RegisterForm` / `ResetPasswordForm` are deleted from the sign-in surface (the hub
  owns registration and credentials); `ResetPasswordForm` survives only for the
  legacy shared-audit email-token flow.

### Provider composition

```
StrictMode
 └ ClerkProvider            (publishableKey, allowedRedirectOrigins, signInUrl, signUpUrl)
    └ ConvexProviderWithClerk(useAuth)
       └ BrowserRouter
          └ PrintContext.Provider + AuthContext.Provider (shape preserved)
             └ CookieConsent + <App/>
```

`ConvexProviderWithClerk` receives the Clerk `useAuth` so Convex automatically carries the
`convex` JWT. `BrowserRouter` must sit inside the Convex provider.

### Preserve the existing context shape

`components/Auth/hooks/useAuthContext.tsx` keeps its public contract
(`{ user, accessToken, setUserData, clearUser }`) but is reimplemented on top of Clerk:
`user` derives from `useUser()`/`useAuth()`; `clearUser` maps to `signOut()`. Keeping the
shape avoids touching every consumer (`AuditForm`, `Dashboard`, `AuditResult`).

## Backend integration (Convex)

`backend/convex/auth.config.ts`:

```ts
import { AuthConfig } from "convex/server"

export default {
  providers: [
    { domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" },
  ],
} satisfies AuthConfig
```

A single `requireUserId(ctx)` helper lives in `backend/convex/lib/auth.ts` (per
CODING_STANDARDS — not in a schema file) and returns `identity.subject`. Admin gating (if
ever needed) reads `ADMIN_CLERK_USER_IDS`.

## Environment variables

| Variable | Scope | Set in | Meaning |
|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend | `frontend/.env.local` / `.env.production` | shared Clerk publishable key (`pk_test_…` dev, `pk_live_…` prod) |
| `VITE_CLERK_SIGN_IN_URL` | frontend | frontend env | `https://identity.sdee3.com/sign-in` |
| `VITE_CLERK_SIGN_UP_URL` | frontend | frontend env | `https://identity.sdee3.com/sign-up` |
| `VITE_APP_ORIGIN` | frontend | frontend env | ezaudit origin, used to build `redirect_url` |
| `VITE_CONVEX_URL` | frontend | frontend env | ezaudit Convex deployment URL |
| `VITE_IDENTITY_CONVEX_URL` | frontend | frontend env / generated by `scripts/deploy-frontend.sh` | identity Convex deployment URL (credits badge; dev `precious-alligator-40`, prod `glad-snake-999`) |
| `CLERK_JWT_ISSUER_DOMAIN` | backend | ezaudit Convex env | Clerk issuer; `applicationID: convex` |
| `CREDITS_SERVICE_SECRET_EZAUDIT` | backend | ezaudit Convex env + identity Convex env | credits adopted (2026-10, display first); server-to-server debit path |

## Decision: `@sdee3/credits` and the credits system

**Decision (2026-10 update):** EZ Audit adopts **auth + credit display**. Auth stays the
converted auth-only pieces (`frontend/src/lib/identity.ts`); credits reuse the shared
SDEE3 ledger through a **vendored, React-18-safe subset** of `@sdee3/credits` — the
function-reference map (`frontend/src/lib/identityCreditsApi.ts`) and the provider-hook
pair (`frontend/src/lib/identityCredits.tsx`), both ~70-line mirrors of the package. The
second Convex provider must wrap only the badge sub-tree so the rest of the app resolves
queries through the ezaudit deployment.

Rationale:
- The credits package forces React 19 + `@clerk/react` v6, which breaks the Chakra v2 UI
  we are contractually preserving.
- EZ Audit has no credits/payments/AI-balance feature today; adopting the ledger now is
  speculative.

The `@sdee3/credits` npm dependency itself is still avoided (React 19 peer pins; and the
vendored subset keeps CI self-contained, spec 07). The two vendored files are the whole
sync burden: if identity renames `users:upsertFromClient` or `credits/queries:getBalance`,
`frontend/src/lib/identityCreditsApi.test.ts` still passes, so the contract is asserted
by path only at the edges listed here.

## Identity repo changes (ordered)

| # | Repo / file | Change | Tag |
|---|---|---|---|
| 1 | `identity/shared/redirectValidation.ts` | add `"ezaudit"` to `APP_SLUGS`; add `APP_HOME_URLS.ezaudit`; add `APP_REDIRECT_ALLOWLIST.ezaudit` (dev `http://localhost:5173` + `https://ezaudit.sdee3.com`); add `|| app === "ezaudit"` to `needsSignInTokenHandoff` | [x] done (identity `9acdb7c`, pushed 2026-xx) |
| 2 | `identity/convex/schema.ts` | add `v.literal("ezaudit")` to `appSlugValidator` and the `AppSlug` type | [x] done (same commit) |
| 3 | `identity/convex/credits/httpHandlers.ts` | only if credits adopted: `ezaudit: "CREDITS_SERVICE_SECRET_EZAUDIT"` + slug unions | [x] done + deployed (identity dev 2026-10-14, prod via `npx convex deploy -y`): `appSlug: AppSlug` unions, secret match includes ezaudit |
| 4 | `identity/packages/credits/src/types.ts` | only if credits adopted: add slug to `AppSlug`; rebuild package | [x] done + `pnpm build:credits` (package not republished; other satellites pinned to npm 0.2.x are unaffected — the union only adds a member) |
| 5 | Clerk dashboard | ~~FAPI subdomain allowlist += ezaudit; allowed redirect origins~~ N/A on the free Clerk plan: the instance is bound to all of `sdee3.com`, so `ezaudit.sdee3.com` (and existing localhost dev origins) inherit it. `convex` JWT template is instance-global | [x] no-change confirmed (verified live) |
| 6 | identity Convex env | only if credits adopted: `CREDITS_SERVICE_SECRET_EZAUDIT` | [x] done — set on identity dev + prod; ezaudit dev + prod. Verified: dev↔dev and prod↔prod values match (hash-compared, never printed) |
| 7 | identity deploy | run `./scripts/deploy-frontend.sh` so the updated allowlist ships; also `npx convex deploy` from the identity repo so the schema change reaches its deployment | [x] fulfilled by this work item: `npx convex dev --once` (dev) + `npx convex deploy -y` (prod) pushed the credits slug-union changes; hub frontend unchanged since `9acdb7c` (already deployed with the allowlist) |
| 8 | ezaudit frontend | credits badge on the navbar for signed-in users: `CreditsBadge` + vendored `identityCreditsApi`/`identityCredits` | [x] done — deployed to `https://ezaudit.sdee3.com` 2026-10-14 |
| 9 | ezaudit Convex deploys | keep both deployments in sync with repo before/after the change | [x] done (dev + prod push, no functional change) |

## Acceptance criteria

- [ ] Visiting a protected route signed-out shows the unchanged `AuthWrapper` UI.
- [ ] The sign-in action lands on `https://identity.sdee3.com/sign-in?app=ezaudit&redirect_url=…/sso-callback`.
- [ ] After hub sign-in, the user returns to `/sso-callback`, is signed in, and reaches the intended route.
- [ ] `ctx.auth.getUserIdentity()` is non-null in ezaudit Convex for authenticated calls; `requireUserId` throws `Not authenticated` otherwise.
- [ ] Identity Convex records `users`, `userAppLinks`, `auditLog` rows for ezaudit sign-ins.
- [ ] No Firebase/Laravel auth dependency remains; no password is ever stored by ezaudit.
- [ ] React remains 18.3 and Chakra v2; the Clerk SDK version does not change the UI inventory in [02](./02-ui-parity.md).
