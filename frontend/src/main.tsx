import { ClerkProvider, useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'

/**
 * Provider composition per docs/specs/03-identity-auth.md:
 * StrictMode > ClerkProvider > ConvexProviderWithClerk > BrowserRouter > App.
 * BrowserRouter must sit inside the Convex provider.
 */
const convexClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl={import.meta.env.VITE_CLERK_SIGN_IN_URL}
      signUpUrl={import.meta.env.VITE_CLERK_SIGN_UP_URL}
      allowedRedirectOrigins={[
        import.meta.env.VITE_APP_ORIGIN ?? window.location.origin,
      ]}
    >
      <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </StrictMode>
)
