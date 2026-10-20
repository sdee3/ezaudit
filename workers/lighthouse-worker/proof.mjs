import assert from "node:assert/strict"
import http from "node:http"
import { assertPublicAddresses, isPublicAddress, startEgressProxy } from "./egress-proxy.mjs"

const baseUrl = process.env.WORKER_URL ?? "http://localhost:9000/2015-03-31/functions/function/invocations"
const secret = process.env.LIGHTHOUSE_WORKER_SECRET
const target = process.env.TARGET_URL ?? "https://ezaudit.sdee3.com"

if (!secret) throw new Error("Set LIGHTHOUSE_WORKER_SECRET before the proof run")

const proxy = await startEgressProxy()
try {
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.0.2.1", "224.0.0.1", "::1", "fc00::1", "fe80::1"]) {
    assert.equal(isPublicAddress(address), false, `${address} must not be public`)
  }
  for (const address of ["8.8.8.8", "2606:4700:4700::1111"]) {
    assert.equal(isPublicAddress(address), true, `${address} must be public`)
  }
  assert.throws(() => assertPublicAddresses([
    { address: "8.8.8.8" },
    { address: "169.254.169.254" },
  ]), /only to public addresses/)
  const blocked = await new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: proxy.port,
      path: "http://127.0.0.1/",
    }, (response) => resolve(response.statusCode))
    request.on("error", reject)
    request.end()
  })
  assert.equal(blocked, 403)
  const blockedConnect = await new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: proxy.port,
      method: "CONNECT",
      path: "127.0.0.1:443",
    })
    request.on("connect", (response, socket) => {
      socket.destroy()
      resolve(response.statusCode)
    })
    request.on("error", reject)
    request.end()
  })
  assert.equal(blockedConnect, 403)
  const blockedPort = await new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: proxy.port,
      path: "http://8.8.8.8:8080/",
    }, (response) => resolve(response.statusCode))
    request.on("error", reject)
    request.end()
  })
  assert.equal(blockedPort, 403)
} finally {
  await proxy.close()
}

async function invoke(body, authorization = `Bearer ${secret}`) {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: "2.0",
      headers: { authorization },
      requestContext: { http: { method: "POST" } },
      body: JSON.stringify(body),
    }),
  })
  return response.json()
}

assert.equal((await invoke({ url: target }, "Bearer wrong-secret")).statusCode, 401)
assert.equal((await invoke({ url: "http://127.0.0.1/" })).statusCode, 400)

const started = Date.now()
const result = await invoke({ url: target })
assert.equal(result.statusCode, 200, JSON.stringify(result))
const payload = JSON.parse(result.body)
for (const category of ["performance", "accessibility", "bestPractices", "seo"]) {
  const score = payload.scores?.[category]?.score
  if (typeof score !== "number" || score < 0 || score > 1) {
    throw new Error(`Invalid ${category} score: ${score}`)
  }
}

console.log(JSON.stringify({
  target,
  durationMs: Date.now() - started,
  scores: Object.fromEntries(
    Object.entries(payload.scores).map(([key, value]) => [key, value.score]),
  ),
}))
