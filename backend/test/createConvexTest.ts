/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import schema from "../convex/schema"

/**
 * Wires the Convex function modules for `convex-test` (spec 07). The glob is
 * relative to THIS file (backend/test/). Test files and generated code are
 * excluded — only schema + function + lib modules belong in the mock.
 */
// convex-test locates the `_generated` modules through this map, so nothing
// under convex/ may be excluded except the tests themselves.
export const modules = import.meta.glob(["../convex/**/*.ts", "!../convex/**/*.test.ts"])

export function createConvexTest() {
  return convexTest(schema, modules)
}

export type ConvexTestInstance = ReturnType<typeof createConvexTest>
