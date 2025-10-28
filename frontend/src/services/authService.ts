import api from './api'
import type { AuthResponse, LoginInputValues, RegisterInputValues, User } from '../types'

export const authService = {
  async login(credentials: LoginInputValues): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/login', credentials)
    const { access_token, user } = response.data
    
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(user))
    
    return response.data
  },

  async register(data: RegisterInputValues): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/register', data)
    const { access_token, user } = response.data
    
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(user))
    
    return response.data
  },

  async logout(): Promise<void> {
    try {
      await api.post('/logout')
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  },

  async me(): Promise<User> {
    const response = await api.get<User>('/me')
    return response.data
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
  },

  getToken(): string | null {
    return localStorage.getItem('token')
  },

  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}