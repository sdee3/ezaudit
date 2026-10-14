/**
 * Deterministic Lighthouse runner (spec 04 / ADR 0001).
 *
 * Two modes:
 *
 * 1. REMOTE (production): when `LIGHTHOUSE_WORKER_URL` is set, POST `{ url }` to
 *    the AWS Lambda Function URL with `Authorization: Bearer <LIGHTHOUSE_WORKER_SECRET>`
 *    and expect the four category scores back.
 *
 * 2. DEV-SEED (default in dev): when `LIGHTHOUSE_WORKER_URL` is NOT set, return
 *    deterministic placeholder scores derived from a simple hash of the domain
 *    so the full submit → run → done flow works end to end without a worker.
 *    Scores are stable per domain, in the 0..1 range (the same values Lighthouse
 *    would report).
 *
 * The worker response shape is `{ requestId?, scores: { performance: { score },
 * accessibility: { score }, 'best-practices': { score }, seo: { score } } }` and
 * is what lib/lighthouse returns.
 */
export type CategoryScores = {
  accessibility: { score: number }
  // Valid-identifier key — Convex schema/function validators reject hyphens.
  bestPractices: { score: number }
  performance: { score: number }
  seo: { score: number }
}

export type RunAuditResult = {
  scores: CategoryScores
  workerRequestId?: string
}

/** 32-bit FNV-1a hash — small, dependency-free, deterministic. */
function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Derive a stable 0..1 pseudo-score from the domain hash (dev-seed mode). */
function seededScore(domain: string, salt: number): number {
  const h = hashString(`${domain}::${salt}`)
  return Math.round((h / 0xffffffff) * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isScore(value: unknown): value is { score: number } {
  return isRecord(value) && typeof value.score === "number" && value.score >= 0 && value.score <= 1
}

function parseWorkerResponse(body: unknown): RunAuditResult {
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
    workerRequestId:
      typeof body.requestId === "string" ? body.requestId : undefined,
  }
}

export async function runAudit(domain: string): Promise<RunAuditResult> {
  const workerUrl = process.env.LIGHTHOUSE_WORKER_URL

  if (!workerUrl) {
    // DEV-SEED MODE: no worker configured — derive deterministic placeholder
    // scores from the domain so audits reach status "done" end to end in dev.
    const scores: CategoryScores = {
      performance: { score: seededScore(domain, 1) },
      accessibility: { score: seededScore(domain, 2) },
      bestPractices: { score: seededScore(domain, 3) },
      seo: { score: seededScore(domain, 4) },
    }
    return { scores }
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LIGHTHOUSE_WORKER_SECRET
        ? { Authorization: `Bearer ${process.env.LIGHTHOUSE_WORKER_SECRET}` }
        : {}),
    },
    body: JSON.stringify({ url: domain }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Lighthouse worker failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error("Lighthouse worker returned invalid JSON")
  }

  return parseWorkerResponse(body)
}
