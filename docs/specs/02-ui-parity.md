# 02 — UI Parity

**Status:** `planned`

## Requirement

The converted frontend must render the **same UI** as git `702d652`, which is the last
revision containing the full Chakra UI. "Same" means:

- identical routes and navigation,
- identical component tree, copy, and layout,
- identical design tokens and fonts,
- identical assets,
- identical interaction behavior, including print/PDF and PWA.

This is a **port**, not a redesign. Screenshots of every screen from the source revision
are archived in `ezaudit-revive-702/screenshots/`.

## Route map (Next.js → React Router)

| Source file (`702d652`) | Source path | Target path | Notes |
|---|---|---|---|
| `pages/index.tsx` | `/` | `/` | hero + `<AuditForm>`; typewriter effect |
| `pages/terms-and-conditions.tsx` | `/terms-and-conditions` | `/terms-and-conditions` | long legal page |
| `pages/dashboard/index.tsx` | `/dashboard` | `/dashboard` | auth-gated; sign-in wrapper when signed out |
| `pages/dashboard/audits/index.tsx` | `/dashboard/audits` | `/dashboard/audits` | audits table; empty state |
| `pages/dashboard/audits/[auditId].tsx` | `/dashboard/audits/:id` | `/dashboard/audits/:id` | owner view or public view |
| `pages/dashboard/password-reset.tsx` | `/dashboard/password-reset` | `/dashboard/password-reset` | request reset + set-new-password |
| `pages/_app.tsx` | — | root layout | providers: Chakra, Cookies, CookieConsent, Auth, Print |
| `pages/_document.tsx` | — | `index.html` | fonts, normalize.css, manifest, theme-color, favicon, GA |

Auth flows previously at `/dashboard` (sign in, register, forgot/reset password) keep
their in-place tabbed behavior via `AuthWrapper`; the SDEE3 Identity redirect is added as
the sign-in action (see [03-identity-auth](./03-identity-auth.md)).

## Component inventory to port

| Source | Target | Notes |
|---|---|---|
| `components/Alert/Alert.tsx` + `hooks` | same | optional close |
| `components/AuditForm/AuditForm.tsx` + `hooks` | same | react-hook-form, regex validation, alert on submit |
| `components/AuditResult/AuditResult.tsx` | same | owner vs public rendering, options block |
| `components/AuditResult/ShareAuditURLModal.tsx` | same | clipboard copy modal |
| `components/Auth/AuthWrapper.tsx` | same | tab state: login / register / password-reset |
| `components/Auth/components/SignInForm.tsx` | same | becomes "continue with SDEE3 Identity" entry |
| `components/Auth/components/RegisterForm.tsx` | same | full registration form for compatibility |
| `components/Auth/components/ResetPasswordForm.tsx` | same | request reset + set password |
| `components/Auth/components/{SignInCTA,RegisterCTA,ForgotPasswordCTA}.tsx` | same | text CTAs |
| `components/Auth/hooks/useAuthContext.tsx` | replaced | backed by SDEE3 Identity + Convex, same context shape |
| `components/Breadcrumbs/Breadcrumbs.tsx` | same | blue bar, hidden while printing |
| `components/Footer/index.tsx` | same | year, T&C link, hidden link while printing |
| `components/Layout/index.tsx` | same | Navbar + main + Footer |
| `components/Loading/Loading.tsx` + `hooks` | same | centered spinner |
| `components/Navbar/Navbar.tsx` | same | logo, wordmark, dashboard button |
| `components/NoResults/NoResults.tsx` | same | `noResultAs200` / `noResultsAs404` variants |
| `modules/Dashboard/components/Dashboard.tsx` | same | Your Data / Audits / Account Settings |
| `modules/Print/hooks/usePrintContext.tsx` | same | `isPrinting` context |

## Design tokens (`utils/theme.ts`)

Preserve exactly:

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

Plus `theme-color` `#2663D1`, Open Sans weights `300;400;700`, and
`normalize.css@8.0.1` — both loaded from CDN as in `_document.tsx`.

## Assets

Copy verbatim into `frontend/public/static/`:

- `img/EZAudit-Home-Futuristic.svg`
- `img/EZAudit-Empty-State.svg`
- `img/EZAudit-Not-Found.svg`
- `manifest/icon-192x192.png`, `icon-256x256.png`, `icon-384x384.png`, `icon-512x512.png`,
  `icon-bordered.png`, `manifest.json`
- `favicon.ico`

Fix the known path bug from `702d652`: `manifest.json` references `/manifest/*` but the
files live at `/static/manifest/*`. The port must use consistent paths (this is a bug
fix, not a UI change).

## Cypress selectors

`data-cy` hooks in `702d652` (`submitAuditBtn`, `auditsTable`, `signInForm`, and the
rest) belonged to Cypress. Do not carry them forward. Vitest covers the same behavior
by role, label, and text ([07-testing-and-ci](./07-testing-and-ci.md)).

## Print / PDF behavior

- `PrintContext.isPrinting` hides navbar icon, breadcrumbs, and options while printing.
- "Export to PDF" triggers `window.print()`; `window.onafterprint` clears the flag.
- The target replaces any server-side PDF generation with the browser print path only
  ([ADR 0002](../adr/0002-pdf-browser-print.md)).

## PWA

Keep the `next-pwa` behavior by porting the manifest and a Vite PWA plugin config
(installable, standalone, theme `#2663D1`). Manifest name/short_name `EZ Audit`.

## Port checklist (acceptance)

The archived screenshots in `ezaudit-revive-702/screenshots/` are the visual reference.
There is no automated pixel diff and no browser integration suite.

1. Every route, component, token, and asset in this spec is present in `frontend/`.
2. Empty audits, the public audit view, the share modal, and the 404 match those
   screenshots.
3. No Chakra v3 APIs, no Tailwind, no component-library swap.

## Non-goals

- Redesigning any screen.
- Migrating to Chakra UI v3.
- Changing copy, spacing, colors, or typography.
