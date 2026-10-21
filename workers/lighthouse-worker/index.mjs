import chromium from "@sparticuz/chromium-min"
import lighthouse from "lighthouse"
import puppeteer from "puppeteer-core"
import { resolvePublicAddresses, startEgressProxy } from "./egress-proxy.mjs"

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

async function validateUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error("url must be a valid HTTP URL")
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("url must use HTTP or HTTPS without credentials")
  }
  const requiredPort = url.protocol === "https:" ? "443" : "80"
  if (url.port && url.port !== requiredPort) {
    throw new Error("url must use HTTP port 80 or HTTPS port 443")
  }
  const hostname = url.hostname.toLowerCase()
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("url must use a public hostname")
  }
  await resolvePublicAddresses(hostname)
  return url.href
}

function isAuthorized(event) {
  const mode = process.env.LIGHTHOUSE_AUTH_MODE ?? "deny"
  if (mode === "iam") {
    const iam = event.requestContext?.authorizer?.iam
    const allowedArn = process.env.LIGHTHOUSE_ALLOWED_CALLER_ARN
    return Boolean(iam?.userArn && allowedArn && iam.userArn === allowedArn)
  }
  if (mode !== "bearer") return false
  const secret = process.env.LIGHTHOUSE_WORKER_SECRET
  if (!secret) return false
  const authorization = Object.entries(event.headers ?? {})
    .find(([key]) => key.toLowerCase() === "authorization")?.[1]
  return authorization === `Bearer ${secret}`
}

export async function handler(event) {
  const method = event.requestContext?.http?.method
  if (method !== "POST") return json(405, { error: "method not allowed" })

  const authMode = process.env.LIGHTHOUSE_AUTH_MODE ?? "deny"
  if (!["bearer", "iam"].includes(authMode)) {
    return json(503, { error: "worker authentication mode is invalid" })
  }
  if (authMode === "iam" && !process.env.LIGHTHOUSE_ALLOWED_CALLER_ARN) {
    return json(503, { error: "allowed IAM caller ARN is not configured" })
  }
  if (authMode === "iam" && !process.env.LIGHTHOUSE_EGRESS_PROXY_URL) {
    return json(503, { error: "egress proxy is not configured" })
  }
  if (authMode === "bearer" && !process.env.LIGHTHOUSE_WORKER_SECRET) {
    return json(503, { error: "worker secret is not configured" })
  }
  if (!isAuthorized(event)) return json(401, { error: "unauthorized" })

  let body
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : event.body ?? "{}"
    body = JSON.parse(raw)
  } catch {
    return json(400, { error: "body must be valid JSON" })
  }
  if (!body || typeof body !== "object" || typeof body.auditId !== "string" || !body.auditId || typeof body.url !== "string") {
    return json(400, { error: "auditId and url are required" })
  }

  let url
  try {
    url = await validateUrl(body.url)
  } catch (error) {
    return json(400, { error: error.message })
  }

  let chrome
  let proxy
  const startedAt = Date.now()
  const mark = (step) => console.log("timing", step, Date.now() - startedAt)
  try {
    proxy = await startEgressProxy()
    mark("proxy")
    const executablePath = await chromium.executablePath("/opt/chromium")
    mark("chromium")
    chrome = await puppeteer.launch({
      args: await puppeteer.defaultArgs({
        args: [
          // Lambda hangs with a zygote-spawned renderer, so keep --no-zygote.
          // --single-process breaks Lighthouse screenshots, so drop only that.
          ...chromium.args.filter((arg) => arg !== "--single-process"),
          `--proxy-server=http://127.0.0.1:${proxy.port}`,
          "--proxy-bypass-list=<-loopback>",
          "--disable-quic",
          "--disable-dev-shm-usage",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ],
        headless: "shell",
      }),
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: "shell",
    })
    mark("launch")
    // A hung Chrome leaves the invocation to die at the function timeout with no
    // error, so fail first with a reason the logs show.
    const result = await Promise.race([
      lighthouse(url, {
        port: Number(new URL(chrome.wsEndpoint()).port),
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("lighthouse exceeded 100 seconds")), 100_000).unref(),
      ),
    ])
    mark("lighthouse")
    const categories = result.lhr.categories
    const scores = [
      categories.performance.score,
      categories.accessibility.score,
      categories["best-practices"].score,
      categories.seo.score,
    ]
    if (scores.some((score) => !Number.isFinite(score) || score < 0 || score > 1)) {
      const missingAudits = Object.entries(result.lhr.audits)
        .filter(([, audit]) => audit.score === null && audit.scoreDisplayMode !== "notApplicable")
        .slice(0, 8)
        .map(([id, audit]) => ({
          id,
          displayMode: audit.scoreDisplayMode,
          errorMessage: audit.errorMessage,
        }))
      console.error("Lighthouse returned incomplete scores", {
        runtimeError: result.lhr.runtimeError,
        missingAudits,
      })
      return json(502, { error: "Lighthouse returned incomplete scores" })
    }
    const findings = []
    const checks = []
    for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
      const categoryName = category === "best-practices" ? "bestPractices" : category
      for (const { id } of categories[category].auditRefs) {
        const audit = result.lhr.audits[id]
        if (typeof audit?.score === "number" && typeof audit.title === "string") {
          checks.push({
            id,
            category: categoryName,
            title: audit.title,
            score: audit.score,
            displayValue: typeof audit.displayValue === "string" ? audit.displayValue : "",
            weight: typeof categories[category].auditRefs.find((ref) => ref.id === id)?.weight === "number"
              ? categories[category].auditRefs.find((ref) => ref.id === id).weight
              : 0,
          })
        }
        if (
          typeof audit?.score !== "number" || audit.score >= 1 ||
          typeof audit.title !== "string" || typeof audit.description !== "string"
        ) continue
        findings.push({
          id,
          category: categoryName,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          suggestedFixes: audit.description ? [audit.description] : [],
        })
      }
    }
    return json(200, {
      auditId: body.auditId,
      requestId: event.requestContext?.requestId,
      report: {
        finalUrl: result.lhr.finalDisplayedUrl || result.lhr.finalUrl || url,
        fetchedAt: result.lhr.fetchTime,
        lighthouseVersion: result.lhr.lighthouseVersion,
        formFactor: result.lhr.configSettings?.formFactor || "unknown",
        metrics: ["first-contentful-paint", "largest-contentful-paint", "speed-index", "total-blocking-time", "cumulative-layout-shift"]
          .flatMap((id) => {
            const audit = result.lhr.audits[id]
            return typeof audit?.numericValue === "number"
              ? [{ id, title: audit.title, value: audit.numericValue, unit: audit.numericUnit || "", displayValue: audit.displayValue || "" }]
              : []
          }),
        checks,
      },
      scores: {
        performance: { score: categories.performance.score },
        accessibility: { score: categories.accessibility.score },
        bestPractices: { score: categories["best-practices"].score },
        seo: { score: categories.seo.score },
      },
      findings,
    })
  } catch (error) {
    console.error("Lighthouse run failed", error)
    return json(502, { error: "Lighthouse run failed" })
  } finally {
    await chrome?.close()
    await proxy?.close()
  }
}
