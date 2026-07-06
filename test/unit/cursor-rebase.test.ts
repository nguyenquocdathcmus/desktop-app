import '../integration/electron-stub'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { rebaseCursorEvents } from '../../src/main/recording/RecordingSession'

/**
 * Sprint 20 US-159 — verifies the fix for the multi-display cursor coordinate
 * bug: cursor-tracker reports absolute, system-wide point coordinates, but
 * every downstream consumer (zoom generation, synthetic cursor, click
 * ripples) assumes (0,0) is the top-left of the captured frame in pixels.
 * This was wrong two ways: non-zero/negative display origin, and points not
 * matching the Retina pixel grid. rebaseCursorEvents() is the single fix
 * point; these tests exercise it directly against real files.
 */
describe('rebaseCursorEvents', () => {
  let dir: string
  let cursorPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cursor-rebase-test-'))
    cursorPath = join(dir, 'cursor.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('leaves in-bounds coordinates unchanged when origin is (0,0) and scale is 1 (main display, non-Retina)', () => {
    const original = [{ t: 1, x: 100, y: 200, type: 'move' }]
    writeFileSync(cursorPath, JSON.stringify(original))
    rebaseCursorEvents(cursorPath, 0, 0, 1, 1920, 1080)
    expect(JSON.parse(readFileSync(cursorPath, 'utf-8'))).toEqual(original)
  })

  it('scales points to pixels for a Retina main display (2x)', () => {
    // Real numbers observed from the actual capture binary: 1512pt display,
    // 3024px capture, origin (0,0), pointsToPixels 2.
    writeFileSync(cursorPath, JSON.stringify([{ t: 1, x: 756, y: 400, type: 'move' }]))
    rebaseCursorEvents(cursorPath, 0, 0, 2, 3024, 1964)
    const [e] = JSON.parse(readFileSync(cursorPath, 'utf-8'))
    expect(e.x).toBe(1512)
    expect(e.y).toBe(800)
  })

  it('subtracts a negative display origin (secondary display positioned to the left)', () => {
    // A display positioned left of main has origin.x < 0 in global coordinates.
    writeFileSync(cursorPath, JSON.stringify([{ t: 1, x: -1400, y: 50, type: 'move' }]))
    rebaseCursorEvents(cursorPath, -1512, 0, 1, 1512, 982)
    const [e] = JSON.parse(readFileSync(cursorPath, 'utf-8'))
    expect(e.x).toBe(112) // -1400 - (-1512) = 112
    expect(e.y).toBe(50)
  })

  it('drops events that fall outside the captured frame after rebasing (cursor moved to another display)', () => {
    writeFileSync(cursorPath, JSON.stringify([
      { t: 1, x: 100, y: 100, type: 'move' },   // inside
      { t: 2, x: 5000, y: 100, type: 'move' },  // way outside to the right
      { t: 3, x: -500, y: 100, type: 'move' }   // outside to the left
    ]))
    rebaseCursorEvents(cursorPath, 0, 0, 1, 1920, 1080)
    const events = JSON.parse(readFileSync(cursorPath, 'utf-8'))
    expect(events).toHaveLength(1)
    expect(events[0].t).toBe(1)
  })

  it('keeps position-less events (keydown) untouched by the position filter', () => {
    writeFileSync(cursorPath, JSON.stringify([
      { t: 1, type: 'keydown', keyCode: 36, modifiers: [], display: '↩' }
    ]))
    rebaseCursorEvents(cursorPath, -100, -100, 2, 1920, 1080)
    const events = JSON.parse(readFileSync(cursorPath, 'utf-8'))
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('keydown')
  })

  it('does nothing if the cursor file does not exist', () => {
    expect(() => rebaseCursorEvents(join(dir, 'missing.json'), -100, 0, 2, 1920, 1080)).not.toThrow()
    expect(existsSync(join(dir, 'missing.json'))).toBe(false)
  })
})
