import { useAuth } from '@clerk/react'
import { Navigate } from 'react-router-dom'

import { ROUTES } from '../../utils'

/**
 * Client-only redirect for signed-in users visiting public pages. Rendered as
 * a sibling of the page content so the public content is never gated on
 * Clerk's loading state.
 */
export function SignedInRedirect({ to = ROUTES.dashboard }: { to?: string }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return null
  return isSignedIn ? <Navigate to={to} replace /> : null
}
