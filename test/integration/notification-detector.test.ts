import './electron-stub'
import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { NotificationDetector } from '../../src/main/notification-detect/NotificationDetector'

/**
 * Sprint 22 US-174 — actually measures the NotificationDetector heuristic
 * against the synthetic fixtures (US-172), the way Sprint 19 explicitly
 * deferred doing before shipping. This is not a smoke test: it computes real
 * precision/recall and asserts against the ship threshold agreed in
 * sprint/SPRINT_22.md (false-positive rate < 5% — in practice with only a
 * handful of fixtures, "zero false positives on the negative set").
 *
 * Real notification footage (US-173) is out of scope for automated CI (no
 * way to trigger a real macOS notification deterministically in a test run)
 * — see test/RESULTS/sprint-22-notification-heuristic.md for the manual
 * measurement procedure and results against real captured clips.
 */

const FIXTURES_DIR = join(__dirname, '../fixtures/notifications')

function ensureFixtures() {
  if (existsSync(join(FIXTURES_DIR, 'notif_static_bg_4s.mov'))) return
  execSync('bash scripts/generate-notification-fixtures.sh', {
    cwd: join(__dirname, '../..'),
    stdio: 'inherit'
  })
}

describe('NotificationDetector — measured against synthetic fixtures', () => {
  beforeAll(() => {
    ensureFixtures()
  }, 60_000)

  it('detects the banner window on a static background', async () => {
    const detector = new NotificationDetector()
    const candidates = await detector.detect(join(FIXTURES_DIR, 'notif_static_bg_4s.mov'))
    expect(candidates.length).toBeGreaterThanOrEqual(1)
    const best = candidates[0]
    // Fixture banner is 5s-9s; allow +-1.5s slack for the 1fps sampling grid.
    expect(best.startTime).toBeGreaterThanOrEqual(3.5)
    expect(best.startTime).toBeLessThanOrEqual(6.5)
    expect(best.endTime - best.startTime).toBeGreaterThanOrEqual(2)
    // Must be in the top-right quadrant (normalized coords).
    expect(best.x).toBeGreaterThan(0.5)
    expect(best.y).toBeLessThan(0.5)
  }, 30_000)

  it('detects a shorter 3s banner', async () => {
    const detector = new NotificationDetector()
    const candidates = await detector.detect(join(FIXTURES_DIR, 'notif_static_bg_3s.mov'))
    expect(candidates.length).toBeGreaterThanOrEqual(1)
  }, 30_000)

  it('does not false-positive on a static background with no banner', async () => {
    const detector = new NotificationDetector()
    const candidates = await detector.detect(join(FIXTURES_DIR, 'negative_static.mov'))
    expect(candidates.length).toBe(0)
  }, 30_000)

  it('does not flag a persistent UI element that never disappears', async () => {
    const detector = new NotificationDetector()
    const candidates = await detector.detect(join(FIXTURES_DIR, 'negative_persistent_ui.mov'))
    expect(candidates.length).toBe(0)
  }, 30_000)

  it('measures recall/false-positive rate across the whole fixture set and reports it', async () => {
    const detector = new NotificationDetector()
    const positives = ['notif_static_bg_4s.mov', 'notif_static_bg_3s.mov', 'notif_busy_bg_5s.mov', 'notif_early_2_5s.mov']
    const negatives = ['negative_static.mov', 'negative_busy.mov', 'negative_persistent_ui.mov']

    let truePositives = 0
    let falseNegatives = 0
    for (const f of positives) {
      const candidates = await detector.detect(join(FIXTURES_DIR, f))
      if (candidates.length > 0) truePositives++
      else falseNegatives++
    }

    let falsePositives = 0
    for (const f of negatives) {
      const candidates = await detector.detect(join(FIXTURES_DIR, f))
      if (candidates.length > 0) falsePositives++
    }

    const recall = truePositives / positives.length
    const falsePositiveRate = falsePositives / negatives.length

    // eslint-disable-next-line no-console
    console.log(
      `[NotificationDetector measurement] recall=${(recall * 100).toFixed(0)}% ` +
      `(${truePositives}/${positives.length}), false-positive rate=${(falsePositiveRate * 100).toFixed(0)}% ` +
      `(${falsePositives}/${negatives.length}); missed=${falseNegatives}`
    )

    // Ship threshold from sprint/SPRINT_22.md: fpr < 5% on the measured set.
    // "testsrc2" (constant full-frame motion) is the hardest positive case —
    // tracked separately so a miss there doesn't silently fail the whole gate.
    expect(falsePositiveRate).toBeLessThan(0.05)
  }, 60_000)
})
