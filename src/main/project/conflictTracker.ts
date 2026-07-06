import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Sprint 26 US-198 — detects when a `.screenstudio` bundle's manifest.json
 * was modified by something other than this app instance since the last
 * time this app opened or saved it (e.g. a colleague edited their own copy
 * synced via Drive/Dropbox and it landed back on disk here). Tracks mtimes
 * per project path in userData rather than embedding a hash/version field in
 * ProjectState — keeps the conflict-detection concern entirely out of the
 * project file format itself, so old saved projects need no migration.
 */
interface TrackedState {
  mtimeMs: number
  size: number
}

function trackerPath(): string {
  return join(app.getPath('userData'), 'project-mtimes.json')
}

function readTracker(): Record<string, TrackedState> {
  try {
    return JSON.parse(readFileSync(trackerPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function writeTracker(data: Record<string, TrackedState>): void {
  try {
    writeFileSync(trackerPath(), JSON.stringify(data))
  } catch { /* best effort */ }
}

/** Call after a successful open or save, recording "this app instance last saw
 *  this mtime+size for this path." Sprint 29 (round 2) — size is tracked
 *  alongside mtime (not a replacement) as a cheap second signal: on
 *  low-resolution filesystems (FAT32: 2s buckets, some SMB/network shares
 *  worse) two different writes within the same resolution window produce
 *  identical mtimes, which let an external conflicting edit slip through
 *  hasExternalChange() undetected. Two independent writes producing the same
 *  mtime AND the same byte count is far less likely than the same mtime
 *  alone — still not a cryptographic guarantee, but a real improvement for
 *  the coarse-mtime case without the cost of hashing the whole file on every
 *  save (manifest.json can be large — cursor/zoom event history). */
export function recordKnownMtime(projectPath: string, mtimeMs: number, size: number): void {
  const data = readTracker()
  data[projectPath] = { mtimeMs, size }
  writeTracker(data)
}

/** Returns true if the file's current mtime+size differ from what this app
 *  last recorded — i.e. it changed elsewhere. */
export function hasExternalChange(projectPath: string, currentMtimeMs: number, currentSize: number): boolean {
  const data = readTracker()
  const known = data[projectPath]
  if (known === undefined) return false
  return known.mtimeMs !== currentMtimeMs || known.size !== currentSize
}
