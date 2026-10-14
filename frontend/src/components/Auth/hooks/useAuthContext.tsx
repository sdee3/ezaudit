import React, { useCallback, useContext, useState } from 'react'

import { User } from '../../../models'

interface AuthContextType {
  user: User | null
  accessToken: string | null
  setUserData: (user: object, accessToken: string) => void
  clearUser: () => void
}

export const useAuth = () => useContext(AuthContext)

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  accessToken: null,
  setUserData: (_user: object, _accessToken: string) => null,
  clearUser: () => null,
})

/** Local stand-in for the auth context. No Firebase, no password store, no API. */
export const useAuthContext = () => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const clearUser = useCallback(() => {
    setUser(null)
    setAccessToken(null)
  }, [])

  const setUserData = useCallback((nextUser: object, nextAccessToken: string) => {
    setUser(nextUser as User)
    setAccessToken(nextAccessToken)
  }, [])

  return { AuthContext, accessToken, user, setUserData, clearUser }
}
