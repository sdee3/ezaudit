import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { requireUserId, getOptionalUserId } from "./lib/auth"

async function hashGuestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function withoutGuestSecret<T extends { guestTokenHash?: string; guestTokenExpiresAt?: number }>(audit: T) {
  const { guestTokenHash: _hash, guestTokenExpiresAt: _expiry, ...report } = audit
  return report
}

function withoutPrivateOwnerFields<T extends {
  guestTokenHash?: string
  guestTokenExpiresAt?: number
  userId?: string | null
  email?: string
}>(audit: T) {
  const {
    guestTokenHash: _hash,
    guestTokenExpiresAt: _expiry,
    userId: _userId,
    email: _email,
    ...report
  } = audit
  return report
}

/**
 * The public API surface (spec 04 Functions table). The UI reaches these
 * through generated Convex artifacts only.
 */

/** Matches the frontend's AuditForm validation: host with at least one dot, optional scheme/port/path. */
const DOMAIN_PATTERN =
  /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SUBMIT_RATE_WINDOW_MS = 60 * 60 * 1000
const SUBMIT_RATE_LIMITS = [
  { key: "global", limit: 100 },
  { key: "user", limit: 5 },
  { key: "email", limit: 3 },
] as const

async function enforceSubmitRateLimits(
  ctx: MutationCtx,
  userId: string,
  email: string,
  now: number,
) {
  const keys = ["global", `user:${userId}`, `email:${email}`]
  const counters = await Promise.all(keys.map(async (key) => {
    const row = await ctx.db
      .query("auditSubmitRateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique()
    return { key, row, count: row && now - row.windowStart < SUBMIT_RATE_WINDOW_MS ? row.count : 0 }
  }))

  for (let index = 0; index < counters.length; index += 1) {
    if (counters[index].count >= SUBMIT_RATE_LIMITS[index].limit) {
      throw new Error("Submission rate limit exceeded")
    }
  }

  for (const { key, row, count } of counters) {
    if (row) {
      await ctx.db.patch(row._id, {
        windowStart: count === 0 ? now : row.windowStart,
        count: count + 1,
      })
    } else {
      await ctx.db.insert("auditSubmitRateLimits", { key, windowStart: now, count: 1 })
    }
  }
}

export function isLikelyDomain(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > 253) return false
  if (/\s/.test(trimmed)) return false
  return DOMAIN_PATTERN.test(trimmed)
}

/**
 * Submit an audit for a verified email owned by the signed-in caller.
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

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    const claims = identity as typeof identity & { email?: string; email_verified?: boolean }
    const identityEmail = claims.email?.trim().toLowerCase()
    if (claims.email_verified !== true || identityEmail !== email) {
      throw new Error("Email must match the verified signed-in email")
    }
    const userId = identity.subject
    const now = Date.now()
    await enforceSubmitRateLimits(ctx, userId, email, now)

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

    return { auditId }
  },
})

/** Owner's audits, newest first (drives the dashboard table). Auth required. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    const audits = await ctx.db
      .query("audits")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
    return audits.map(withoutGuestSecret)
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
      return withoutPrivateOwnerFields(audit)
    }
    const userId = await getOptionalUserId(ctx)
    if (userId !== null && audit.userId === userId) {
      return withoutGuestSecret(audit)
    }
    return null
  },
})

/** Read a private guest report with its bearer token. */
export const getGuest = query({
  args: { id: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("audits", args.id)
    if (id === null) return null
    const audit = await ctx.db.get(id)
    if (audit === null || audit.is_public || !audit.guestTokenHash || !audit.guestTokenExpiresAt) return null
    if (audit.guestTokenExpiresAt <= Date.now()) return null
    if (await hashGuestToken(args.token) !== audit.guestTokenHash) return null
    return withoutPrivateOwnerFields(audit)
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

    const updated = await ctx.db.get(args.id)
    return updated === null ? null : withoutGuestSecret(updated)
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

/** Owner-only restart eligibility for completed audits or exhausted failures. */
export const retryEligibility = query({
  args: { id: v.id("audits") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx)
    const audit = await ctx.db.get(args.id)
    if (audit === null || audit.userId !== userId) return false
    if (audit.status === "done") return true
    if (audit.status !== "error") return false
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
    const cycle = audit.retryCycle ?? 0
    if (audit.status !== "done") {
      if (audit.status !== "error") throw new Error("Audit is not eligible for retry")
      const jobs = await ctx.db
        .query("auditJobs")
        .withIndex("by_auditId", (q) => q.eq("auditId", args.id))
        .collect()
      if (jobs.filter((job) => (job.retryCycle ?? 0) === cycle).length < 3) {
        throw new Error("Audit is not eligible for retry")
      }
    }
    await ctx.db.patch(args.id, {
      retryCycle: cycle + 1,
      status: "queued",
      audit_result: null,
      findings: undefined,
      report: undefined,
      error: undefined,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.auditPipeline.run, { auditId: args.id })
  },
})
