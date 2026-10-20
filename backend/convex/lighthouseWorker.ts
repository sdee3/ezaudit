"use node"

import { Hash } from "@smithy/hash-node"
import { HttpRequest } from "@smithy/protocol-http"
import { SignatureV4 } from "@smithy/signature-v4"
import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import { parseWorkerResponse, seededScores } from "./lib/lighthouse"

const region = "us-east-1"
const service = "lambda"

/** Adds `https://` when the stored domain has no scheme. The worker needs a full URL. */
export function toWorkerUrl(domain: string): string {
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`
}

/**
 * Seeded scores are a development-only fallback and must be opted into
 * explicitly, so a deployment that forgets `LIGHTHOUSE_WORKER_URL` fails loudly
 * instead of emailing invented scores and reporting success.
 */
export function allowsSeededScores(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.LIGHTHOUSE_ALLOW_SEEDED_SCORES === "true"
}

export const runAudit = internalAction({
  args: { domain: v.string() },
  handler: async (_ctx, { domain }) => {
    const workerUrl = process.env.LIGHTHOUSE_WORKER_URL
    if (!workerUrl) {
      if (allowsSeededScores()) return { scores: seededScores(domain), findings: [] }
      throw new Error("LIGHTHOUSE_WORKER_URL is not configured")
    }

    const accessKeyId = process.env.LIGHTHOUSE_AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.LIGHTHOUSE_AWS_SECRET_ACCESS_KEY
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Lighthouse AWS credentials are not configured")
    }

    const url = new URL(workerUrl)
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(`.lambda-url.${region}.on.aws`) ||
      url.port ||
      url.username ||
      url.password
    ) {
      throw new Error("Lighthouse worker URL must be an HTTPS Function URL in us-east-1")
    }

    const body = JSON.stringify({ url: toWorkerUrl(domain) })
    const signer = new SignatureV4({
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(process.env.LIGHTHOUSE_AWS_SESSION_TOKEN
          ? { sessionToken: process.env.LIGHTHOUSE_AWS_SESSION_TOKEN }
          : {}),
      },
      region,
      service,
      sha256: Hash.bind(null, "sha256"),
    })
    const signed = await signer.sign(new HttpRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      method: "POST",
      path: `${url.pathname}${url.search}`,
      headers: {
        host: url.host,
        "content-type": "application/json",
      },
      body,
    }))
    const headers = new Headers()
    for (const [name, value] of Object.entries(signed.headers)) {
      if (name.toLowerCase() !== "host") headers.set(name, String(value))
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(130_000),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(
        `Lighthouse worker failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
      )
    }

    let result: unknown
    try {
      result = await response.json()
    } catch {
      throw new Error("Lighthouse worker returned invalid JSON")
    }
    return parseWorkerResponse(result)
  },
})
