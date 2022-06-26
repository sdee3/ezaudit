import { IncomingMessage } from 'http'

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  userAudits: '/dashboard/audits',
  audit: (auditId: string) => `/dashboard/audits/${auditId}`,
  passwordReset: '/dashboard/password-reset',
  termsAndConditions: '/terms-and-conditions',
}

export const getCookieFromReq = (req: IncomingMessage, cookieKey: string) => {
  const cookie = req.headers.cookie
    .split(';')
    .find(c => c.trim().startsWith(`${cookieKey}=`))

  if (!cookie) return undefined
  return decodeURIComponent(cookie.split('=')[1])
}
