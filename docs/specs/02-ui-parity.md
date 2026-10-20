# 02 — UI Parity

**Status:** `done` (port shipped in `frontend/` and verified against `702d652` at the code level; auth flows superseded by [03-identity-auth](./03-identity-auth.md) — see Shipped divergences; archived-screenshot visual match not machine-verified)

## Requirement

The converted frontend must render the **same UI** as git `702d652`, which is the last
revision containing the full Chakra UI. "Same" means:

- identical routes and navigation,
- identical component tree, copy, and layout,
- identical design tokens and fonts,
- identical assets,
- identical interaction behavior, including print/PDF and PWA.

This is a **port**, not a redesign. Screenshots of every screen from the source revision
are archived in `ezaudit-revive-702/screenshots/`. ✅ Present on disk (14 PNGs, e.g.
`ezaudit-01-signin.png`, `ezaudit-09-audits-empty.png`); used as manual reference only.

## Route map (Next.js → React Router)

Implemented in `frontend/src/App.tsx` with `react-router-dom` (commit `73e7548`).
Routes themselves are pinned by `frontend/src/smoke.test.ts` ✅.

| Source file (`702d652`) | Source path | Target path | Notes |
|---|---|---|---|
| `pages/index.tsx` | `/` | `/` ✅ | hero + `<AuditForm>`; typewriter effect preserved verbatim (`frontend/src/pages/index.tsx`); next/image → plain `<img>` |
| `pages/terms-and-conditions.tsx` | `/terms-and-conditions` | `/terms-and-conditions` ✅ | long legal page; byte-identical to source |
| `pages/dashboard/index.tsx` | `/dashboard` | `/dashboard` ✅ | auth-gated via `<RequireSignIn />` → redirect to `/sign-in` when signed out (no in-page sign-in wrapper — see divergences) |
| `pages/dashboard/audits/index.tsx` | `/dashboard/audits` | `/dashboard/audits` ✅ | audits table; empty state `<NoResults />`; data via Convex `api.audits.listMine` live query (`2c884dd`) |
| `pages/dashboard/audits/[auditId].tsx` | `/dashboard/audits/:id` | `/dashboard/audits/:id` ✅ | owner view or public view; `<AuditResult>`; `<ResetPasswordForm>` when arrived via email token `?e=` |
| `pages/dashboard/password-reset.tsx` | `/dashboard/password-reset` | `/dashboard/password-reset` ✅ | request reset + set-new-password via `<ResetPasswordForm showFormOnly />` |
| — | — | `/sign-in` ✅ (new) | single sign-in surface: SDEE3 Identity hub handoff (or embedded Clerk `SignIn` in dev) — [03-identity-auth](./03-identity-auth.md) |
| — | — | `/sso-callback` ✅ (new) | consumes the hub sign-in ticket, activates the Clerk session, returns to the remembered deep link |
| `pages/_app.tsx` | — | root layout ✅ | providers preserved: Chakra, Cookies, CookieConsent, Auth, Print; additionally wrapped by ClerkProvider, ConvexProviderWithClerk, BrowserRouter, ErrorBoundary, ConvexSessionGuard (`main.tsx`) |
| `pages/_document.tsx` | — | `index.html` ✅ | Open Sans `300;400;700`, normalize.css 8.0.1 (same CDN + integrity hash), manifest, theme-color, favicon, GA |

## Component inventory to port

| Source | Target | Notes |
|---|---|---|
| `components/Alert/Alert.tsx` + `hooks` | same ✅ | optional close; hooks byte-identical; `data-cy="alert"` dropped |
| `components/AuditForm/AuditForm.tsx` + `hooks` | same ✅ | react-hook-form, regex validation, alert on submit; submit goes to Convex `api.audits.submit` (`2c884dd`); email prefilled from auth context |
| `components/AuditResult/AuditResult.tsx` | same ✅ | owner vs public rendering, options block; scores render `—` while `audit_result` is null |
| `components/AuditResult/ShareAuditURLModal.tsx` | same ✅ | clipboard copy modal; byte-identical |
| `components/Auth/AuthWrapper.tsx` | ❌ not ported | tabbed in-place login/register/reset replaced by the `/sign-in` hub handoff + `/sso-callback`; registration and forgot-password happen at the hub |
| `components/Auth/components/SignInForm.tsx` | ❌ not ported | credential step owned by SDEE3 Identity hub |
| `components/Auth/components/RegisterForm.tsx` | ❌ not ported | owned by the hub ("Create an account" link on `/sign-in`) |
| `components/Auth/components/ResetPasswordForm.tsx` | replaced ✅ | UI skeleton kept; both request-reset and set-password delegate to the hub (`buildIdentityAccountUrl()`) |
| `components/Auth/components/{SignInCTA,RegisterCTA,ForgotPasswordCTA}.tsx` | ❌ not ported | superseded by the `/sign-in` page copy |
| `components/Auth/hooks/useAuthContext.tsx` | replaced ✅ | Clerk-backed (SDEE3 Identity) + Convex JWT template token; context shape preserved (`user`/`accessToken`/`setUserData` no-op/`clearUser`) |
| `components/Breadcrumbs/Breadcrumbs.tsx` | same ✅ | blue bar, hidden while printing (`display: none`) |
| `components/Footer/index.tsx` | same ✅ | year, T&C link hidden while printing |
| `components/Layout/index.tsx` | same ✅ | Navbar + main + Footer |
| `components/Loading/Loading.tsx` + `hooks` | same ✅ | centered spinner; both byte-identical |
| `components/Navbar/Navbar.tsx` | same ✅ | logo, wordmark, dashboard button; adds `<CreditsBadge />` (`f9fef5e`) |
| `components/NoResults/NoResults.tsx` | same ✅ | empty-state vs 404 variants via `asError404` prop (was `noResultAs200`/`noResultsAs404` variants keyed off `data-cy`) |
| `modules/Dashboard/components/Dashboard.tsx` | same ✅ | Your Data / Audits / Account Settings; sign-out calls `clearUser()` directly |
| `modules/Print/hooks/usePrintContext.tsx` | same ✅ | `isPrinting` context; byte-identical |

New, beyond the inventory (all additive, from the auth/deploy work): `RequireSignIn`,
`SignedInRedirect`, `SsoCallback`, `ConvexSessionGuard`, `ErrorBoundary` +
`AuthRecoveryFallback`, `ClerkDevAuthHelp`, `CreditsBadge` (`42501dc`, `4d55674`,
`f9fef5e`).

## Design tokens (`utils/theme.ts`)

Preserved exactly ✅ — `frontend/src/utils/theme.ts` is byte-identical to `702d652`,
and `smoke.test.ts` asserts the color tokens. Verified:

```ts
colors: {
  primary: '#1976d2',
  primaryDark: '#004ba0',
  primaryLight: '#63a4ff',
  black: '#000',
  gray300: '#333',
  gray600: '#666',
  gray900: '#999',
  white: '#fff',
},
fonts: { body: 'Open Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Ubuntu, Cantarell, sans-serif',
         heading: 'Open Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Ubuntu, Cantarell, sans-serif' }
```

Plus `theme-color` `#2663D1` ✅ (`index.html`), Open Sans weights `300;400;700` ✅,
and `normalize.css@8.0.1` with the same CDN URL and SRI hash ✅ — both loaded from CDN
in `frontend/index.html` as in `_document.tsx`. GA is `VITE_GOOGLE_ANALYTICS`
substituted at build time by a tiny Vite plugin, standing in for the Next.js env var.

## Assets

Copy verbatim into `frontend/public/static/`: ✅ done — all files in
`frontend/public/static/{img,manifest}/` plus `favicon.ico` are blob-identical to
`702d652` (verified by git blob-hash comparison):

- `img/EZAudit-Home-Futuristic.svg` ✅
- `img/EZAudit-Empty-State.svg` ✅
- `img/EZAudit-Not-Found.svg` ✅
- `manifest/icon-192x192.png`, `icon-256x256.png`, `icon-384x384.png`, `icon-512x512.png`,
  `icon-bordered.png` ✅; `manifest.json` ✅ (paths intentionally fixed, see below)
- `favicon.ico` ✅

Fix the known path bug from `702d652`: `manifest.json` references `/manifest/*` but the
files live at `/static/manifest/*` (and `start_url` pointed at `/index.html`). Done ✅ —
`frontend/public/static/manifest/manifest.json` uses `/static/manifest/icon-*.png`
and `start_url: "/"`. The `_document.tsx` favicon typo (`//static/manifest/favicon.ico`)
is also fixed (`/static/favicon.ico`). The port uses consistent paths (bug fix, not a
UI change).

## Cypress selectors

`data-cy` hooks in `702d652` (`submitAuditBtn`, `auditsTable`, `signInForm`,
`userDashboardBtn`, `alert`, `noResultsAs404`, …) belonged to Cypress. Not carried
forward ✅ — `grep data-cy frontend/src` finds nothing. Vitest covers behavior by role,
label, and text ([07-testing-and-ci](./07-testing-and-ci.md)).

## Print / PDF behavior

- ✅ `PrintContext.isPrinting` hides the navbar icon group, breadcrumbs, footer link,
  and the options block while printing (`Navbar`, `Breadcrumbs`, `Footer`,
  `AuditResult` — all consume `PrintContext` directly).
- ✅ "Export to PDF" triggers `window.print()`; `window.onafterprint` clears the flag
  (`frontend/src/components/AuditResult/AuditResult.tsx`).
- ✅ `frontend/src/print.css` hides the cookie banner and every `print-hidden` element under
  `@media print`. Cmd+P and "Export to PDF" print the same report (ADR 0002).
- ✅ The target keeps the browser print path only (`ADR 0002`); no server-side PDF
  generation exists in `frontend/`.

## PWA

Kept with `vite-plugin-pwa` ✅ (wired in `73e7548`): manifest name/short_name `EZ Audit`,
`display: standalone`, theme `#2663D1`, background `#ffffff`, the four PNG icons,
scope/start_url `/` (in both the plugin config and the static `manifest.json` that
`index.html` links). Service worker registration is manual in `main.tsx`
(`injectRegister: false`) and the tab reloads when an updated SW takes control
(`3f10b7a`). Installable/standalone behavior itself was not verified in a browser.

## Port checklist (acceptance)

The archived screenshots in `ezaudit-revive-702/screenshots/` are the visual reference.
There is no automated pixel diff and no browser integration suite.

1. [ ] Every route, component, token, and asset in this spec is present in `frontend/`.
     Near-complete: all routes, tokens, and assets verified; the auth components
     (`AuthWrapper`, sign-in/register forms, CTAs) are deliberately replaced by the
     SDEE3 Identity flow (see divergences).
2. [ ] Empty audits, the public audit view, the share modal, and the 404 match those
     screenshots. Not verified — no visual comparison was performed.
3. [x] No Chakra v3 APIs, no Tailwind, no component-library swap. `@chakra-ui/react`
     is pinned to `2.10.10` (v2 line), no Tailwind dependency or config anywhere in
     `frontend/`, and no other component library is in `frontend/package.json`.

## Shipped divergences

Divergences from the requirement as written; none retroactively rewrite the
requirement:

1. **Auth flows replaced, not wrapped.** `AuthWrapper` and its tab state
   (login / register / password-reset), `SignInForm`, `RegisterForm`, and the three
   CTA components were not ported. Sign-in is a dedicated `/sign-in` page that hands
   off to the SDEE3 Identity hub; registration and forgot-password live at the hub;
   `ResetPasswordForm` keeps its UI but delegates to the hub account page. This
   matches [03-identity-auth](./03-identity-auth.md) rather than this spec's
   "in-place tabbed behavior" wording (`4d55674`, `8e3f145`, `42501dc`).
2. **Two routes beyond the map.** `/sign-in` and `/sso-callback` did not exist in
   `702d652` and are not in the route map above; they are additions required by 03.
3. **Data layer swapped in-place for Convex.** `_app`-era `useApi` calls to Next.js
   API routes (`/api/audits`, `/api/auth/*`) became convex `useQuery`/`useMutation`
   (`2c884dd`), changing behavior subtly: the audits table is a live subscription,
   queued/running audits render `—` scores, and the model key is `bestPractices`
   (hyphenated categorical key was invalid for Convex validators).
4. **Navbar adds CreditsBadge.** A shared-credit balance display (`f9fef5e`) that
   had no counterpart in `702d652` — an additive UI element, technically outside
   "not a redesign".
5. **PWA plumbing differs from `next-pwa`.** `vite-plugin-pwa` with manual SW
   registration and an update-reload listener (`3f10b7a`) replaces the Next.js
   plugin; the manifest values themselves are unchanged.
6. **Provider composition richer than `_app.tsx`.** ClerkProvider,
   ConvexProviderWithClerk, BrowserRouter, `ConvexSessionGuard`, and
   `ErrorBoundary` wrap the preserved provider set in `main.tsx`.
7. **`next/image` / `next/head` / `next/link` translated.** Hero and empty-state
   images use plain `<img>` with `maxWidth` styling; `<Head title meta>` is a small
   effect-based shim in `src/head.tsx` (document title/meta tags only — favicon,
   fonts, and manifest live in `index.html`; there is no per-route SSR metadata).

## Non-goals

- Redesigning any screen.
- Migrating to Chakra UI v3.
- Changing copy, spacing, colors, or typography.
