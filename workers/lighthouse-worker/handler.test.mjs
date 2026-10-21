import test from "node:test"
import assert from "node:assert/strict"

import { handler } from "./index.mjs"

const originalEnv = { ...process.env }

function setEnv(values) {
  for (const key of [
    "LIGHTHOUSE_AUTH_MODE",
    "LIGHTHOUSE_ALLOWED_CALLER_ARN",
    "LIGHTHOUSE_WORKER_SECRET",
    "LIGHTHOUSE_EGRESS_PROXY_URL",
  ]) {
    delete process.env[key]
    if (values[key] !== undefined) process.env[key] = values[key]
  }
}

test.afterEach(() => {
  for (const key of [
    "LIGHTHOUSE_AUTH_MODE",
    "LIGHTHOUSE_ALLOWED_CALLER_ARN",
    "LIGHTHOUSE_WORKER_SECRET",
    "LIGHTHOUSE_EGRESS_PROXY_URL",
  ]) {
    delete process.env[key]
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key]
  }
})

test("rejects an unset authentication mode", async () => {
  setEnv({})
  const response = await handler({ requestContext: { http: { method: "POST" } } })
  assert.equal(response.statusCode, 503)
})

test("rejects IAM mode without an egress proxy", async () => {
  setEnv({
    LIGHTHOUSE_AUTH_MODE: "iam",
    LIGHTHOUSE_ALLOWED_CALLER_ARN: "arn:aws:iam::123456789012:user/convex",
  })
  const response = await handler({ requestContext: { http: { method: "POST" } } })
  assert.equal(response.statusCode, 503)
  assert.match(response.body, /egress proxy is not configured/)
})

test("rejects direct invocation events without an HTTP method", async () => {
  setEnv({
    LIGHTHOUSE_AUTH_MODE: "iam",
    LIGHTHOUSE_ALLOWED_CALLER_ARN: "arn:aws:iam::123456789012:user/convex",
    LIGHTHOUSE_EGRESS_PROXY_URL: "http://127.0.0.1:3128",
  })
  const response = await handler({ body: "{}" })
  assert.equal(response.statusCode, 405)
})

test("requires an audit ID in authenticated worker requests", async () => {
  setEnv({ LIGHTHOUSE_AUTH_MODE: "bearer", LIGHTHOUSE_WORKER_SECRET: "local-secret" })
  const response = await handler({
    headers: { authorization: "Bearer local-secret" },
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify({ url: "https://8.8.8.8/" }),
  })
  assert.equal(response.statusCode, 400)
  assert.match(response.body, /auditId and url are required/)
})
