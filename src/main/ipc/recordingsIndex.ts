import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { RecordingMeta } from './recordings-list-handler'

/**
 * Sprint 27 US-200/201/202 — a single JSON index file replacing the previous
 * "scan the directory + read ≥5 sync files per recording on every list
 * call" pipeline. `recordings-list-handler.ts` used to call `readdirSync`
 * plus `statSync`/`readFileSync` (meta cache, thumb cache, title, manifest
 * for comment count, publish history) for EVERY recording on EVERY
 * `recordings:list` call — including on every window focus event. With a
 * few hundred recordings this blocks the single-threaded Electron main
 * process (and therefore all IPC) during the scan.
 *
 * This index is a pure cache: the source of truth is still the files on
 * disk (manifest.json, capture.mov, etc.) inside each recording's directory.
 * The index can be deleted at any time with zero data loss — the next
 * `recordings:list` call rebuilds it from scratch (see recordings-list-handler.ts
 * `listRecordings()`).
 *
 * Originally planned as SQLite (better-sqlite3) per the sprint doc, but that
 * requires a native module rebuilt per-Electron-ABI/per-architecture, which
 * meaningfully complicates the build/CI/release pipeline for a feature whose
 * actual bottleneck is "many small sync fs reads," not "need a real query
 * engine." A single JSON array read in one shot already eliminates that
 * bottleneck without adding a native dependency.
 */

export interface RecordingIndexEntry extends Omit<RecordingMeta, 'thumbnailDataUrl'> {
  /** mtimeMs of capture.mov at the time this entry was written — used to
   *  detect a recording whose video changed since indexing (rare, but a
   *  cheap check) without re-reading every field. */
  videoMtimeMs: number
}

interface IndexFile {
  version: 1
  entries: RecordingIndexEntry[]
}

function indexPath(): string {
  return join(app.getPath('userData'), 'recordings-index.json')
}

export function readIndex(): RecordingIndexEntry[] {
  try {
    const raw = readFileSync(indexPath(), 'utf-8')
    const parsed: IndexFile = JSON.parse(raw)
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return []
    return parsed.entries
  } catch {
    return []
  }
}

/** Atomic write (write to a temp file, then rename) so a crash mid-write never
 *  leaves a corrupted/partial index — worst case on next read is a missing
 *  file, which just triggers a full rebuild (see recordings-list-handler.ts). */
export function writeIndex(entries: RecordingIndexEntry[]): void {
  try {
    const path = indexPath()
    const tmpPath = `${path}.tmp`
    const data: IndexFile = { version: 1, entries }
    writeFileSync(tmpPath, JSON.stringify(data))
    renameSync(tmpPath, path)
  } catch { /* non-fatal — next list rebuilds from disk */ }
}

export function indexExists(): boolean {
  return existsSync(indexPath())
}

/** Upserts a single entry by id — the common case (one recording finished,
 *  published, deleted, or had a comment resolved) never needs to touch the
 *  other N-1 entries. */
export function upsertIndexEntry(entry: RecordingIndexEntry): void {
  const entries = readIndex()
  const i = entries.findIndex((e) => e.id === entry.id)
  if (i >= 0) entries[i] = entry
  else entries.push(entry)
  writeIndex(entries)
}

export function removeIndexEntry(id: string): void {
  const entries = readIndex()
  const next = entries.filter((e) => e.id !== id)
  if (next.length !== entries.length) writeIndex(next)
}
