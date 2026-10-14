import { describe, expect, it } from 'vitest'

import { ROUTES } from './utils/routes'
import { theme } from './utils/theme'

describe('smoke', () => {
  it('keeps the 702d652 routes', () => {
    expect(ROUTES.home).toBe('/')
    expect(ROUTES.dashboard).toBe('/dashboard')
    expect(ROUTES.userAudits).toBe('/dashboard/audits')
    expect(ROUTES.audit('abc')).toBe('/dashboard/audits/abc')
    expect(ROUTES.passwordReset).toBe('/dashboard/password-reset')
    expect(ROUTES.termsAndConditions).toBe('/terms-and-conditions')
  })

  it('keeps the 702d652 color tokens', () => {
    expect(theme.colors.primary).toBe('#1976d2')
    expect(theme.colors.primaryDark).toBe('#004ba0')
    expect(theme.colors.primaryLight).toBe('#63a4ff')
  })
})
