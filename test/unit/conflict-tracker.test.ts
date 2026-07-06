import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Sprint 26 US-198 — verifies conflictTracker.ts correctly distinguishes
 * "this app instance already knows about this mtime+size" from "the file
 * changed since we last looked", which is the entire basis for not silently
 * overwriting a colleague's edits synced back via Drive/Dropbox.
 *
 * Sprint 29 (round 2) — size was added alongside mtime after a real gap was
 * found: on low mtime-resolution filesystems (FAT32: 2s buckets, some
 * SMB/network shares worse), two different writes within the same
 * resolution window produce identical mtimes, letting an external
 * conflicting edit slip through undetected. See the last two tests below.
 */
let userDataDir: string

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir }
}))

describe('conflictTracker', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'conflict-tracker-test-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('reports no conflict for a path never seen before', async () => {
    const { hasExternalChange } = await import('../../src/main/project/conflictTracker')
    expect(hasExternalChange('/some/project', 12345, 100)).toBe(false)
  })

  it('reports no conflict when mtime and size both match what was last recorded', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/some/project', 1000, 500)
    expect(hasExternalChange('/some/project', 1000, 500)).toBe(false)
  })

  it('reports a conflict when the mtime differs from what was last recorded', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/some/project', 1000, 500)
    expect(hasExternalChange('/some/project', 2000, 500)).toBe(true)
  })

  it('tracks multiple project paths independently', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/project/a', 100, 500)
    recordKnownMtime('/project/b', 200, 500)
    expect(hasExternalChange('/project/a', 999, 500)).toBe(true)
    expect(hasExternalChange('/project/b', 200, 500)).toBe(false)
  })

  it('updates the known mtime+size on each call, clearing a previously-detected conflict', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/some/project', 1000, 500)
    expect(hasExternalChange('/some/project', 2000, 500)).toBe(true)
    // After resolving (opening/saving again at the new mtime), it's no longer a conflict.
    recordKnownMtime('/some/project', 2000, 500)
    expect(hasExternalChange('/some/project', 2000, 500)).toBe(false)
  })

  it('reports a conflict when size differs even though mtime is identical (low mtime-resolution filesystem)', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/some/project', 1000, 500)
    // Same mtime (e.g. two writes landed in the same 2s FAT32 bucket), but a
    // different byte count — this is exactly the external-edit case that
    // mtime alone would miss.
    expect(hasExternalChange('/some/project', 1000, 999)).toBe(true)
  })

  it('does not report a conflict when both mtime and size are unchanged', async () => {
    const { recordKnownMtime, hasExternalChange } = await import('../../src/main/project/conflictTracker')
    recordKnownMtime('/some/project', 1000, 500)
    expect(hasExternalChange('/some/project', 1000, 500)).toBe(false)
  })
})
