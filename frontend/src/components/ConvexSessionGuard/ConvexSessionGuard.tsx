import { useAuth } from '@clerk/react'
import { Flex, Spinner, Text } from '@chakra-ui/react'
import { useConvexAuth } from 'convex/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { useClerkConvexTokenRefresh } from '../../utils/hooks'
import { isPublicShellRoute } from '../../utils'

import { ConvexSessionContext } from './convexSessionContext'

/** Grace period before signing out when Clerk and Convex auth disagree. */
const AUTH_MISMATCH_SIGN_OUT_MS = 8_000

/**
 * localStorage flag: this browser had an active Clerk session on a previous
 * load. Lets us cover public routes during Clerk boot for returning
 * signed-in users without blacking out cold signed-out visits. Clerk exposes
 * no JS-readable session signal before its bundle loads (`__session` is
 * HttpOnly), so we track it ourselves.
 */
const HAD_SESSION_KEY = 'ezaudit:clerk-had-session'

function hadClerkSession(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(HAD_SESSION_KEY) === '1'
    )
  } catch {
    // Private mode / quota — behave like a cold visit.
    return false
  }
}

function SessionLoading({
  label,
  overlay = false,
}: {
  label: string
  overlay?: boolean
}) {
  return (
    <Flex
      align="center"
      justify="center"
      flexDirection="column"
      gap={3}
      position={overlay ? 'fixed' : undefined}
      inset={overlay ? 0 : undefined}
      zIndex={overlay ? 100 : undefined}
      background={overlay ? 'white' : undefined}
    >
      <Spinner size="xl" thickness="4px" speed="0.65s" aria-label={label} />
      <Text fontSize="sm" color="gray.500">
        {label}
      </Text>
    </Flex>
  )
}

type ConvexSessionGuardProps = {
  children: ReactNode
}

/**
 * Ensures Clerk and Convex auth agree before rendering authenticated UI.
 * Prevents useQuery from throwing "Not authenticated" during token refresh
 * gaps, keeps public routes mounted during Clerk boot, and recovers from a
 * stale/broken session with a timed sign-out instead of a broken UI.
 */
export function ConvexSessionGuard({ children }: ConvexSessionGuardProps) {
  const { pathname } = useLocation()
  const {
    isLoaded: clerkLoaded,
    isSignedIn,
    getToken,
    signOut,
    sessionClaims,
  } = useAuth()
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  const [signOutPending, setSignOutPending] = useState(false)
  const [hadSession] = useState(hadClerkSession)
  const recoveryAttemptedRef = useRef(false)
  const mismatchStartedAtRef = useRef<number | null>(null)

  useClerkConvexTokenRefresh()

  // Sync the flag once Clerk resolves: signed in → remember, signed out → clear.
  useEffect(() => {
    if (!clerkLoaded) {
      return
    }
    try {
      if (isSignedIn) {
        localStorage.setItem(HAD_SESSION_KEY, '1')
      } else {
        localStorage.removeItem(HAD_SESSION_KEY)
      }
    } catch {
      // ignore storage errors
    }
  }, [clerkLoaded, isSignedIn])

  const claimsAud =
    sessionClaims != null &&
    typeof sessionClaims === 'object' &&
    'aud' in sessionClaims
      ? String((sessionClaims as { aud?: unknown }).aud ?? '')
      : ''

  const mismatchActive = Boolean(
    clerkLoaded && isSignedIn && !isLoading && !isRefreshing && !isAuthenticated
  )

  useEffect(() => {
    if (!mismatchActive) {
      mismatchStartedAtRef.current = null
      recoveryAttemptedRef.current = false
      return
    }

    if (mismatchStartedAtRef.current === null) {
      mismatchStartedAtRef.current = Date.now()
    }

    if (!recoveryAttemptedRef.current) {
      recoveryAttemptedRef.current = true
      void (async () => {
        try {
          // One recovery attempt with a bypassed token cache: a stale cached
          // Convex JWT is the usual cause of the mismatch.
          if (claimsAud === 'convex') {
            await getToken({ skipCache: true })
          } else {
            await getToken({ template: 'convex', skipCache: true })
          }
        } catch {
          // Fall through to timed sign-out below.
        }
      })()
    }
  }, [mismatchActive, claimsAud, getToken])

  useEffect(() => {
    if (!mismatchActive || signOutPending) {
      return
    }

    const startedAt = mismatchStartedAtRef.current
    if (startedAt === null) {
      return
    }

    const elapsed = Date.now() - startedAt
    const remaining = AUTH_MISMATCH_SIGN_OUT_MS - elapsed

    const timer = window.setTimeout(() => {
      setSignOutPending(true)
      void signOut().catch(() => {
        setSignOutPending(false)
      })
    }, Math.max(remaining, 0))

    return () => {
      window.clearTimeout(timer)
    }
  }, [mismatchActive, signOutPending, signOut])

  const publicRoute = isPublicShellRoute(pathname)
  const convexPending = isLoading || isRefreshing || !isAuthenticated
  const handshakePending =
    !clerkLoaded || (Boolean(isSignedIn) && convexPending)

  if (signOutPending && isSignedIn) {
    return <SessionLoading label="Session expired — signing out" />
  }

  // Authenticated app: don't mount it until Clerk and Convex agree.
  if (handshakePending && !publicRoute) {
    return <SessionLoading label="Connecting…" />
  }

  // Public routes keep their content mounted (they must never wait on the
  // Clerk CDN). Cover only users who plausibly have a session: returning
  // signed-in users (flag set on a previous load) get no flash of signed-out
  // content while Clerk boots, and confirmed signed-in users mid-handshake.
  // Signed-out visitors — cold or returning — see content immediately.
  const queryReady = Boolean(
    clerkLoaded &&
      isSignedIn &&
      isAuthenticated &&
      !isLoading &&
      !isRefreshing
  )
  const coverPublic =
    publicRoute &&
    ((!clerkLoaded && hadSession) || (Boolean(isSignedIn) && handshakePending))

  return (
    <ConvexSessionContext.Provider value={{ queryReady }}>
      {children}
      {coverPublic ? <SessionLoading label="Connecting…" overlay /> : null}
    </ConvexSessionContext.Provider>
  )
}
