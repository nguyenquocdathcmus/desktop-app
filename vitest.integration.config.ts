import { defineConfig } from 'vitest/config'

/**
 * Sprint 14 US-118 — separate config for integration tests that spawn the
 * real ffmpeg binary (several seconds each, macOS-only since it needs the
 * bundled resources/bin/ffmpeg). Kept out of the default `npm test` run so
 * the fast unit suite stays fast; run explicitly via `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
})
