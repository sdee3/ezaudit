import React, { useCallback, useContext, useEffect, useMemo } from 'react'
import { useCookies } from 'react-cookie'

import { User } from '../../../models'
import { SUCCESS_STATUS_CODE, useApi } from '../../../utils'

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

export const useAuthContext = () => {
  const [cookies, setCookie, removeCookie] = useCookies()
  const { fetchFromApi } = useApi()

  const accessToken: string | null = useMemo(
    () => cookies['accessToken'],
    [cookies]
  )

  const user: User | null = useMemo(
    () => (cookies['user'] as User) ?? null,
    [cookies]
  )

  const clearUser = useCallback(() => {
    removeCookie('user')
    removeCookie('accessToken')
  }, [removeCookie])

  const refetchTokenOnFirstLoad = useCallback(async () => {
    if (!cookies.accessToken) return

    const response = await fetchFromApi('/api/auth/validate', 'POST', {
      token: cookies.accessToken,
    })

    if (response.status !== SUCCESS_STATUS_CODE) {
      clearUser()
      return
    }

    setCookie('accessToken', response.access_token)
  }, [clearUser, cookies.accessToken, fetchFromApi, setCookie])

  useEffect(() => {
    refetchTokenOnFirstLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setUserData = useCallback(
    (user: object, accessToken: string) => {
      setCookie('user', JSON.stringify(user))
      setCookie('accessToken', accessToken)
    },
    [setCookie]
  )

  return { AuthContext, accessToken, user, setUserData, clearUser }
}
