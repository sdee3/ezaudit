import { lookup } from "node:dns/promises"
import http from "node:http"
import net from "node:net"
import ipaddr from "ipaddr.js"

export function isPublicAddress(address) {
  const value = address.startsWith("[") && address.endsWith("]")
    ? address.slice(1, -1)
    : address
  if (!net.isIP(value)) return false
  try {
    const parsed = ipaddr.process(value)
    if (parsed.range() !== "unicast") return false
    return parsed.kind() !== "ipv6" || parsed.match(ipaddr.parseCIDR("2000::/3"))
  } catch {
    return false
  }
}

export function assertPublicAddresses(addresses) {
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("destination must resolve only to public addresses")
  }
  return addresses.map(({ address }) => address)
}

export async function resolvePublicAddresses(hostname) {
  const value = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
  const addresses = net.isIP(value)
    ? [{ address: value }]
    : await lookup(value, { all: true, verbatim: true })
  return assertPublicAddresses(addresses)
}

async function publicAddress(hostname) {
  return (await resolvePublicAddresses(hostname))[0]
}

function upstreamProxy() {
  const value = process.env.LIGHTHOUSE_EGRESS_PROXY_URL
  if (!value) return undefined
  const proxy = new URL(value)
  if (proxy.protocol !== "http:" || proxy.username || proxy.password) {
    throw new Error("egress proxy must be an unauthenticated HTTP URL")
  }
  return proxy
}

function sendError(socket, status, message) {
  if (socket.destroyed) return
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`)
}

export async function startEgressProxy() {
  const server = http.createServer(async (request, response) => {
    let url
    try {
      url = new URL(request.url)
      if (url.protocol !== "http:" || url.username || url.password) throw new Error("unsupported URL")
      const address = await publicAddress(url.hostname)
      const port = Number(url.port || (url.protocol === "https:" ? 443 : 80))
      if (port !== 80) throw new Error("only public web ports are allowed")
      const proxy = upstreamProxy()
      const upstream = http.request({
        hostname: proxy?.hostname || address,
        family: proxy ? undefined : net.isIP(address),
        port: proxy ? Number(proxy.port || 80) : port,
        method: request.method,
        path: proxy ? request.url : `${url.pathname}${url.search}`,
        headers: proxy ? request.headers : { ...request.headers, host: url.host },
      }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers)
        upstreamResponse.pipe(response)
      })
      upstream.on("error", () => response.writeHead(502).end())
      request.pipe(upstream)
    } catch {
      response.writeHead(403).end()
    }
  })

  server.on("connect", async (request, client, head) => {
    try {
      const target = new URL(`http://${request.url}`)
      if (target.username || target.password) throw new Error("unsupported authority")
      const address = await publicAddress(target.hostname)
      const port = Number(target.port || 443)
      if (port !== 443) throw new Error("only public web ports are allowed")
      const proxy = upstreamProxy()
      const openTunnel = (upstream) => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        if (head.length) upstream.write(head)
        upstream.pipe(client)
        client.pipe(upstream)
        upstream.on("error", () => client.destroy())
        client.on("error", () => upstream.destroy())
      }
      if (proxy) {
        const connect = http.request({
          hostname: proxy.hostname,
          port: Number(proxy.port || 80),
          method: "CONNECT",
          path: request.url,
        })
        connect.once("connect", (response, upstream) => {
          if (response.statusCode !== 200) {
            client.destroy()
            upstream.destroy()
            return
          }
          openTunnel(upstream)
        })
        connect.on("error", () => client.destroy())
        connect.end()
      } else {
        const upstream = net.connect({ host: address, family: net.isIP(address), port })
        upstream.on("connect", () => openTunnel(upstream))
      }
    } catch {
      sendError(client, 403, "Forbidden")
    }
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
