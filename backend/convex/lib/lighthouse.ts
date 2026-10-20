export type CategoryScores = {
  accessibility: { score: number }
  bestPractices: { score: number }
  performance: { score: number }
  seo: { score: number }
}

export type RunAuditResult = {
  scores: CategoryScores
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
  return isRecord(value) && typeof value.score === "number" && value.score >= 0 && value.score <= 1
}

export function parseWorkerResponse(body: unknown): RunAuditResult {
  if (!isRecord(body)) {
    throw new Error("Lighthouse worker returned a non-object body")
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
  return {
    scores: {
      performance: { score: rawScores.performance.score },
      accessibility: { score: rawScores.accessibility.score },
      bestPractices: { score: rawScores.bestPractices.score },
      seo: { score: rawScores.seo.score },
    },
    workerRequestId: typeof body.requestId === "string" ? body.requestId : undefined,
  }
}
