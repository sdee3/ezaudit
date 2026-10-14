import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useAuth as useClerkAuth, useUser } from '@clerk/react'

import { User } from '../../../models'

interface AuthContextType {
  user: User | null
  accessToken: string | null
  setUserData: (user: object, accessToken: string) => void
  clearUser: () => void
}

type ClerkUserResource = ReturnType<typeof useUser>['user']

const toUserModel = (clerkUser: ClerkUserResource): User | null =>
  clerkUser
    ? {
        id: clerkUser.id,
        email:
          clerkUser.primaryEmailAddress?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          '',
        name: clerkUser.fullName ?? null,
      }
    : null

export const useAuth = () => useContext(AuthContext)

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  accessToken: null,
  setUserData: (_user: object, _accessToken: string) => null,
  clearUser: () => null,
})

/**
 * Clerk-backed auth context (SDEE3 Identity). The public shape is preserved:
 * `user` derives from useUser(), `accessToken` carries the `convex` JWT
 * template token, `clearUser` signs out, and `setUserData` is a compatibility
 * no-op — identity is owned by the hub, never stored by EZ Audit.
 */
export const useAuthContext = () => {
  const { isSignedIn, user: clerkUser } = useUser()
  const { getToken, signOut } = useClerkAuth()
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const user = isSignedIn ? toUserModel(clerkUser) : null

  useEffect(() => {
    if (!isSignedIn) {
      setAccessToken(null)
      return
    }

    let cancelled = false
    void getToken({ template: 'convex' }).then(token => {
      if (!cancelled) setAccessToken(token)
    })

    return () => {
      cancelled = true
    }
  }, [getToken, isSignedIn])

  const clearUser = useCallback(() => {
    void signOut()
  }, [signOut])

  // Compatibility no-op: the hub owns user data updates.
  const setUserData = useCallback(
    (_nextUser: object, _nextAccessToken: string) => null,
    []
  )

  return { AuthContext, accessToken, user, setUserData, clearUser }
}
