# 03 — Identity Auth (SDEE3 Identity)

**Status:** `done` (code-complete, verified locally at f9fef5e) — hub handoff, session
guard, Clerk-backed auth context, backend auth config, and the credits badge are all
shipped and unit-tested (`4d55674`, `42501dc`, `8e3f145`, `f9fef5e`); the identity-repo
changes are confirmed in the local `../identity` clone (`9acdb7c`, `b237f67`).
Acceptance checkboxes that can only be proven in the live environment (full hub
round-trip, Convex-side JWT trust, Identity Convex records) are intentionally left
unchecked — see Acceptance criteria and Shipped divergences.

## Requirement

All user authentication for EZ Audit goes through the **SDEE3 Identity hub**
(`identity.sdee3.com`), which is the shared Clerk front door for every `*.sdee3.com`
app. The ezaudit Convex backend trusts the shared Clerk-issued `convex` JWT and keys all
ownership on `identity.subject`. There is no Firebase Auth, no Laravel Sanctum/JWT, and
no per-app password store. ✅ No `firebase`/`sanctum` dependency exists in either
`package.json`, and the Convex schema stores no credential (`backend/convex/schema/` has
`audits`/`auditJobs` tables only).

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

### JWT claims for audit submissions

The shared Clerk `convex` JWT template must include these claims. The submit mutation
requires the signed-in user's verified email to match the submitted email.

```json
{
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}"
}
```

Add these claims to the existing template in the Clerk Dashboard. Without them,
`audits.submit` rejects every request. See [Clerk JWT templates](https://clerk.com/docs/guides/sessions/jwt-templates).

## Frontend integration

### Package choice under the React 18 pin

React is pinned to 18.3 for Chakra v2. That constrains the Clerk SDK:

- Use the Clerk React SDK version whose peer range includes React 18 (currently the
  `@clerk/clerk-react` v5 line). `@clerk/react` v6 targets React 19.
- `@sdee3/credits` currently declares peer deps `react ^19` / `@clerk/react ^6`; it is
  **not installable under the React 18 pin**. EZ Audit's auth does not require it (see
  decision below). ✅ No `@sdee3/*` dependency in `frontend/package.json`.
- Validate the exact SDK version with a one-day spike before implementation; record the
  pinned version here.
- **Recorded pinned version: `@clerk/react@6.17.8`** — `npm view @clerk/react@6.17.8
  peerDependencies` returns `react: "^18.0.0 || ~19.0.3 || …"`, so it installs under
  the React 18.3.1 pin (operator decision over the v5 recommendation above). ✅
  `frontend/package.json` pins `"@clerk/react": "6.17.8"` and `"react": "18.3.1"`
  (shipped `4d55674`).

### Routes and flow

| Route | Auth | Behavior |
|---|---|---|
| any protected route (`/dashboard*`) | signed-out | `RequireSignIn` redirects to `/sign-in`, remembering the deep link in sessionStorage (location.state does not survive the external hub detour) ✅ `frontend/src/components/RequireSignIn/` + `rememberSignInRedirectPath` (`lib/identity.ts`), used by `Dashboard`, `audits/index`, `AuditById` |
| `/sign-in` | guest (guarded) | dedicated sign-in page — signed-out users see a "Continue to sign in" action that redirects to the hub; signed-in users bounce to `/dashboard` ✅ `frontend/src/pages/dashboard/sign-in.tsx` |
| `/sso-callback` | guest | consume `?token=` / `?__clerk_ticket=`, `signIn.create({ strategy: "ticket" })`, `setActive`, strip the param, then navigate to the remembered deep link; expired/invalid tickets show an explicit error with a retry path ✅ `SsoCallback` + `useSignInTokenHandoff` (`lib/identity.ts`) |
| signed-in visit to `/dashboard` | signed-in | existing `Dashboard` UI (no full-page reload) ✅ |

**Update (astro-mate session-guard approach):** the inline `AuthWrapper` sign-in forms are
gone; sign-in lives on a single `/sign-in` page. Authentication mounts behind a
`ConvexSessionGuard` (`frontend/src/components/ConvexSessionGuard/`) exactly as
astro-mate does: ✅ (shipped `42501dc`)

- Authenticated UI renders only after Clerk and Convex auth agree, so Convex queries
  never crash with "Not authenticated" during the token exchange. ✅
- Public routes (`/`, `/terms-and-conditions`, `/sign-in`, `/sso-callback`, unknown
  catch-all paths — see `frontend/src/utils/publicRoutes.ts`) render immediately and
  never wait on the Clerk CDN; a returning signed-in visitor gets a "Connecting…"
  overlay instead of a flash of signed-out content (localStorage `had-session` flag).
  ✅ flag key `ezaudit:clerk-had-session`
- After a tab sleep/device lock, the Convex JWT is proactively refreshed on
  `visibilitychange`/`focus` (`useClerkConvexTokenRefresh`). ✅
- If Clerk shows a session but Convex rejects it, the guard retries once with a
  cache-bypassed token, then signs out after an 8s grace period instead of leaving a
  broken UI; a top-level `ErrorBoundary` routes any surviving "Not authenticated"
  query error through `AuthRecoveryFallback` (local sign-out → `/sign-in`). ✅
  (`AUTH_MISMATCH_SIGN_OUT_MS = 8_000`; `isAuthQueryError` in `utils/authErrors.ts`)
- `RegisterForm` / `ResetPasswordForm` are deleted from the sign-in surface (the hub
  owns registration and credentials); `ResetPasswordForm` survives only for the
  legacy shared-audit email-token flow. ✅ `RegisterForm.tsx` deleted in `42501dc`;
  `ResetPasswordForm` still used only by `/password-reset` and the public `AuditById`
  email-token handoff.

### Provider composition

```
StrictMode
 └ ClerkProvider            (publishableKey, allowedRedirectOrigins, signInUrl, signUpUrl)
    └ ConvexProviderWithClerk(useAuth)
       └ BrowserRouter
          └ ErrorBoundary ("Not authenticated" → AuthRecoveryFallback)
             └ ConvexSessionGuard
                └ App (Chakra/Cookies → PrintContext.Provider + AuthContext.Provider → Layout + CookieConsent)
```

`ConvexProviderWithClerk` receives the Clerk `useAuth` so Convex automatically carries the
`convex` JWT. `BrowserRouter` must sit inside the Convex provider. ✅ `frontend/src/main.tsx`
(shipped shape incl. the guard from `42501dc`; the `PrintContext`/`AuthContext` providers
moved inside `App` — see Shipped divergences).

### Preserve the existing context shape

`components/Auth/hooks/useAuthContext.tsx` keeps its public contract
(`{ user, accessToken, setUserData, clearUser }`) but is reimplemented on top of Clerk:
`user` derives from `useUser()`/`useAuth()`; `clearUser` maps to `signOut()`. Keeping the
shape avoids touching every consumer (`AuditForm`, `Dashboard`, `AuditResult`). ✅
`accessToken` carries the `{ template: 'convex' }` token; `setUserData` is a documented
compatibility no-op.

## Backend integration (Convex)

`backend/convex/auth.config.ts`: ✅ identical to the snippet below.

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
ever needed) reads `ADMIN_CLERK_USER_IDS`. ✅ `requireUserId` + `getOptionalUserId`
implemented; `ADMIN_CLERK_USER_IDS` not referenced anywhere (the gating is still "if ever
needed").

## Environment variables

| Variable | Scope | Set in | Meaning |
|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend | `frontend/.env.local` / `.env.production` | shared Clerk publishable key (`pk_test_…` dev, `pk_live_…` prod) ✅ in `.env.example` + deploy script |
| `VITE_CLERK_SIGN_IN_URL` | frontend | frontend env | `https://identity.sdee3.com/sign-in` ✅ |
| `VITE_CLERK_SIGN_UP_URL` | frontend | frontend env | `https://identity.sdee3.com/sign-up` ✅ |
| `VITE_APP_ORIGIN` | frontend | frontend env | ezaudit origin, used to build `redirect_url` ✅ |
| `VITE_CONVEX_URL` | frontend | frontend env | ezaudit Convex deployment URL ✅ |
| `VITE_IDENTITY_CONVEX_URL` | frontend | frontend env / generated by `scripts/deploy-frontend.sh` | identity Convex deployment URL (credits badge; dev `precious-alligator-40`, prod `glad-snake-999`) ✅ (`frontend/.env.local`, `scripts/.env`) |
| `VITE_CLERK_DIRECT_SIGN_IN` | frontend | frontend env | dev-only: embed a Clerk `<SignIn />` on `/sign-in` locally instead of the hub handoff (shipped `42501dc`, not in the original table) |
| `CLERK_JWT_ISSUER_DOMAIN` | backend | ezaudit Convex env | Clerk issuer; `applicationID: convex` ✅ (`auth.config.ts`) |
| `CREDITS_SERVICE_SECRET_EZAUDIT` | backend | ezaudit Convex env + identity Convex env | credits adopted (2026-10, display first); server-to-server debit path (see Shipped divergences: no debit path ships yet) |

## Decision: `@sdee3/credits` and the credits system

**Decision (2026-10 update):** EZ Audit adopts **auth + credit display**. Auth stays the
converted auth-only pieces (`frontend/src/lib/identity.ts`); credits reuse the shared
SDEE3 ledger through a **vendored, React-18-safe subset** of `@sdee3/credits` — the
function-reference map (`frontend/src/lib/identityCreditsApi.ts`) and the provider-hook
pair (`frontend/src/lib/identityCredits.tsx`), both ~70-line mirrors of the package. The
second Convex provider must wrap only the badge sub-tree so the rest of the app resolves
queries through the ezaudit deployment. ✅ (shipped `f9fef5e`; actual sizes 58 / 110
lines.)

Rationale:
- The credits package forces React 19 + `@clerk/react` v6, which breaks the Chakra v2 UI
  we are contractually preserving.
- EZ Audit has no credits/payments/AI-balance feature today; adopting the ledger now is
  speculative.

The `@sdee3/credits` npm dependency itself is still avoided (React 19 peer pins; and the
vendored subset keeps CI self-contained, spec 07). The two vendored files are the whole
sync burden: if identity renames `users:upsertFromClient` or `credits/queries:getBalance`,
`frontend/src/lib/identityCreditsApi.test.ts` still passes, so the contract is asserted
by path only at the edges listed here. ✅ Test asserts both paths (`getFunctionName`).

## Identity repo changes (ordered)

> This checklist marks recorded/deployed work. Items 1–4 are re-verified against the
> local `../identity` clone; deployment/runtime claims (items 5–9) were recorded during
> the 2026-10-14 session and are inherited as recorded — this audit could not re-verify
> them from the ezaudit repo.

| # | Repo / file | Change | Tag |
|---|---|---|---|
| 1 | `identity/shared/redirectValidation.ts` | add `"ezaudit"` to `APP_SLUGS`; add `APP_HOME_URLS.ezaudit`; add `APP_REDIRECT_ALLOWLIST.ezaudit` (dev `http://localhost:5173` + `https://ezaudit.sdee3.com`); add `|| app === "ezaudit"` to `needsSignInTokenHandoff` | [x] done (identity `9acdb7c`, 2026-10-14) |
| 2 | `identity/convex/schema.ts` | add `v.literal("ezaudit")` to `appSlugValidator` and the `AppSlug` type | [x] done (same commit) |
| 3 | `identity/convex/credits/httpHandlers.ts` | only if credits adopted: `ezaudit: "CREDITS_SERVICE_SECRET_EZAUDIT"` + slug unions | [x] done + deployed (started in `9acdb7c`, completed in identity `b237f67` 2026-10-14; deployed identity dev, prod via `npx convex deploy -y` — recorded, not re-verified here): `appSlug: AppSlug` unions, secret match includes ezaudit |
| 4 | `identity/packages/credits/src/types.ts` | only if credits adopted: add slug to `AppSlug`; rebuild package | [x] done + `pnpm build:credits` (identity `b237f67`; package not republished; other satellites pinned to npm 0.2.x are unaffected — the union only adds a member) |
| 5 | Clerk dashboard | ~~FAPI subdomain allowlist += ezaudit; allowed redirect origins~~ N/A on the free Clerk plan: the instance is bound to all of `sdee3.com`, so `ezaudit.sdee3.com` (and existing localhost dev origins) inherit it. `convex` JWT template is instance-global | [x] no-change confirmed (verified live, recorded) |
| 6 | identity Convex env | only if credits adopted: `CREDITS_SERVICE_SECRET_EZAUDIT` | [x] done — set on identity dev + prod; ezaudit dev + prod. Verified: dev↔dev and prod↔prod values match (hash-compared, never printed) (recorded) |
| 7 | identity deploy | run `./scripts/deploy-frontend.sh` so the updated allowlist ships; also `npx convex deploy` from the identity repo so the schema change reaches its deployment | [x] fulfilled by this work item: `npx convex dev --once` (dev) + `npx convex deploy -y` (prod) pushed the credits slug-union changes; hub frontend unchanged since `9acdb7c` (already deployed with the allowlist) (recorded) |
| 8 | ezaudit frontend | credits badge on the navbar for signed-in users: `CreditsBadge` + vendored `identityCreditsApi`/`identityCredits` | [x] done (ezaudit `f9fef5e`); deployed to `https://ezaudit.sdee3.com` 2026-10-14 (recorded) |
| 9 | ezaudit Convex deploys | keep both deployments in sync with repo before/after the change | [x] done (dev + prod push, no functional change) (recorded) |

## Acceptance criteria

- [ ] Visiting a protected route signed-out shows the unchanged `AuthWrapper` UI.
  *(Not tickable: the requirement was superseded by the astro-mate session-guard update
  above — `AuthWrapper` was deleted in `42501dc`; protected routes signed-out now
  redirect to `/sign-in`. Decision text intact; only the entry UI changed.)*
- [x] The sign-in action lands on `https://identity.sdee3.com/sign-in?app=ezaudit&redirect_url=…/sso-callback`.
  *(Proven by `buildIdentitySignInUrl` + unit tests in `lib/identity.test.ts`, and the
  hub-side allowlist for `app=ezaudit` in identity `9acdb7c`.)*
- [ ] After hub sign-in, the user returns to `/sso-callback`, is signed in, and reaches the intended route.
  *(Not provable from code: the full round-trip through the live hub is not exercised by
  unit tests. Local mechanics — `useSignInTokenHandoff`, deep-link restore in
  `SsoCallback` — are implemented and reviewed, but the live pass remains outstanding.)*
- [ ] `ctx.auth.getUserIdentity()` is non-null in ezaudit Convex for authenticated calls; `requireUserId` throws `Not authenticated` otherwise.
  *(Half-proven: `requireUserId` implements exactly this contract and backend tests
  cover the "Not authenticated" throw; the Convex-side trust of the shared Clerk JWT is
  a live-deployment property, not provable from the repo.)*
- [ ] Identity Convex records `users`, `userAppLinks`, `auditLog` rows for ezaudit sign-ins.
  *(Not provable from code. Partially supported: `IdentityUserSync` now calls
  `users:upsertFromClient` on sign-in (`f9fef5e`), but row recording happens in the
  identity deployment — needs Identity Convex logs.)*
- [x] No Firebase/Laravel auth dependency remains; no password is ever stored by ezaudit.
  *(No firebase/sanctum packages or imports anywhere in `frontend/` or `backend/`; no
  credential fields in the Convex schema.)*
- [x] React remains 18.3 and Chakra v2; the Clerk SDK version does not change the UI inventory in [02](./02-ui-parity.md).
  *(`react`/`react-dom` 18.3.1, `@chakra-ui/react` 2.10.10, `@clerk/react` 6.17.8;
  rendered inventory unchanged — only new route-level components were added.)*

## Shipped divergences

- **Entry UI superseded.** Acceptance criterion 1 still references the `AuthWrapper`
  UI, but the requirement was extended by the astro-mate session-guard approach
  (`42501dc`): signed-out visits to protected routes redirect to a dedicated `/sign-in`
  page instead of rendering an inline `AuthWrapper`. The decision text was left
  untouched; only the entry UI changed.
- **Provider tree moved, not just extended.** The composition diagram now shows
  `ErrorBoundary` + `ConvexSessionGuard` between `BrowserRouter` and `App`, and the
  `PrintContext`/`AuthContext` providers moved inside `App` (they used to wrap
  `CookieConsent + <App/>` from `main.tsx`).
- **Dev-only direct Clerk sign-in.** `VITE_CLERK_DIRECT_SIGN_IN=true` +
  `usesDirectClerkSignIn()` embed a Clerk `<SignIn />` on `/sign-in` for local dev
  (`ClerkDevAuthHelp`); the original table/flow only described the hub handoff.
- **`?email=` handoff param is a dead code path.** `8e3f145` forwarded a typed email to
  the hub credential step, but `42501dc` deleted the inline `SignInForm` that collected
  it. `buildIdentitySignInUrl(appOrigin, _redirectPath, initialEmail?)` still accepts
  `initialEmail`, yet no call site passes it; the hub-side support survives (identity
  `8e8d4c3`).
- **Credits: display path only.** The vendored subset ships
  `users:upsertFromClient` (identity user sync) + `credits/queries:getBalance` (badge).
  The `CREDITS_SERVICE_SECRET_EZAUDIT` server-to-server debit path has no consumer in
  ezaudit yet — the backend half of "display first" is recorded in the env table but
  not exercised by any shipped code.
- **README drift resolved.** `docs/specs/README.md` lists 03 as `done` and D4 as
  `accepted` with `@clerk/react@6.17.8`. The spike result above matches the README.

## Notes/verification log (2026-10)

- `4d55674` — Clerk auth wiring: `lib/identity.ts` hub handoff, `main.tsx` provider
  composition, Clerk-backed `useAuthContext`, `lib/identity.test.ts`.
- `8e3f145` — typed-email prefill to hub (later rendered dead by `42501dc`, above).
- `42501dc` — astro-mate session-guard approach: `AuthWrapper`/`SignInForm`/
  `RegisterForm` and friends deleted; `ConvexSessionGuard`, `RequireSignIn`,
  `SignedInRedirect`, `ErrorBoundary`, `AuthRecoveryFallback`, `authErrors`,
  `publicRoutes`, `useClerkConvexTokenRefresh` added; `sign-in` and `sso-callback`
  routes created.
- `f9fef5e` — credits: `CreditsBadge` on the navbar, vendored
  `identityCreditsApi(.test).ts` / `identityCredits.tsx`, dev/prod env pairing
  (`precious-alligator-40` / `glad-snake-999`).
- `frontend/src/components/SignedInRedirect/` is exported but has no call site yet
  (kept as a utility, mirrors astro-mate).
- Test suite at HEAD: frontend 17 tests pass (5 files), backend 10 tests pass — both
  re-run during this audit.
