import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"

import { startEgressProxy } from "./egress-proxy.mjs"

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  return server.address().port
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve))
}

test("forwards checked HTTP requests through the configured proxy", async () => {
  let targetPath
  const upstream = http.createServer((request, response) => {
    targetPath = request.url
    response.end("proxy response")
  })
  const upstreamPort = await listen(upstream)
  const oldProxyUrl = process.env.LIGHTHOUSE_EGRESS_PROXY_URL
  process.env.LIGHTHOUSE_EGRESS_PROXY_URL = `http://127.0.0.1:${upstreamPort}`
  const localProxy = await startEgressProxy()

  try {
    const result = await new Promise((resolve, reject) => {
      http.get({
        host: "127.0.0.1",
        port: localProxy.port,
        path: "http://8.8.8.8/audit?check=1",
      }, (response) => {
        let body = ""
        response.setEncoding("utf8")
        response.on("data", (chunk) => { body += chunk })
        response.on("end", () => resolve({ status: response.statusCode, body }))
      }).on("error", reject)
    })

    assert.deepEqual(result, { status: 200, body: "proxy response" })
    assert.equal(targetPath, "http://8.8.8.8/audit?check=1")
  } finally {
    await localProxy.close()
    await close(upstream)
    if (oldProxyUrl === undefined) delete process.env.LIGHTHOUSE_EGRESS_PROXY_URL
    else process.env.LIGHTHOUSE_EGRESS_PROXY_URL = oldProxyUrl
  }
})

test("opens checked HTTPS tunnels through the configured proxy", async () => {
  let connectTarget
  const upstream = http.createServer()
  upstream.on("connect", (request, socket) => {
    connectTarget = request.url
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n")
    socket.pipe(socket)
  })
  const upstreamPort = await listen(upstream)
  const oldProxyUrl = process.env.LIGHTHOUSE_EGRESS_PROXY_URL
  process.env.LIGHTHOUSE_EGRESS_PROXY_URL = `http://127.0.0.1:${upstreamPort}`
  const localProxy = await startEgressProxy()

  try {
    const responseBody = await new Promise((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port: localProxy.port,
        method: "CONNECT",
        path: "8.8.8.8:443",
      })
      request.once("connect", (response, socket) => {
        if (response.statusCode !== 200) {
          socket.destroy()
          reject(new Error(`Expected HTTP 200, got ${response.statusCode}`))
          return
        }
        let body = ""
        socket.setEncoding("utf8")
        socket.on("data", (chunk) => {
          body += chunk
          if (body === "tunnel request") socket.end()
        })
        socket.on("end", () => resolve(body))
        socket.write("tunnel request")
      })
      request.on("error", reject)
      request.end()
    })

    assert.equal(connectTarget, "8.8.8.8:443")
    assert.equal(responseBody, "tunnel request")
  } finally {
    await localProxy.close()
    await close(upstream)
    if (oldProxyUrl === undefined) delete process.env.LIGHTHOUSE_EGRESS_PROXY_URL
    else process.env.LIGHTHOUSE_EGRESS_PROXY_URL = oldProxyUrl
  }
})
