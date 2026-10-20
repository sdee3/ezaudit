// Self-hosted so the CSP style-src stays 'self'. Third-party stylesheets are blocked.
import '@fontsource/open-sans/300.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/700.css'
import './styles/normalize.min.css'

import { ClerkProvider, useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import {
  ConvexSessionGuard,
  ErrorBoundary,
} from './components'
import { usesDirectClerkSignIn } from './lib/identity'
import { App } from './App'
import './print.css'

/**
 * Provider composition per docs/specs/03-identity-auth.md, extended with the
 * astro-mate session-guard approach: the guard wraps the router and holds
 * authenticated mounting until Clerk and Convex agree, while public routes
 * render immediately and the Convex JWT is refreshed on tab focus.
 */
const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

const directSignIn = usesDirectClerkSignIn()
const signInUrl = directSignIn
  ? '/sign-in'
  : import.meta.env.VITE_CLERK_SIGN_IN_URL
const signUpUrl = directSignIn
  ? '/sign-in'
  : import.meta.env.VITE_CLERK_SIGN_UP_URL

/**
 * PWA: reload the tab once an updated service worker takes control. Without
 * this, a browser running a precached bundle (especially an installed PWA
 * window) stays stuck one version behind an already-deployed build until it
 * happens to reload after the new SW installs.
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  // First-ever install transitions no-controller → controlled; the tab already
  // serves the freshest bundle, so no reload is needed in that case.
  const hadController = Boolean(navigator.serviceWorker.controller)
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // SW registration failure must never block the app.
    })
  })
}

registerServiceWorker()

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      allowedRedirectOrigins={[
        import.meta.env.VITE_APP_ORIGIN ?? window.location.origin,
      ]}
      {...(directSignIn
        ? {
            signInFallbackRedirectUrl: '/dashboard',
            signUpFallbackRedirectUrl: '/dashboard',
          }
        : {})}
    >
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        {/* Router must wrap the tree: the session guard uses useLocation. */}
        <BrowserRouter>
          <ErrorBoundary title="EZ Audit ran into a problem">
            <ConvexSessionGuard>
              <App />
            </ConvexSessionGuard>
          </ErrorBoundary>
        </BrowserRouter>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>,
)
