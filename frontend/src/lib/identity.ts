import { useAuth, useClerk } from '@clerk/react'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * SDEE3 Identity (identity.sdee3.com) handoff helpers — the auth-only pieces
 * of the @sdee3/credits flow (docs/specs/03-identity-auth.md, "Decision").
 */
const APP_SLUG = 'ezaudit'
const DEFAULT_HUB_ORIGIN = 'https://identity.sdee3.com'
const DEFAULT_HUB_SIGN_IN_URL = `${DEFAULT_HUB_ORIGIN}/sign-in`
const DEFAULT_HUB_SIGN_UP_URL = `${DEFAULT_HUB_ORIGIN}/sign-up`

/** The short-lived sign-in tokens minted by the hub ('token') and
 * Clerk's own ticket redirect ('__clerk_ticket'). */
const SIGN_IN_TICKET_PARAM_NAMES = ['token', '__clerk_ticket']

/**
 * Redirection URL for the hub's sign-in form:
 * {VITE_CLERK_SIGN_IN_URL ?? https://identity.sdee3.com/sign-in}?app=ezaudit&redirect_url=<origin>/sso-callback.
 * `redirectPath` is accepted for call-site compatibility but the hub always
 * lands on /sso-callback; the intended route travels across the hub detour
 * via sessionStorage (rememberSignInRedirectPath / consumeSignInRedirectPath).
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

/** Dev-only: embedded Clerk <SignIn /> on /sign-in instead of the ticket handoff. */
export function usesDirectClerkSignIn(): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_CLERK_DIRECT_SIGN_IN === 'true'
  )
}

/** Open the hub sign-in. */
export function openIdentitySignIn(): void {
  window.location.assign(buildIdentitySignInUrl(window.location.origin))
}

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

/** The short-lived sign-in token minted by the hub and returned as ?token= (or Clerk's own ?__clerk_ticket=). */
export function readSignInTicket(
  location: Pick<UrlParts, 'search'> = window.location
): string | null {
  const params = new URLSearchParams(location.search)
  for (const name of SIGN_IN_TICKET_PARAM_NAMES) {
    const value = params.get(name)
    if (value) return value
  }
  return null
}

/** Removes the ?token= ticket from the address bar without navigating. */
export function stripSignInTicketFromUrl(
  location: UrlParts = window.location,
  history: Pick<History, 'state' | 'replaceState'> = window.history
): void {
  const params = new URLSearchParams(location.search)
  if (!SIGN_IN_TICKET_PARAM_NAMES.some(name => params.has(name))) return
  for (const name of SIGN_IN_TICKET_PARAM_NAMES) {
    params.delete(name)
  }
  const search = params.toString()
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${search ? `?${search}` : ''}${location.hash}`
  )
}

/*
 * Remembering the intended route: the sign-in detour goes through the
 * external hub, which wipes React Router's location.state — so the intended
 * route travels in sessionStorage instead of state.
 */

const SIGN_IN_REDIRECT_KEY = 'ezaudit:signin-from'

/** Store the deep link the user wanted before bouncing to /sign-in. */
export function rememberSignInRedirectPath(path: string): void {
  try {
    sessionStorage.setItem(SIGN_IN_REDIRECT_KEY, path)
  } catch {
    // Private mode / quota — fall back to the default route.
  }
}

/** Pop the remembered route (once). Returns null when nothing is stored. */
export function consumeSignInRedirectPath(): string | null {
  try {
    const path = sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)
    sessionStorage.removeItem(SIGN_IN_REDIRECT_KEY)
    return path
  } catch {
    return null
  }
}

export type SignInHandoffState = 'idle' | 'pending' | 'done' | 'error'

export interface UseSignInTokenHandoffOptions {
  /** Runs once after the ticket becomes an active Clerk session. */
  onSuccess?: () => void
  /** Give up and surface an error state after this long. */
  timeoutMs?: number
}

/**
 * Exchanges the one-time Clerk sign-in ticket from the identity hub redirect
 * (`?token=` / `?__clerk_ticket=`) for a local Clerk session.
 *
 * Waits for Clerk to load before touching the ticket, tolerates StrictMode
 * double-mounts of the same ticket, settles already-signed-in visits, and
 * surfaces explicit `pending`/`error` states so the callback page can offer
 * a retry path instead of silently bouncing to the dashboard.
 */
export function useSignInTokenHandoff(
  options: UseSignInTokenHandoffOptions = {}
): SignInHandoffState {
  const { onSuccess, timeoutMs = 20_000 } = options
  const ticket = useMemo(() => readSignInTicket(), [])
  const clerk = useClerk()
  const { isLoaded, isSignedIn } = useAuth()
  const [state, setState] = useState<SignInHandoffState>(
    () => (ticket ? 'pending' : 'idle')
  )
  const startedRef = useRef(false)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  useEffect(() => {
    if (!ticket) {
      setState('idle')
      return
    }
    if (!isLoaded || !clerk.loaded) return

    if (isSignedIn) {
      stripSignInTicketFromUrl()
      setState('done')
      onSuccessRef.current?.()
      return
    }

    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (!cancelled) setState('error')
    }, timeoutMs)

    void (async () => {
      try {
        const signIn = clerk.client?.signIn
        if (!signIn) {
          setState('error')
          return
        }

        const attempt = await signIn.create({
          strategy: 'ticket',
          ticket,
        })
        if (cancelled) return
        if (attempt.status !== 'complete' || !attempt.createdSessionId) {
          setState('error')
          return
        }

        await clerk.setActive({
          session: attempt.createdSessionId,
          navigate: async () => {
            stripSignInTicketFromUrl()
          },
        })
        if (cancelled) return

        stripSignInTicketFromUrl()
        setState('done')
        onSuccessRef.current?.()
      } catch {
        if (!cancelled) setState('error')
      } finally {
        window.clearTimeout(timeout)
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [ticket, isLoaded, clerk, isSignedIn, timeoutMs])

  if (!ticket || state === 'done') return 'idle'
  return state
}
