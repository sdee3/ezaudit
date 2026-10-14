import { describe, expect, it } from 'vitest'

import { isAppShellPath, isPublicShellRoute } from './publicRoutes'

describe('publicRoutes', () => {
  it('classifies authenticated app-shell paths', () => {
    expect(isAppShellPath('/dashboard')).toBe(true)
    expect(isAppShellPath('/dashboard/audits')).toBe(true)
    expect(isAppShellPath('/dashboard/audits/abc123')).toBe(true)
    expect(isAppShellPath('/dashboard/password-reset')).toBe(true)
    expect(isAppShellPath('/dashboard-extra')).toBe(false)
    expect(isAppShellPath('/')).toBe(false)
  })

  it('keeps public and unknown routes off the session handshake', () => {
    expect(isPublicShellRoute('/')).toBe(true)
    expect(isPublicShellRoute('/terms-and-conditions')).toBe(true)
    expect(isPublicShellRoute('/sign-in')).toBe(true)
    expect(isPublicShellRoute('/sso-callback')).toBe(true)
    // Catch-all 404s and unknown paths render instantly.
    expect(isPublicShellRoute('/some/unknown/path')).toBe(true)
  })

  it('puts the whole /dashboard subtree behind the session handshake', () => {
    expect(isPublicShellRoute('/dashboard')).toBe(false)
    expect(isPublicShellRoute('/dashboard/audits')).toBe(false)
    expect(isPublicShellRoute('/dashboard/audits/abc123')).toBe(false)
  })
})
