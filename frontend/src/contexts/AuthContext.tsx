import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { authService } from '../services/authService'
import type { User, LoginInputValues, RegisterInputValues } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: LoginInputValues) => Promise<void>
  register: (data: RegisterInputValues) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const currentUser = authService.getCurrentUser()
      if (currentUser && authService.isAuthenticated()) {
        try {
          const freshUser = await authService.me()
          setUser(freshUser)
        } catch {
          setUser(null)
          authService.logout()
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (credentials: LoginInputValues) => {
    const { user: loggedInUser } = await authService.login(credentials)
    setUser(loggedInUser)
  }

  const register = async (data: RegisterInputValues) => {
    const { user: registeredUser } = await authService.register(data)
    setUser(registeredUser)
  }

  const logout = async () => {
    await authService.logout()
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}