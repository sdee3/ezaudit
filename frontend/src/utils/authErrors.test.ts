import { describe, expect, it } from 'vitest'

import { isAuthQueryError } from './authErrors'

describe('authErrors', () => {
  it('detects Convex "Not authenticated" errors', () => {
    expect(isAuthQueryError(new Error('Uncaught Error: Not authenticated'))).toBe(
      true
    )
    expect(isAuthQueryError(new Error('not authenticated'))).toBe(true)
    expect(isAuthQueryError(new Error('Not authenticated'))).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isAuthQueryError(new Error('Network failure'))).toBe(false)
    expect(isAuthQueryError('Not authenticated')).toBe(false)
    expect(isAuthQueryError(null)).toBe(false)
    expect(isAuthQueryError(undefined)).toBe(false)
  })
})
