import { FieldError } from 'react-hook-form/dist/types'

export type HomeAuditInputValues = {
  domain: string
  email: string
}

export type SignInInputValues = {
  email: string
  password: string
}

export type RegisterInputValues = {
  email: string
  password: string
  password_confirmation: string
}

export type ResetPasswordInputValues = {
  emailForReset?: string
  password?: string
  password_confirmation?: string
}

export type Errors = {
  domain?: FieldError
}
