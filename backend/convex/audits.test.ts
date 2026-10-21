import { expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { createConvexTest } from "../test/createConvexTest"
import { allowsSeededScores, toWorkerUrl } from "./lighthouseWorker"
import { parseWorkerResponse, seededScores } from "./lib/lighthouse"

/**
 * Co-located convex-test suite for the public audits API (spec 07).
 * Authenticate with t.withIdentity({ subject: "user_1" }).
 */

const VALID = { domain: "https://example.com", email: "owner@example.com" }
const OWNER = { subject: "user_1", email: "owner@example.com", email_verified: true }
const FINDING = {
  id: "image-alt",
  category: "accessibility" as const,
  title: "Image elements do not have [alt] attributes",
  description: "Add alternative text to image elements.",
  score: 0,
  suggestedFixes: ["Add alternative text to image elements."],
}

function submitAs(
  t: ReturnType<typeof createConvexTest>,
  identity = OWNER,
  args = VALID,
) {
  return t.withIdentity(identity).mutation(api.audits.submit, args)
}

async function hashGuestToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function insertAudit(
  t: ReturnType<typeof createConvexTest>,
  overrides: Partial<{
    userId: string | null
    email: string
    domain: string
    status: "queued" | "running" | "done" | "error"
    is_public: boolean
    date_of_request: number
    audit_result: null
    guestTokenHash: string
    guestTokenExpiresAt: number
  }> = {},
): Promise<Id<"audits">> {
  const id = await t.run(async (ctx) => {
    return await ctx.db.insert("audits", {
      userId: null,
      email: "someone@example.com",
      domain: "example.com",
      status: "queued",
      audit_result: null,
      is_public: false,
      date_of_request: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    })
  })
  return id as Id<"audits">
}

test("submit requires a verified matching email and creates an owner audit", async () => {
  const t = createConvexTest()

  await expect(t.mutation(api.audits.submit, VALID)).rejects.toThrowError("Not authenticated")
  await expect(submitAs(t, { ...OWNER, email_verified: false })).rejects.toThrowError(/verified/i)
  await expect(submitAs(t, { ...OWNER, email: "other@example.com" })).rejects.toThrowError(/verified/i)

  const { auditId: id } = await submitAs(t)

  const audit = await t.run(async (ctx) => await ctx.db.get(id))
  expect(audit).toMatchObject({
    userId: OWNER.subject,
    email: "owner@example.com",
    domain: "https://example.com",
    status: "queued",
    audit_result: null,
    is_public: false,
  })
  expect(audit?.guestTokenHash).toBeUndefined()
  expect(await t.withIdentity(OWNER).query(api.audits.get, { id })).toMatchObject({ _id: id })
})

test("getGuest rejects expired tokens", async () => {
  const t = createConvexTest()
  const token = "legacy-guest-token"
  const auditId = await insertAudit(t, {
    guestTokenHash: await hashGuestToken(token),
    guestTokenExpiresAt: Date.now() - 1,
  })
  expect(await t.query(api.audits.getGuest, { id: auditId, token })).toBeNull()
})

test("getGuest omits owner fields from legacy guest reports", async () => {
  const t = createConvexTest()
  const token = "legacy-guest-token"
  const auditId = await insertAudit(t, {
    userId: "legacy-owner",
    email: "private@example.com",
    guestTokenHash: await hashGuestToken(token),
    guestTokenExpiresAt: Date.now() + 60_000,
  })

  const report = await t.query(api.audits.getGuest, { id: auditId, token })
  expect(report).toMatchObject({ _id: auditId })
  expect(report).not.toHaveProperty("email")
  expect(report).not.toHaveProperty("userId")
  expect(report).not.toHaveProperty("guestTokenHash")
})

test("submit validates the domain", async () => {
  const t = createConvexTest()

  await expect(
    submitAs(t, OWNER, { ...VALID, domain: "not a domain" }),
  ).rejects.toThrowError(/domain/i)

  await expect(
    submitAs(t, OWNER, { ...VALID, domain: "example" }),
  ).rejects.toThrowError(/domain/i)
})

test("signed-in submission keeps owner access and does not issue a guest token", async () => {
  const t = createConvexTest()
  const result = await submitAs(t)

  expect(result).toMatchObject({ auditId: expect.any(String) })
  expect(result).not.toHaveProperty("guestToken")
  expect(await t.withIdentity(OWNER).query(api.audits.get, { id: result.auditId }))
    .toMatchObject({ userId: "user_1", is_public: false })
})

test("submit validates the email", async () => {
  const t = createConvexTest()

  await expect(
    submitAs(t, OWNER, { ...VALID, email: "nope" }),
  ).rejects.toThrowError(/email/i)
})

test("submit schedules the pipeline run", async () => {
  vi.useFakeTimers()
  // The pipeline reaches `done` through the seeded fallback (spec 04).
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "true")

  const t = createConvexTest()

  await submitAs(t)
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const queued = await t.run(async (ctx) => await ctx.db.query("audits").first())
  expect(queued).toMatchObject({ status: "done" })

  const jobs = await t.run(async (ctx) => await ctx.db.query("auditJobs").collect())
  expect(jobs).toHaveLength(1)
  expect(jobs[0]).toMatchObject({ attempt: 1, status: "done" })

  vi.unstubAllEnvs()
  vi.useRealTimers()
})

test("submit applies hourly user, email, and global limits", async () => {
  const emailTest = createConvexTest()
  for (const subject of ["email-user-1", "email-user-2", "email-user-3"]) {
    await submitAs(emailTest, { subject, email: "owner@example.com", email_verified: true }, {
      ...VALID,
      email: "OWNER@example.com",
    })
  }
  await expect(submitAs(emailTest, {
    subject: "email-user-4",
    email: "owner@example.com",
    email_verified: true,
  })).rejects.toThrowError(/rate limit/i)

  const userTest = createConvexTest()
  for (let index = 0; index < 5; index += 1) {
    const email = `user-${index}@example.com`
    await submitAs(userTest, { subject: "limited-user", email, email_verified: true }, {
      ...VALID,
      email,
    })
  }
  await expect(submitAs(userTest, {
    subject: "limited-user",
    email: "user-5@example.com",
    email_verified: true,
  }, { ...VALID, email: "user-5@example.com" })).rejects.toThrowError(/rate limit/i)

  const globalTest = createConvexTest()
  for (let index = 0; index < 100; index += 1) {
    const email = `global-${index}@example.com`
    await submitAs(globalTest, { subject: `global-user-${index}`, email, email_verified: true }, {
      ...VALID,
      email,
    })
  }
  await expect(submitAs(globalTest, {
    subject: "global-user-100",
    email: "global-100@example.com",
    email_verified: true,
  }, { ...VALID, email: "global-100@example.com" })).rejects.toThrowError(/rate limit/i)
})

test("listMine is ordered newest first and scoped to the owner", async () => {
  const t = createConvexTest()

  await insertAudit(t, { userId: "user_1", date_of_request: 100, guestTokenHash: "private-hash", guestTokenExpiresAt: 1000 })
  await insertAudit(t, { userId: "user_1", date_of_request: 300 })
  await insertAudit(t, { userId: "user_2", date_of_request: 999 })

  const asUser1 = t.withIdentity({ subject: "user_1" })
  const asUser2 = t.withIdentity({ subject: "user_2" })

  const mine = await asUser1.query(api.audits.listMine, {})
  expect(mine.map((a) => a.date_of_request)).toEqual([300, 100])
  expect(mine[1]).not.toHaveProperty("guestTokenHash")

  const theirs = await asUser2.query(api.audits.listMine, {})
  expect(theirs.map((a) => a.date_of_request)).toEqual([999])
})

test("listMine throws when unauthenticated", async () => {
  const t = createConvexTest()
  await expect(t.query(api.audits.listMine, {})).rejects.toThrowError(
    "Not authenticated",
  )
})

test("get serves public audits to anyone and private audits only to the owner", async () => {
  const t = createConvexTest()

  const privateId = await insertAudit(t, { userId: "user_1", is_public: false })
  const publicId = await insertAudit(t, { userId: "user_2", is_public: true })

  // signed-out: public readable, private not (existence not leaked)
  expect(await t.query(api.audits.get, { id: publicId as Id<"audits"> })).toMatchObject({
    is_public: true,
  })
  const publicAudit = await t.query(api.audits.get, { id: publicId as Id<"audits"> })
  expect(publicAudit).not.toHaveProperty("email")
  expect(publicAudit).not.toHaveProperty("userId")
  expect(await t.query(api.audits.get, { id: privateId as Id<"audits"> })).toBeNull()

  // other users: private not readable
  const asUser2 = t.withIdentity({ subject: "user_2" })
  expect(await asUser2.query(api.audits.get, { id: privateId as Id<"audits"> })).toBeNull()

  // owner: private readable
  const asUser1 = t.withIdentity({ subject: "user_1" })
  expect(await asUser1.query(api.audits.get, { id: privateId as Id<"audits"> })).toMatchObject({
    userId: "user_1",
  })
})

test("get returns null for a malformed id instead of throwing", async () => {
  const t = createConvexTest()

  expect(await t.query(api.audits.get, { id: "not-a-convex-id" })).toBeNull()
  expect(await t.query(api.audits.get, { id: "" })).toBeNull()
})

test("setVisibility requires auth and ownership", async () => {
  const t = createConvexTest()

  const id = await insertAudit(t, {
    userId: "user_1",
    is_public: false,
    guestTokenHash: "private-hash",
    guestTokenExpiresAt: 1000,
  })

  // unauthenticated
  await expect(t.mutation(api.audits.setVisibility, { id: id as Id<"audits"> })).rejects.toThrowError(
    "Not authenticated",
  )

  // non-owner is rejected (and existence is not leaked)
  const asUser2 = t.withIdentity({ subject: "user_2" })
  await expect(
    asUser2.mutation(api.audits.setVisibility, { id: id as Id<"audits"> }),
  ).rejects.toThrowError("Not found")

  // owner toggles is_public and gets the updated doc back
  const asUser1 = t.withIdentity({ subject: "user_1" })
  const updated = await asUser1.mutation(api.audits.setVisibility, { id: id as Id<"audits"> })
  expect(updated).toMatchObject({ is_public: true })
  expect(updated).not.toHaveProperty("guestTokenHash")
})

test("remove requires the owner and deletes the report and its attempt history", async () => {
  const t = createConvexTest()
  const id = await insertAudit(t, { userId: "user_1", is_public: true })
  await t.run(async (ctx) => {
    await ctx.db.insert("auditJobs", {
      auditId: id,
      attempt: 1,
      startedAt: 1,
      status: "error",
    })
  })

  await expect(t.mutation(api.audits.remove, { id })).rejects.toThrowError("Not authenticated")
  await expect(
    t.withIdentity({ subject: "user_2" }).mutation(api.audits.remove, { id }),
  ).rejects.toThrowError("Not found")
  expect(await t.query(api.audits.get, { id })).toMatchObject({ is_public: true })

  await t.withIdentity({ subject: "user_1" }).mutation(api.audits.remove, { id })
  expect(await t.query(api.audits.get, { id })).toBeNull()
  expect(await t.run(async (ctx) => await ctx.db.query("auditJobs").collect())).toEqual([])
})

test("retry eligibility requires an owned final failure", async () => {
  const t = createConvexTest()
  const id = await insertAudit(t, { userId: "user_1", status: "error" })
  const asOwner = t.withIdentity({ subject: "user_1" })
  const addAttempts = async (count: number) => {
    await t.run(async (ctx) => {
      for (let attempt = 1; attempt <= count; attempt++) {
        await ctx.db.insert("auditJobs", {
          auditId: id,
          attempt,
          startedAt: attempt,
          status: "error",
        })
      }
    })
  }

  await expect(t.query(api.audits.retryEligibility, { id })).rejects.toThrowError("Not authenticated")
  expect(await t.withIdentity({ subject: "user_2" }).query(api.audits.retryEligibility, { id })).toBe(false)
  expect(await asOwner.query(api.audits.retryEligibility, { id })).toBe(false)
  await addAttempts(2)
  expect(await asOwner.query(api.audits.retryEligibility, { id })).toBe(false)
  await expect(asOwner.mutation(api.audits.retry, { id })).rejects.toThrowError(
    "Audit is not eligible for retry",
  )
  await addAttempts(1)
  expect(await asOwner.query(api.audits.retryEligibility, { id })).toBe(true)
})

test("an eligible retry starts a fresh three-attempt cycle without a credit debit", async () => {
  vi.useFakeTimers()
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "true")
  try {
    const t = createConvexTest()
    const id = await insertAudit(t, { userId: "user_1", status: "error" })
    await t.run(async (ctx) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        await ctx.db.insert("auditJobs", {
          auditId: id,
          attempt,
          startedAt: attempt,
          finishedAt: attempt,
          status: "error",
        })
      }
    })

    await t.withIdentity({ subject: "user_1" }).mutation(api.audits.retry, { id })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const audit = await t.run(async (ctx) => await ctx.db.get(id))
    expect(audit).toMatchObject({ status: "done", retryCycle: 1 })
    const jobs = await t.run(async (ctx) =>
      await ctx.db.query("auditJobs").withIndex("by_auditId", (q) => q.eq("auditId", id)).collect(),
    )
    expect(jobs).toHaveLength(4)
    expect(jobs.filter((job) => job.retryCycle === 1)).toMatchObject([
      { attempt: 1, status: "done" },
    ])
    // EZ Audit has no paid debit mutation. Retry only starts the new pipeline cycle.
  } finally {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  }
})

test("pipeline marks audits error and retries up to 3 attempts when the worker fails", async () => {
  vi.useFakeTimers()
  vi.stubEnv("LIGHTHOUSE_WORKER_URL", "https://worker.lambda-url.us-east-1.on.aws/run")
  vi.stubEnv("LIGHTHOUSE_AWS_ACCESS_KEY_ID", "test-access-key")
  vi.stubEnv("LIGHTHOUSE_AWS_SECRET_ACCESS_KEY", "test-secret-key")
  const failingFetch = vi.fn(async () => {
    throw new Error("worker unreachable")
  })
  vi.stubGlobal("fetch", failingFetch)

  try {
    const t = createConvexTest()
    const { auditId: id } = await submitAs(t)

    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const audit = await t.run(async (ctx) => await ctx.db.get(id as Id<"audits">))
    expect(audit).toMatchObject({
      status: "error",
      error: expect.stringContaining("worker unreachable"),
    })

    const jobs = await t.run(async (ctx) => await ctx.db.query("auditJobs").collect())
    expect(jobs).toHaveLength(3)
    expect(jobs.map((j) => j.attempt).sort()).toEqual([1, 2, 3])
    expect(jobs.every((j) => j.status === "error")).toBe(true)
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  }
})

test("pipeline persists worker findings and preserves all category scores", async () => {
  vi.useFakeTimers()
  vi.stubEnv("LIGHTHOUSE_WORKER_URL", "https://worker.lambda-url.us-east-1.on.aws/run")
  vi.stubEnv("LIGHTHOUSE_AWS_ACCESS_KEY_ID", "test-access-key")
  vi.stubEnv("LIGHTHOUSE_AWS_SECRET_ACCESS_KEY", "test-secret-key")
  const workerFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { auditId: string }
    return new Response(JSON.stringify({
      auditId: request.auditId,
      requestId: "worker-req-1",
      scores: {
        performance: { score: 0.91 },
        accessibility: { score: 0.82 },
        bestPractices: { score: 0.73 },
        seo: { score: 0.64 },
      },
      findings: [FINDING],
    }), { status: 200, headers: { "content-type": "application/json" } })
  })
  vi.stubGlobal("fetch", workerFetch)

  try {
    const t = createConvexTest()
    const { auditId: id } = await submitAs(t)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const sentBody = JSON.parse(String(workerFetch.mock.calls[0]?.[1]?.body)) as { auditId: string }
    expect(sentBody.auditId).toBe(id)

    const audit = await t.run(async (ctx) => await ctx.db.get(id as Id<"audits">))
    expect(audit).toMatchObject({
      status: "done",
      audit_result: {
        performance: { score: 0.91 },
        accessibility: { score: 0.82 },
        bestPractices: { score: 0.73 },
        seo: { score: 0.64 },
      },
      findings: [FINDING],
    })
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  }
})

test("internal.auditPipeline.retry is exposed for bounded retries", async () => {
  // Retries reach `done` through the seeded fallback (spec 04).
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "true")

  try {
    const t = createConvexTest()
    const id = await insertAudit(t, { status: "error", userId: "user_1" })

    // 0 recorded attempts + audit in error state → retry performs a full attempt.
    await t.action(internal.auditPipeline.retry, { auditId: id as Id<"audits"> })

    const audit = await t.run(async (ctx) => await ctx.db.get(id as Id<"audits">))
    expect(audit).toMatchObject({ status: "done" })
  } finally {
    vi.unstubAllEnvs()
  }
})

/**
 * Seeded-score guard: invented scores must never be reported unless the
 * deployment explicitly opts in with LIGHTHOUSE_ALLOW_SEEDED_SCORES=true.
 */

test("allowsSeededScores is true only for the literal \"true\" flag", () => {
  expect(allowsSeededScores({})).toBe(false)
  expect(allowsSeededScores({ LIGHTHOUSE_ALLOW_SEEDED_SCORES: "" })).toBe(false)
  expect(allowsSeededScores({ LIGHTHOUSE_ALLOW_SEEDED_SCORES: "1" })).toBe(false)
  expect(allowsSeededScores({ LIGHTHOUSE_ALLOW_SEEDED_SCORES: "TRUE" })).toBe(false)
  expect(allowsSeededScores({ LIGHTHOUSE_ALLOW_SEEDED_SCORES: "true" })).toBe(true)
})

test("runAudit throws when the worker URL is unset and seeded scores are not allowed", async () => {
  vi.stubEnv("LIGHTHOUSE_WORKER_URL", "")
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "")

  try {
    const t = createConvexTest()
    const auditId = await insertAudit(t)
    await expect(
      t.action(internal.lighthouseWorker.runAudit, {
        auditId,
        domain: "example.com",
      }),
    ).rejects.toThrowError("LIGHTHOUSE_WORKER_URL is not configured")
  } finally {
    vi.unstubAllEnvs()
  }
})

test("runAudit returns seeded scores when the flag is true and the URL is unset", async () => {
  vi.stubEnv("LIGHTHOUSE_WORKER_URL", "")
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "true")

  try {
    const t = createConvexTest()
    const auditId = await insertAudit(t)
    const result = await t.action(internal.lighthouseWorker.runAudit, { auditId, domain: "example.com" })
    expect(result).toEqual({ auditId, scores: seededScores("example.com"), findings: [] })
  } finally {
    vi.unstubAllEnvs()
  }
})

test("toWorkerUrl adds https:// only when the scheme is missing", () => {
  expect(toWorkerUrl("novinky.cz")).toBe("https://novinky.cz")
  expect(toWorkerUrl("sdee3.com/blog")).toBe("https://sdee3.com/blog")
  expect(toWorkerUrl("https://news.ycombinator.com")).toBe("https://news.ycombinator.com")
  expect(toWorkerUrl("HTTP://example.com")).toBe("HTTP://example.com")
})

test("parseWorkerResponse ignores the seeded-score flag", () => {
  vi.stubEnv("LIGHTHOUSE_ALLOW_SEEDED_SCORES", "true")

  try {
    const parsed = parseWorkerResponse({
      auditId: "audits:expected",
      requestId: "req-1",
      scores: {
        performance: { score: 0.91 },
        accessibility: { score: 0.82 },
        bestPractices: { score: 0.73 },
        seo: { score: 0.64 },
      },
      findings: [FINDING],
    }, "audits:expected")
    expect(parsed).toEqual({
      auditId: "audits:expected",
      scores: {
        performance: { score: 0.91 },
        accessibility: { score: 0.82 },
        bestPractices: { score: 0.73 },
        seo: { score: 0.64 },
      },
      findings: [FINDING],
      workerRequestId: "req-1",
    })
    expect(parsed.scores).not.toEqual(seededScores("example.com"))

    // Still rejects malformed bodies, flag or not.
    expect(() => parseWorkerResponse({ auditId: "audits:expected", scores: { performance: { score: 2 } } }, "audits:expected")).toThrowError(
      /four category scores/,
    )
    const validScores = {
      performance: { score: 0.91 },
      accessibility: { score: 0.82 },
      bestPractices: { score: 0.73 },
      seo: { score: 0.64 },
    }
    expect(() => parseWorkerResponse({ auditId: "audits:expected", scores: validScores }, "audits:expected")).toThrowError(/malformed findings/)
    expect(() => parseWorkerResponse({ auditId: "audits:expected", scores: validScores, findings: [{ ...FINDING, title: 2 }] }, "audits:expected"))
      .toThrowError(/malformed findings/)
    expect(() => parseWorkerResponse({
      auditId: "audits:expected",
      scores: validScores,
      findings: [{ ...FINDING, suggestedFixes: [null] }],
    }, "audits:expected")).toThrowError(/malformed findings/)
    expect(() => parseWorkerResponse({
      auditId: "audits:expected",
      scores: validScores,
      findings: [{ ...FINDING, suggestedFixes: undefined }],
    }, "audits:expected")).toThrowError(/malformed findings/)

    expect(() => parseWorkerResponse({
      auditId: "audits:other",
      scores: validScores,
      findings: [FINDING],
    }, "audits:expected")).toThrowError(/audit ID does not match/)
  } finally {
    vi.unstubAllEnvs()
  }
})
