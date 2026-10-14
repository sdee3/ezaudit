import { defineSchema } from "convex/server"
import { auditsTables } from "./schema/audits"
import { auditJobsTables } from "./schema/auditJobs"

export default defineSchema({
  ...auditsTables,
  ...auditJobsTables,
})
