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

### Routes and flow

| Route | Auth | Behavior |
|---|---|---|
| any protected route (`/dashboard*`) | signed-out | render `AuthWrapper` (unchanged UI) whose primary action redirects to the hub |
| `/sso-callback` | guest | consume `?token=`, `signIn.create({ strategy: "ticket" })`, `setActive`, strip the param, then navigate to the intended route |
| signed-in visit to `/dashboard` | signed-in | existing `Dashboard` UI |

The **UI is unchanged**: `AuthWrapper`, the tabbed sign-in/register/reset forms, and all
`data-cy` hooks stay. Only the submit action of `SignInForm` becomes "continue with SDEE3
Identity" (`window.location.assign(buildHubSignInUrl(...))`); `RegisterForm` /
`ResetPasswordForm` remain for compatibility and delegate to the hub where identity
management is out of scope.

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
| `CLERK_JWT_ISSUER_DOMAIN` | backend | ezaudit Convex env | Clerk issuer; `applicationID: convex` |
| `CREDITS_SERVICE_SECRET_EZAUDIT` | backend | ezaudit Convex env + identity Convex env | only if credits are adopted |

## Decision: `@sdee3/credits` and the credits system

**Decision (recommended):** EZ Audit adopts **auth only** for the initial conversion and
does **not** depend on `@sdee3/credits`. Implement the three small pieces it would have
provided — `buildIdentitySignInUrl`, `useSignInTokenHandoff` (Clerk ticket strategy), and
`readSignInTicket`/`stripSignInTicketFromUrl` — as a ~60-line `frontend/src/lib/identity.ts`.

Rationale:
- The credits package forces React 19 + `@clerk/react` v6, which breaks the Chakra v2 UI
  we are contractually preserving.
- EZ Audit has no credits/payments/AI-balance feature today; adopting the ledger now is
  speculative.

**Alternative (if paid audits or credits are wanted later):** vendor a React-18 fork of
`@sdee3/credits` (relax its `peerDependencies`) or extract only the Convex identity-client
pieces. Record the fork path and the sync burden in this spec before doing it.

## Identity repo changes (ordered)

| # | Repo / file | Change | Tag |
|---|---|---|---|
| 1 | `identity/shared/redirectValidation.ts` | add `"ezaudit"` to `APP_SLUGS`; add `APP_HOME_URLS.ezaudit`; add `APP_REDIRECT_ALLOWLIST.ezaudit` (dev `http://localhost:5173` + `https://ezaudit.sdee3.com`); add `|| app === "ezaudit"` to `needsSignInTokenHandoff` | [code] |
| 2 | `identity/convex/schema.ts` | add `v.literal("ezaudit")` to `appSlugValidator` and the `AppSlug` type | [code] |
| 3 | `identity/convex/credits/httpHandlers.ts` | only if credits adopted: `ezaudit: "CREDITS_SERVICE_SECRET_EZAUDIT"` + slug unions | [code] |
| 4 | `identity/packages/credits/src/types.ts` | only if credits adopted: add slug to `AppSlug`; rebuild package | [code] |
| 5 | Clerk dashboard | FAPI subdomain allowlist += `ezaudit`; allowed redirect origins += `https://ezaudit.sdee3.com`; confirm `convex` JWT template + shared `/clerk-webhook` | [human-dashboard] |
| 6 | identity Convex env | only if credits adopted: `CREDITS_SERVICE_SECRET_EZAUDIT` | [human-dashboard] |
| 7 | identity deploy | run `./scripts/deploy-frontend.sh` so the updated allowlist ships | [code] |

## Acceptance criteria

- [ ] Visiting a protected route signed-out shows the unchanged `AuthWrapper` UI.
- [ ] The sign-in action lands on `https://identity.sdee3.com/sign-in?app=ezaudit&redirect_url=…/sso-callback`.
- [ ] After hub sign-in, the user returns to `/sso-callback`, is signed in, and reaches the intended route.
- [ ] `ctx.auth.getUserIdentity()` is non-null in ezaudit Convex for authenticated calls; `requireUserId` throws `Not authenticated` otherwise.
- [ ] Identity Convex records `users`, `userAppLinks`, `auditLog` rows for ezaudit sign-ins.
- [ ] No Firebase/Laravel auth dependency remains; no password is ever stored by ezaudit.
- [ ] React remains 18.3 and Chakra v2; the Clerk SDK version used passes the parity gate in [02](./02-ui-parity.md).
