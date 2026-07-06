import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'

/**
 * Sprint 18 US-150 — mirrors the bucketing function in
 * src/main/ipc/analytics-handlers.ts (not imported directly since that
 * module pulls in `electron`). Verifies the two properties the feature flag
 * mechanism depends on: stable assignment per (id, flag) pair, and a
 * roughly-uniform spread across the 0-100 range so a "10% rollout" actually
 * lands close to 10% over many anonymous ids.
 */
function bucketPercent(anonId: string, flagName: string): number {
  const hash = createHash('sha256').update(`${anonId}:${flagName}`).digest()
  return hash.readUInt16BE(0) / 65536 * 100
}

describe('feature flag bucket assignment', () => {
  it('is deterministic for the same id and flag', () => {
    const a = bucketPercent('user-123', 'newExportUi')
    const b = bucketPercent('user-123', 'newExportUi')
    expect(a).toBe(b)
  })

  it('differs across flags for the same id (independent rollouts)', () => {
    const a = bucketPercent('user-123', 'flagA')
    const b = bucketPercent('user-123', 'flagB')
    expect(a).not.toBe(b)
  })

  it('spreads roughly uniformly across 0-100 over many ids', () => {
    const N = 2000
    let under10 = 0
    for (let i = 0; i < N; i++) {
      if (bucketPercent(`anon-${i}`, 'testFlag') < 10) under10++
    }
    const pct = (under10 / N) * 100
    // Allow generous tolerance — this is a statistical property, not exact.
    expect(pct).toBeGreaterThan(6)
    expect(pct).toBeLessThan(14)
  })
})
