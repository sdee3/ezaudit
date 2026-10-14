import { describe, expect, it } from 'vitest'

import { getFunctionName } from 'convex/server'

import { identityCreditsApi } from './identityCreditsApi'

/**
 * Cross-repo contract: these paths point at the identity deployment's public
 * API (../identity convex). If identity renames either function, the credits
 * badge breaks at runtime with an "Unknown function" error — this test keeps
 * the vendored subset honest against the documented paths.
 */
describe('identityCreditsApi', () => {
  it('targets the stable public function paths of the identity deployment', () => {
    expect(getFunctionName(identityCreditsApi.users.upsertFromClient)).toBe(
      'users:upsertFromClient'
    )
    expect(getFunctionName(identityCreditsApi.credits.queries.getBalance)).toBe(
      'credits/queries:getBalance'
    )
  })
})
