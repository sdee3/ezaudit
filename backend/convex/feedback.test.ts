import { expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import { createConvexTest } from "../test/createConvexTest"

test("submit stores normalized feedback and schedules a notice", async () => {
  const t = createConvexTest()

  await t.withIdentity({ subject: "user_1" }).mutation(api.feedback.submit, {
    category: "child_safety",
    email: "  REPORTER@EXAMPLE.COM ",
    message: "Please review this page: https://example.com/report",
  })

  const feedback = await t.run((ctx) => ctx.db.query("feedback").first())
  expect(feedback).toMatchObject({
    userId: "user_1",
    category: "child_safety",
    email: "reporter@example.com",
    message: "Please review this page: https://example.com/report",
  })
})

test("submit rejects short messages and invalid email addresses", async () => {
  const t = createConvexTest()

  await expect(
    t.mutation(api.feedback.submit, {
      category: "feedback",
      message: "short",
    }),
  ).rejects.toThrowError(/10 to 5000/)
  await expect(
    t.mutation(api.feedback.submit, {
      category: "feedback",
      email: "invalid",
      message: "A long enough message.",
    }),
  ).rejects.toThrowError(/valid email/)
})

test("notify sends feedback through the mocked email API", async () => {
  vi.stubEnv("RESEND_API_KEY", "test-key")
  vi.stubEnv("RESEND_FROM_EMAIL", "ezaudit@example.com")
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)

  try {
    const t = createConvexTest()
    await t.action(internal.feedback.notify, {
      category: "feedback",
      email: "reporter@example.com",
      message: "The report needs a copy link.",
      feedbackId: "feedback_test_id",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: expect.stringContaining("The report needs a copy link."),
      }),
    )
  } finally {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  }
})
