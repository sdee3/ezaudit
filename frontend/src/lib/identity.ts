import { useSignIn } from '@clerk/react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ROUTES } from '../utils'

/**
 * SDEE3 Identity (identity.sdee3.com) handoff helpers — the auth-only pieces
 * of the @sdee3/credits flow (docs/specs/03-identity-auth.md, "Decision").
 */
const APP_SLUG = 'ezaudit'
const DEFAULT_HUB_ORIGIN = 'https://identity.sdee3.com'
const DEFAULT_HUB_SIGN_IN_URL = `${DEFAULT_HUB_ORIGIN}/sign-in`
const DEFAULT_HUB_SIGN_UP_URL = `${DEFAULT_HUB_ORIGIN}/sign-up`

/**
 * Redirection URL for the hub's sign-in form:
 * {VITE_CLERK_SIGN_IN_URL ?? https://identity.sdee3.com/sign-in}?app=ezaudit&redirect_url=<origin>/sso-callback.
 * `redirectPath` is accepted for call-site compatibility but the hub always
 * lands on /sso-callback; the intended route travels via
 * location.state?.from handled in useSignInTokenHandoff.
 */
export const buildIdentitySignInUrl = (
  appOrigin: string,
  _redirectPath = '/sso-callback',
  /** Optional prefill for the hub's credentials step (?email=). */
  initialEmail?: string
): string => buildHubSignInUrlEndpoint(
  import.meta.env.VITE_CLERK_SIGN_IN_URL || DEFAULT_HUB_SIGN_IN_URL,
  appOrigin,
  initialEmail
)

/** Redirection URL for the hub's sign-up form. */
export const buildIdentitySignUpUrl = (
  appOrigin: string,
  _redirectPath = '/sso-callback'
): string => buildHubSignInUrlEndpoint(
  import.meta.env.VITE_CLERK_SIGN_UP_URL || DEFAULT_HUB_SIGN_UP_URL,
  appOrigin
)

/** The hub origin (account management lives there, not in this app). */
export const buildIdentityAccountUrl = (): string =>
  new URL(hubSignInEndpoint()).origin

function hubSignInEndpoint(): string {
  return import.meta.env.VITE_CLERK_SIGN_IN_URL || DEFAULT_HUB_SIGN_IN_URL
}

function buildHubSignInUrlEndpoint(
  endpoint: string,
  appOrigin: string,
  initialEmail?: string
) {
  const hub = new URL(endpoint)
  hub.searchParams.set('app', APP_SLUG)
  hub.searchParams.set('redirect_url', `${appOrigin}/sso-callback`)
  if (initialEmail) hub.searchParams.set('email', initialEmail)
  return hub.toString()
}

export interface UrlParts {
  search: string
  pathname: string
  hash: string
}

/** The short-lived sign-in token minted by the hub and returned as ?token=. */
export function readSignInTicket(
  location: Pick<UrlParts, 'search'> = window.location
): string | null {
  return new URLSearchParams(location.search).get('token')
}

/** Removes the ?token= ticket from the address bar without navigating. */
export function stripSignInTicketFromUrl(
  location: UrlParts = window.location,
  history: Pick<History, 'state' | 'replaceState'> = window.history
): void {
  const params = new URLSearchParams(location.search)
  if (!params.has('token')) return
  params.delete('token')
  const search = params.toString()
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${search ? `?${search}` : ''}${location.hash}`
  )
}

/**
 * Consumes the hub's ?token= sign-in ticket via the Clerk ticket strategy:
 * signIn.ticket -> finalize -> strip the param -> navigate to the intended
 * route (location.state?.from, default ROUTES.dashboard).
 */
export function useSignInTokenHandoff(): void {
  const { signIn } = useSignIn()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const ticket = readSignInTicket()
    if (typeof window === 'undefined' || !ticket || !signIn) return

    void (async () => {
      try {
        const created = await signIn.ticket({ ticket })
        if (created.error) throw created.error
        const finalized = await signIn.finalize()
        if (finalized.error) throw finalized.error
        stripSignInTicketFromUrl()
        navigate(locationStateFrom(location.state), { replace: true })
      } catch {
        // Invalid/expired ticket: recover signed-out on the dashboard.
        stripSignInTicketFromUrl()
        navigate(ROUTES.dashboard, { replace: true })
      }
    })()
  }, [signIn, location.state, navigate])
}

function locationStateFrom(state: unknown): string {
  return (state as { from?: string } | null)?.from ?? ROUTES.dashboard
}
