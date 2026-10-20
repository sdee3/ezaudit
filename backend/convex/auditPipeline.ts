import { v } from "convex/values"
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { ActionCtx, MutationCtx } from "./_generated/server"
import { sendAuditReadyEmail } from "./lib/email"

/**
 * Audit pipeline (spec 04): enqueue → run → persist → notify.
 *
 * `run` executes one attempt: mark running (recording an `auditJobs` row),
 * call the Lighthouse runner, persist scores + status done, notify by email.
 * On failure the attempt row and the audit are marked error and a bounded
 * retry (max 3 attempts total) is scheduled with backoff.
 */

const MAX_ATTEMPTS = 3
/** Backoff between attempts: 5s, 10s (ms). */
const BACKOFF_MS = 5_000

type AttemptOutcome = { status: "done" | "error" | "skipped"; attempt: number }

async function performAttempt(
  ctx: ActionCtx,
  auditId: Id<"audits">
): Promise<AttemptOutcome> {
  const audit = await ctx.runQuery(internal.auditPipeline.getAudit, { auditId })
  // Nothing to do for missing rows; skip re-running already-completed audits.
  if (audit === null || audit.status === "done") {
    return { status: "skipped", attempt: 0 }
  }

  const attempt = await ctx.runMutation(internal.auditPipeline.markRunning, { auditId })

  try {
    const { scores, workerRequestId } = await ctx.runAction(
      internal.lighthouseWorker.runAudit,
      { domain: audit.domain },
    )
    await ctx.runMutation(internal.auditPipeline.markDone, {
      auditId,
      attempt,
      audit_result: scores,
      workerRequestId,
    })
    // Never throws; a Resend failure must not fail the audit.
    await sendAuditReadyEmail({ to: audit.email, domain: audit.domain, auditId })
    return { status: "done", attempt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.runMutation(internal.auditPipeline.markError, {
      auditId,
      attempt,
      error: message,
    })
    if (attempt < MAX_ATTEMPTS) {
      await ctx.scheduler.runAfter(BACKOFF_MS * attempt, internal.auditPipeline.retry, {
        auditId,
      })
    }
    return { status: "error", attempt }
  }
}

/** Internal entry point scheduled by `audits.submit`. */
export const run = internalAction({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => performAttempt(ctx, args.auditId),
})

/**
 * Bounded retry (max 3 attempts total, counting the original run). Each retry
 * performs one more attempt; further backoff is re-scheduled from within the
 * attempt itself on failure.
 */
export const retry = internalAction({
  args: { auditId: v.id("audits") },
  handler: async (
    ctx,
    args,
  ): Promise<AttemptOutcome | { status: "exhausted"; attempt: number }> => {
    const attempts: number = await ctx.runQuery(
      internal.auditPipeline.countAttempts,
      { auditId: args.auditId },
    )
    if (attempts >= MAX_ATTEMPTS) {
      return { status: "exhausted", attempt: attempts }
    }
    return performAttempt(ctx, args.auditId)
  },
})

export const getAudit = internalQuery({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => ctx.db.get(args.auditId),
})

export const countAttempts = internalQuery({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("auditJobs")
        .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
        .collect()
    ).length,
})

/** Marks the audit + a new auditJobs row running. Returns the attempt number. */
export const markRunning = internalMutation({
  args: { auditId: v.id("audits") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("auditJobs")
      .withIndex("by_auditId", (q) => q.eq("auditId", args.auditId))
      .collect()
    const attempt = jobs.length + 1
    const now = Date.now()

    await ctx.db.insert("auditJobs", {
      auditId: args.auditId,
      attempt,
      startedAt: now,
      status: "running",
    })
    await ctx.db.patch(args.auditId, {
      status: "running",
      error: undefined,
      updatedAt: now,
    })

    return attempt
  },
})

export const markDone = internalMutation({
  args: {
    auditId: v.id("audits"),
    attempt: v.number(),
audit_result: v.object({
      accessibility: v.object({ score: v.number() }),
      bestPractices: v.object({ score: v.number() }),
      performance: v.object({ score: v.number() }),
      seo: v.object({ score: v.number() }),
    }),
    workerRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.auditId, {
      status: "done",
      audit_result: args.audit_result,
      error: undefined,
      updatedAt: now,
    })
    await updateJobRow(ctx, args.auditId, args.attempt, {
      finishedAt: now,
      status: "done",
      workerRequestId: args.workerRequestId,
    })
  },
})

export const markError = internalMutation({
  args: {
    auditId: v.id("audits"),
    attempt: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.auditId, {
      status: "error",
      error: args.error,
      updatedAt: now,
    })
    await updateJobRow(ctx, args.auditId, args.attempt, {
      finishedAt: now,
      status: "error",
      error: args.error,
    })
  },
})

async function updateJobRow(
  ctx: MutationCtx,
  auditId: Id<"audits">,
  attempt: number,
  patch: { finishedAt: number; status: "done" | "error"; error?: string; workerRequestId?: string },
) {
  const job = await ctx.db
    .query("auditJobs")
    .withIndex("by_auditId", (q) => q.eq("auditId", auditId))
    .filter((q) => q.eq(q.field("attempt"), attempt))
    .first()
  if (job !== null) {
    await ctx.db.patch(job._id, patch)
  }
}
