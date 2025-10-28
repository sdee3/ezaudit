export interface User {
  id: number
  name: string
  email: string
}

export interface AuditStatus {
  PENDING: 'pending'
  PROCESSING: 'processing'
  COMPLETED: 'completed'
  FAILED: 'failed'
}

export interface Audit {
  id: number
  user_id: number
  domain: string
  email: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  lighthouse_result: LighthouseResult | null
  pdf_path: string | null
  created_at: string
  updated_at: string
}

export interface LighthouseResult {
  accessibility: number
  performance: number
  best_practices: number
  seo: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

export interface HomeAuditInputValues {
  domain: string
  email: string
}

export interface LoginInputValues {
  email: string
  password: string
}

export interface RegisterInputValues {
  name: string
  email: string
  password: string
  password_confirmation: string
}