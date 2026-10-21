import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalAction, mutation } from "./_generated/server"
import { getOptionalUserId } from "./lib/auth"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const submit = mutation({
  args: {
    category: v.union(v.literal("feedback"), v.literal("child_safety")),
    email: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const message = args.message.trim()
    const email = args.email?.trim().toLowerCase()

    if (message.length < 10 || message.length > 5000) {
      throw new Error("Message must contain 10 to 5000 characters")
    }
    if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
      throw new Error("Enter a valid email address")
    }

    const feedbackId = await ctx.db.insert("feedback", {
      userId: await getOptionalUserId(ctx),
      email: email || undefined,
      category: args.category,
      message,
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.feedback.notify, {
      category: args.category,
      email: email || "Not provided",
      message,
      feedbackId: String(feedbackId),
    })

    return feedbackId
  },
})

export const notify = internalAction({
  args: {
    category: v.union(v.literal("feedback"), v.literal("child_safety")),
    email: v.string(),
    message: v.string(),
    feedbackId: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL
    if (!apiKey || !from) {
      console.error("[feedback] Email notice skipped: Resend is not configured")
      return
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: ["hello@ezaudit.me"],
        subject: args.category === "child_safety" ? "Child safety report" : "EZ Audit feedback",
        text: `Category: ${args.category}\nFrom: ${args.email}\nFeedback ID: ${args.feedbackId}\n\n${args.message}`,
      }),
    })

    if (!response.ok) {
      console.error(`[feedback] Email notice failed: HTTP ${response.status}`)
    }
  },
})
