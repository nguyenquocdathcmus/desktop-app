import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Sprint 23 US-178 — remembers where the user last dragged the QuickTime-style
 * recording pill so it reopens in the same spot next time, instead of always
 * snapping back to top-center. Plain preference (not a secret), same pattern
 * as the other userData JSON flags in ipc/app-handlers.ts.
 */

interface PillPosition {
  x: number
  y: number
}

function pillPositionPath(): string {
  return join(app.getPath('userData'), 'pill-position.json')
}

export function readPillPosition(): PillPosition | null {
  try {
    const raw = readFileSync(pillPositionPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
    return null
  } catch {
    return null
  }
}

export function writePillPosition(pos: PillPosition): void {
  try {
    writeFileSync(pillPositionPath(), JSON.stringify(pos))
  } catch { /* best effort — losing the remembered spot isn't worth surfacing an error */ }
}

export function pillPositionFileExists(): boolean {
  return existsSync(pillPositionPath())
}
