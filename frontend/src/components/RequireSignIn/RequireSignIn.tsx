import { Navigate, useLocation } from 'react-router-dom'

import { rememberSignInRedirectPath } from '../../lib/identity'
import { ROUTES } from '../../utils'

/**
 * Gate for authenticated pages: bounces signed-out users to /sign-in and
 * remembers where they were going, so the SSO callback can return them to
 * the exact deep link (location.state does not survive the external hub).
 */
export function RequireSignIn() {
  const location = useLocation()
  const from = `${location.pathname}${location.search}${location.hash}`
  rememberSignInRedirectPath(from)

  return <Navigate to={ROUTES.signIn} replace />
}
