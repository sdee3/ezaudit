import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { requireUserId, getOptionalUserId } from "./lib/auth"

/**
 * The public API surface (spec 04 Functions table). The UI reaches these
 * through generated Convex artifacts only.
 */

/** Matches the frontend's AuditForm validation: host with at least one dot, optional scheme/port/path. */
const DOMAIN_PATTERN =
  /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isLikelyDomain(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > 253) return false
  if (/\s/.test(trimmed)) return false
  return DOMAIN_PATTERN.test(trimmed)
}

/**
 * Public form submission. Auth is optional: signed-out visitors may submit,
 * the row is then ownerless (userId: null).
 */
export const submit = mutation({
  args: {
    domain: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const domain = args.domain.trim()
    if (!isLikelyDomain(domain)) {
      throw new Error("Invalid domain: expected something like https://example.com")
    }

    const email = args.email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("Invalid email address")
    }

    const userId = await getOptionalUserId(ctx)
    const now = Date.now()

    const auditId = await ctx.db.insert("audits", {
      userId,
      email,
      domain,
      status: "queued",
      audit_result: null,
      is_public: false,
      date_of_request: now,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.auditPipeline.run, { auditId })

    return auditId
  },
})

/** Owner's audits, newest first (drives the dashboard table). Auth required. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return ctx.db
      .query("audits")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

/**
 * One audit by id. Readable when public; otherwise only by its owner.
 * Returns null when the id is malformed, not found, or forbidden. Existence is
 * not leaked. Takes a string so the client never guesses the Convex id format.
 * Auth is optional.
 */
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("audits", args.id)
    if (id === null) {
      return null
    }
    const audit = await ctx.db.get(id)
    if (audit === null) {
      return null
    }
    if (audit.is_public) {
      return audit
    }
    const userId = await getOptionalUserId(ctx)
    if (userId !== null && audit.userId === userId) {
      return audit
    }
    return null
  },
})

/** Toggle is_public. Auth required + owner only. Returns the updated doc. */
export const setVisibility = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)

    const audit = await ctx.db.get(args.id)
    if (audit === null || audit.userId !== userId) {
      throw new Error("Not found")
    }

    await ctx.db.patch(args.id, {
      is_public: !audit.is_public,
      updatedAt: Date.now(),
    })

    return await ctx.db.get(args.id)
  },
})

/** Remove an audit and its attempt history. Shared report URLs use the audit id. */
export const remove = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const audit = await ctx.db.get(args.id)
    if (audit === null || audit.userId !== userId) throw new Error("Not found")

    const jobs = await ctx.db
      .query("auditJobs")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.id))
      .collect()
    for (const job of jobs) await ctx.db.delete(job._id)
    await ctx.db.delete(args.id)
  },
})

/** Owner-only retry eligibility after all automatic attempts fail. */
export const retryEligibility = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const audit = await ctx.db.get(args.id)
    if (audit === null || audit.userId !== userId || audit.status !== "error") return false
    const jobs = await ctx.db
      .query("auditJobs")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.id))
      .collect()
    const cycle = audit.retryCycle ?? 0
    return jobs.filter((job) => (job.retryCycle ?? 0) === cycle).length >= 3
  },
})

/** Start a fresh three-attempt cycle without charging credits. */
export const retry = mutation({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const audit = await ctx.db.get(args.id)
    if (audit === null || audit.userId !== userId) throw new Error("Not found")
    if (audit.status !== "error") throw new Error("Audit is not eligible for retry")

    const cycle = audit.retryCycle ?? 0
    const jobs = await ctx.db
      .query("auditJobs")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.id))
      .collect()
    if (jobs.filter((job) => (job.retryCycle ?? 0) === cycle).length < 3) {
      throw new Error("Audit is not eligible for retry")
    }

    await ctx.db.patch(args.id, {
      retryCycle: cycle + 1,
      status: "queued",
      audit_result: null,
      error: undefined,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.auditPipeline.run, { auditId: args.id })
  },
})
