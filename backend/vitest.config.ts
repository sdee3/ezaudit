import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Match the Convex runtime closely (spec 07); requires @edge-runtime/vm.
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts'],
    passWithNoTests: true,
  },
})
