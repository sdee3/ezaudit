import { expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { createConvexTest } from "../test/createConvexTest"

/**
 * Co-located convex-test suite for the public audits API (spec 07).
 * Authenticate with t.withIdentity({ subject: "user_1" }).
 */

const VALID = { domain: "https://example.com", email: "owner@example.com" }

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

test("submit requires no auth and creates a queued, ownerless audit", async () => {
  const t = createConvexTest()

  const id = await t.mutation(api.audits.submit, VALID)

  const audit = await t.run(async (ctx) => await ctx.db.get(id as Id<"audits">))
  expect(audit).toMatchObject({
    userId: null,
    email: "owner@example.com",
    domain: "https://example.com",
    status: "queued",
    audit_result: null,
    is_public: false,
  })
})

test("submit validates the domain", async () => {
  const t = createConvexTest()

  await expect(
    t.mutation(api.audits.submit, { ...VALID, domain: "not a domain" }),
  ).rejects.toThrowError(/domain/i)

  await expect(
    t.mutation(api.audits.submit, { ...VALID, domain: "example" }),
  ).rejects.toThrowError(/domain/i)
})

test("submit validates the email", async () => {
  const t = createConvexTest()

  await expect(
    t.mutation(api.audits.submit, { ...VALID, email: "nope" }),
  ).rejects.toThrowError(/email/i)
})

test("submit schedules the pipeline run", async () => {
  vi.useFakeTimers()
  const t = createConvexTest()

  await t.mutation(api.audits.submit, VALID)
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const queued = await t.run(async (ctx) => await ctx.db.query("audits").first())
  expect(queued).toMatchObject({ status: "done" })

  const jobs = await t.run(async (ctx) => await ctx.db.query("auditJobs").collect())
  expect(jobs).toHaveLength(1)
  expect(jobs[0]).toMatchObject({ attempt: 1, status: "done" })

  vi.useRealTimers()
})

test("listMine is ordered newest first and scoped to the owner", async () => {
  const t = createConvexTest()

  await insertAudit(t, { userId: "user_1", date_of_request: 100 })
  await insertAudit(t, { userId: "user_1", date_of_request: 300 })
  await insertAudit(t, { userId: "user_2", date_of_request: 999 })

  const asUser1 = t.withIdentity({ subject: "user_1" })
  const asUser2 = t.withIdentity({ subject: "user_2" })

  const mine = await asUser1.query(api.audits.listMine, {})
  expect(mine.map((a) => a.date_of_request)).toEqual([300, 100])

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

test("setVisibility requires auth and ownership", async () => {
  const t = createConvexTest()

  const id = await insertAudit(t, { userId: "user_1", is_public: false })

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
})

test("pipeline marks audits error and retries up to 3 attempts when the worker fails", async () => {
  vi.useFakeTimers()
  vi.stubEnv("LIGHTHOUSE_WORKER_URL", "https://worker.example/run")
  const failingFetch = vi.fn(async () => {
    throw new Error("worker unreachable")
  })
  vi.stubGlobal("fetch", failingFetch)

  try {
    const t = createConvexTest()
    const id = await t.mutation(api.audits.submit, VALID)

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

test("internal.auditPipeline.retry is exposed for bounded retries", async () => {
  const t = createConvexTest()
  const id = await insertAudit(t, { status: "error", userId: "user_1" })

  // 0 recorded attempts + audit in error state → retry performs a full attempt.
  await t.action(internal.auditPipeline.retry, { auditId: id as Id<"audits"> })

  const audit = await t.run(async (ctx) => await ctx.db.get(id as Id<"audits">))
  expect(audit).toMatchObject({ status: "done" })
})
