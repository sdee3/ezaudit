import { useAuth, useUser } from '@clerk/react'
import { ConvexReactClient, useMutation, useQuery } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

import { identityCreditsApi } from './identityCreditsApi'

/**
 * SDEE3 Identity credits display path — the React-18-vendored replacement for
 * @sdee3/credits' IdentityCreditsProvider + useCreditsBalance
 * (docs/specs/03-identity-auth.md, "Decision"). The second Convex client talks
 * to the identity deployment; auth is the same shared Clerk JWT ('convex'
 * template is instance-global, so it is valid on ezaudit's Convex and on the
 * identity deployment).
 *
 * `ConvexProviderWithClerk` must only wrap the credits sub-tree: it becomes
 * the nearest Convex provider for anything beneath it, so the rest of the app
 * keeps resolving its own queries through the outer (ezaudit deployment)
 * provider in main.tsx.
 */

let singleton: ConvexReactClient | null = null

/**
 * Lazily constructed identity Convex client, shared by every
 * IdentityCreditsProvider. Returns null when VITE_IDENTITY_CONVEX_URL is not
 * configured (badge renders nothing; no identity calls are made).
 */
export function getIdentityCreditsClient(
  url: string | undefined = import.meta.env.VITE_IDENTITY_CONVEX_URL,
): ConvexReactClient | null {
  if (!url) return null
  if (singleton === null) singleton = new ConvexReactClient(url)
  return singleton
}

/** Testing seam: drop the cached singleton. */
export function resetIdentityCreditsClient(): void {
  singleton = null
}

/**
 * Mirrors packages/credits' IdentityUserSync: satellite apps are responsible
 * for creating the identity-side user profile on sign-in. Without it the user
 * has no identity `users` row and getBalance reports {balance: 0, userId:
 * null} even though welcome credits exist. Idempotent (identity dedupes on
 * clerkUserId), and harmless when the Clerk user.created webhook already
 * created the profile.
 */
function IdentityUserSync(): null {
  const { isSignedIn, user } = useUser()
  const upsert = useMutation(identityCreditsApi.users.upsertFromClient)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isSignedIn || !user) {
      syncedFor.current = null
      return
    }

    if (syncedFor.current === user.id) {
      return
    }

    const email = user.primaryEmailAddress?.emailAddress
    if (!email) {
      return
    }

    syncedFor.current = user.id
    void upsert({
      email,
      name: user.fullName ?? undefined,
      imageUrl: user.imageUrl ?? undefined,
    }).catch(() => {
      // Balance read happens independently; a transient upsert failure must
      // not break the badge. The next sign-in retries it.
      syncedFor.current = null
    })
  }, [isSignedIn, user, upsert])

  return null
}

export function IdentityCreditsProvider({
  children,
}: {
  children: ReactNode
}): ReactElement | null {
  const client = getIdentityCreditsClient()
  if (!client) return null

  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <IdentityUserSync />
      {children}
    </ConvexProviderWithClerk>
  )
}

/**
 * Issues the identity credits/queries:getBalance watch. Balance is undefined
 * while the query (or its auth) is still resolving; callers should render a
 * neutral state for that, not a hard 0.
 */
export function useCreditsBalance(): {
  balance: number | undefined
} {
  return { balance: useQuery(identityCreditsApi.credits.queries.getBalance, {})?.balance }
}
