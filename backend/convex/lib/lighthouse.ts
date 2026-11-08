export type CategoryScores = {
  accessibility: { score: number }
  bestPractices: { score: number }
  performance: { score: number }
  seo: { score: number }
}

export type Finding = {
  id: string
  category: "accessibility" | "bestPractices" | "performance" | "seo"
  title: string
  description: string
  score: number
  suggestedFixes: string[]
}

export type RunAuditResult = {
  auditId: string
  scores: CategoryScores
  findings: Finding[]
  report?: {
    finalUrl: string
    fetchedAt: string
    lighthouseVersion: string
    formFactor: string
    metrics: { id: string; title: string; value: number; unit: string; displayValue: string }[]
    checks: { id: string; category: Finding["category"]; title: string; score: number; displayValue: string; weight: number }[]
  }
  workerRequestId?: string
}

function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function seededScore(domain: string, salt: number): number {
  const h = hashString(`${domain}::${salt}`)
  return Math.round((h / 0xffffffff) * 100) / 100
}

export function seededScores(domain: string): CategoryScores {
  return {
    performance: { score: seededScore(domain, 1) },
    accessibility: { score: seededScore(domain, 2) },
    bestPractices: { score: seededScore(domain, 3) },
    seo: { score: seededScore(domain, 4) },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isScore(value: unknown): value is { score: number } {
  return (
    isRecord(value) &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    value.score <= 1
  )
}

function isFinding(value: unknown): value is Finding {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.category === "string" &&
    ["accessibility", "bestPractices", "performance", "seo"].includes(value.category) &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.description === "string" &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    value.score <= 1 &&
    Array.isArray(value.suggestedFixes) &&
    value.suggestedFixes.every((fix) => typeof fix === "string")
  )
}

function isReport(value: unknown): value is NonNullable<RunAuditResult["report"]> {
  return isRecord(value) && typeof value.finalUrl === "string" &&
    typeof value.fetchedAt === "string" && typeof value.lighthouseVersion === "string" &&
    typeof value.formFactor === "string" && Array.isArray(value.metrics) &&
    value.metrics.every((metric) => isRecord(metric) && typeof metric.id === "string" &&
      typeof metric.title === "string" && typeof metric.value === "number" &&
      typeof metric.unit === "string" && typeof metric.displayValue === "string") &&
    Array.isArray(value.checks) && value.checks.every((check) => isRecord(check) &&
      typeof check.id === "string" && ["accessibility", "bestPractices", "performance", "seo"].includes(String(check.category)) &&
      typeof check.title === "string" && typeof check.score === "number" &&
      typeof check.displayValue === "string" && typeof check.weight === "number")
}

export function parseWorkerResponse(body: unknown, auditId: string): RunAuditResult {
  if (!isRecord(body)) {
    throw new Error("Lighthouse worker returned a non-object body")
  }
  if (body.auditId !== auditId) {
    throw new Error("Lighthouse worker response audit ID does not match")
  }
  const rawScores = body.scores ?? body
  if (
    !isRecord(rawScores) ||
    !isScore(rawScores.performance) ||
    !isScore(rawScores.accessibility) ||
    !isScore(rawScores.bestPractices) ||
    !isScore(rawScores.seo)
  ) {
    throw new Error("Lighthouse worker response is missing the four category scores")
  }
  if (!Array.isArray(body.findings) || !body.findings.every(isFinding)) {
    throw new Error("Lighthouse worker response has malformed findings")
  }
  if (body.report !== undefined && !isReport(body.report)) {
    throw new Error("Lighthouse worker response has malformed report context")
  }
  return {
    auditId,
    scores: {
      performance: { score: rawScores.performance.score },
      accessibility: { score: rawScores.accessibility.score },
      bestPractices: { score: rawScores.bestPractices.score },
      seo: { score: rawScores.seo.score },
    },
    findings: body.findings,
    report: isReport(body.report) ? body.report : undefined,
    workerRequestId: typeof body.requestId === "string" ? body.requestId : undefined,
  }
}
