/**
 * Route classification for the auth session handshake (astro-mate approach).
 *
 * Authenticated routes mount only after Clerk and Convex agree, so queries
 * never fire a "Not authenticated" error during the token exchange. Public
 * routes must render immediately — their mount never waits on the Clerk CDN.
 */

/** Authenticated app prefixes — keep the session handshake on these paths. */
const APP_SHELL_PREFIXES = ['/dashboard'] as const

/** Named public routes (fast-path set). */
const PUBLIC_SHELL_ROUTES = new Set([
  '/',
  '/terms-and-conditions',
  '/sign-in',
  '/sso-callback',
])

export function isAppShellPath(pathname: string): boolean {
  return APP_SHELL_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/**
 * Routes that should not wait on Clerk/Convex or load authenticated chrome.
 * Unknown URLs (the catch-all 404) stay public so they render instantly.
 */
export function isPublicShellRoute(pathname: string): boolean {
  if (PUBLIC_SHELL_ROUTES.has(pathname)) return true
  return !isAppShellPath(pathname)
}
