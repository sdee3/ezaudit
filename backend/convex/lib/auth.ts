import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server"

export type CtxWithAuth = QueryCtx | MutationCtx | ActionCtx

/**
 * Returns the Clerk identity subject (`identity.subject`) for the caller.
 * Throws when the call is unauthenticated.
 */
export async function requireUserId(ctx: CtxWithAuth): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error("Not authenticated")
  }
  return identity.subject
}

/**
 * Optional-auth helper for public-facing functions (anonymous submissions,
 * public audit reads). Returns null when signed out.
 */
export async function getOptionalUserId(ctx: CtxWithAuth): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.subject ?? null
}
