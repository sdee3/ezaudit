import test from "node:test"
import assert from "node:assert/strict"

import { assertPublicAddresses, isPublicAddress } from "./egress-proxy.mjs"

const PRIVATE_DESTINATION = /destination must resolve only to public addresses/

test("isPublicAddress", async (t) => {
  await t.test("accepts public IPv4 addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1"]) {
      assert.equal(isPublicAddress(address), true, address)
    }
  })

  await t.test("accepts public IPv6 addresses, bracketed or not", () => {
    for (const address of ["2606:4700:4700::1111", "[2606:4700:4700::1111]"]) {
      assert.equal(isPublicAddress(address), true, address)
    }
  })

  await t.test("rejects loopback, private and unspecified IPv4 addresses", () => {
    for (const address of ["127.0.0.1", "127.0.0.53", "10.0.0.1", "172.16.0.1", "192.168.1.1", "0.0.0.0"]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  await t.test("rejects reserved, link-local and shared IPv4 addresses", () => {
    for (const address of ["169.254.169.254", "100.64.0.1"]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  await t.test("rejects loopback, unique-local, link-local and multicast IPv6 addresses", () => {
    for (const address of ["::1", "fd00::1", "fe80::1", "ff02::1"]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  await t.test("rejects malformed address strings", () => {
    for (const address of ["not-an-ip", ""]) {
      assert.equal(isPublicAddress(address), false, address)
    }
  })

  await t.test("rejects non-string input", () => {
    for (const value of [42, null, undefined, ["8.8.8.8"]]) {
      assert.throws(() => isPublicAddress(value), TypeError, String(value))
    }
  })
})

test("assertPublicAddresses", async (t) => {
  await t.test("accepts a list of public addresses", () => {
    assert.deepEqual(assertPublicAddresses([{ address: "8.8.8.8" }]), ["8.8.8.8"])
    assert.deepEqual(
      assertPublicAddresses([{ address: "1.1.1.1" }, { address: "2606:4700:4700::1111" }]),
      ["1.1.1.1", "2606:4700:4700::1111"],
    )
  })

  await t.test("rejects a list mixing public and private addresses", () => {
    assert.throws(
      () => assertPublicAddresses([{ address: "8.8.8.8" }, { address: "10.0.0.1" }]),
      PRIVATE_DESTINATION,
    )
  })

  await t.test("rejects an empty list", () => {
    assert.throws(() => assertPublicAddresses([]), PRIVATE_DESTINATION)
  })

  await t.test("rejects a list of only private addresses", () => {
    assert.throws(
      () => assertPublicAddresses([{ address: "127.0.0.1" }, { address: "192.168.1.1" }]),
      PRIVATE_DESTINATION,
    )
  })
})
