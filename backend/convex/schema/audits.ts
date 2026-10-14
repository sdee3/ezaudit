import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Lighthouse category scores. Real objects — the legacy Laravel API returned a
 * JSON string here, but consumers no longer parse JSON (spec 04 data model).
 */
export const auditResultValidator = v.object({
  accessibility: v.object({ score: v.number() }),
  /** Valid-identifier key (hyphens are rejected by Convex validators). */
  bestPractices: v.object({ score: v.number() }),
  performance: v.object({ score: v.number() }),
  seo: v.object({ score: v.number() }),
})

export const auditsTables = {
  audits: defineTable({
    /** identity.subject of the owner, or null for signed-out submissions. */
    userId: v.union(v.string(), v.null()),
    /** Submission email (may differ from the Clerk email for logged-out audits). */
    email: v.string(),
    /** Audited URL. */
    domain: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error"),
    ),
    audit_result: v.union(auditResultValidator, v.null()),
    /** Replaces the legacy 0/1 integer. */
    is_public: v.boolean(),
    /** ms epoch; the UI formats with new Date(...).toString(). */
    date_of_request: v.number(),
    /** Populated on failure. */
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_date", ["userId", "date_of_request"])
    .index("by_public_and_date", ["is_public", "date_of_request"])
    .index("by_status", ["status"]),
}
