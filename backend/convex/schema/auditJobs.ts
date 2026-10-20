import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Queue/observability row per attempt (spec 04): enables retry/backoff and
 * makes duplicate/failed submissions observable.
 */
export const auditJobsTables = {
  auditJobs: defineTable({
    auditId: v.id("audits"),
    /** Retry cycle for this attempt. Older rows belong to cycle 0. */
    retryCycle: v.optional(v.number()),
    /** 1-based attempt counter for this audit. */
    attempt: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    error: v.optional(v.string()),
    /** Correlation id returned by the Lighthouse worker, when available. */
    workerRequestId: v.optional(v.string()),
  }).index("by_auditId", ["auditId"]),
}
