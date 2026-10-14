import { makeFunctionReference } from 'convex/server'
import type { FunctionReference } from 'convex/server'

/**
 * Stable SDEE3 Identity (https://github.com/sdee3/identity) Convex function
 * references for the credits display path. Vendored subset of
 * `packages/credits/src/identityApi.ts` — @sdee3/credits pins React 19, which
 * EZ Audit cannot depend on (docs/specs/03-identity-auth.md, "Decision").
 * Keep these two paths in sync with the identity deployment's public API.
 */
export type CreditBalance = {
  balance: number
  userId: string | null
}

export type UpsertFromClientArgs = {
  email: string
  name?: string
  imageUrl?: string
}

export const identityCreditsApi = {
  users: {
    upsertFromClient: makeFunctionReference<
      'mutation',
      UpsertFromClientArgs,
      string
    >('users:upsertFromClient'),
  },
  credits: {
    queries: {
      getBalance: makeFunctionReference<
        'query',
        Record<string, never>,
        CreditBalance
      >('credits/queries:getBalance'),
    },
  },
} as const satisfies {
  users: {
    upsertFromClient: FunctionReference<
      'mutation',
      'public',
      UpsertFromClientArgs,
      string
    >
  }
  credits: {
    queries: {
      getBalance: FunctionReference<
        'query',
        'public',
        Record<string, never>,
        CreditBalance
      >
    }
  }
}
