import { useAuth } from '@clerk/react'
import { useEffect } from 'react'

async function fetchConvexJwt(
  getToken: ReturnType<typeof useAuth>['getToken'],
  sessionClaims: ReturnType<typeof useAuth>['sessionClaims'],
  skipCache: boolean
): Promise<void> {
  try {
    if (
      // when the default session token already is the Convex JWT template
      sessionClaimsObjectAud(sessionClaims) === 'convex'
    ) {
      await getToken({ skipCache })
      return
    }

    await getToken({ template: 'convex', skipCache })
  } catch {
    // Clerk may reject refresh when the session is gone; ConvexSessionGuard handles recovery.
  }
}

function sessionClaimsObjectAud(claims: unknown): string | null {
  if (claims != null && typeof claims === 'object' && 'aud' in claims) {
    return String((claims as { aud?: unknown }).aud ?? '')
  }
  return null
}

/**
 * After a tab sleeps or the device locks, proactively refresh the Convex JWT
 * when the user returns. Does not expose tokens — delegates to Clerk.
 */
export function useClerkConvexTokenRefresh(): void {
  const { isSignedIn, getToken, sessionId, sessionClaims } = useAuth()

  const claimsAud = sessionClaimsObjectAud(sessionClaims)

  useEffect(() => {
    if (!isSignedIn) {
      return
    }

    const refresh = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      void fetchConvexJwt(getToken, sessionClaims, true)
    }

    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)

    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
    // Clerk's getToken and claims identities churn; sessionId/aud are stable identity keys.
  }, [isSignedIn, sessionId, claimsAud])
}
