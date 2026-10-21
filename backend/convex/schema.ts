import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { auditsTables } from "./schema/audits"
import { auditJobsTables } from "./schema/auditJobs"

export default defineSchema({
  ...auditsTables,
  ...auditJobsTables,
  feedback: defineTable({
    userId: v.union(v.string(), v.null()),
    email: v.optional(v.string()),
    category: v.union(v.literal("feedback"), v.literal("child_safety")),
    message: v.string(),
    createdAt: v.number(),
  }),
})
