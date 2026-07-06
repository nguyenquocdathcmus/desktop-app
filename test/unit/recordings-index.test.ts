import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Sprint 27 US-200/201 — verifies the JSON index (recordingsIndex.ts)
 * replacing the previous per-recording multi-file-read pipeline. This is a
 * pure cache: writeIndex/readIndex round-trip correctly, upsert/remove touch
 * only the target entry, and a missing/corrupt file behaves as "empty index"
 * (triggering a full rebuild upstream in recordings-list-handler.ts) rather
 * than throwing.
 */
let userDataDir: string

vi.mock('electron', () => ({
  app: { getPath: () => userDataDir }
}))

function entry(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    videoPath: `/recordings/${id}/capture.mov`,
    title: null,
    createdAt: Date.now(),
    duration: 10,
    width: 1920,
    height: 1080,
    fileSize: 12345,
    publishHistory: [],
    unresolvedCommentCount: 0,
    videoMtimeMs: 1000,
    ...overrides
  }
}

describe('recordingsIndex', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'recordings-index-test-'))
  })

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('returns an empty array when no index file exists yet', async () => {
    const { readIndex } = await import('../../src/main/ipc/recordingsIndex')
    expect(readIndex()).toEqual([])
  })

  it('round-trips entries through writeIndex/readIndex', async () => {
    const { writeIndex, readIndex } = await import('../../src/main/ipc/recordingsIndex')
    const e1 = entry('a')
    const e2 = entry('b')
    writeIndex([e1, e2])
    expect(readIndex()).toEqual([e1, e2])
  })

  it('treats a corrupted index file as empty rather than throwing', async () => {
    const { readIndex, indexExists } = await import('../../src/main/ipc/recordingsIndex')
    const fs = await import('fs')
    fs.writeFileSync(join(userDataDir, 'recordings-index.json'), '{not valid json')
    expect(indexExists()).toBe(true)
    expect(readIndex()).toEqual([])
  })

  it('upsertIndexEntry adds a new entry without touching existing ones', async () => {
    const { writeIndex, upsertIndexEntry, readIndex } = await import('../../src/main/ipc/recordingsIndex')
    writeIndex([entry('a')])
    upsertIndexEntry(entry('b'))
    const all = readIndex()
    expect(all.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('upsertIndexEntry replaces an existing entry by id', async () => {
    const { writeIndex, upsertIndexEntry, readIndex } = await import('../../src/main/ipc/recordingsIndex')
    writeIndex([entry('a', { title: 'Old' })])
    upsertIndexEntry(entry('a', { title: 'New' }))
    const all = readIndex()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('New')
  })

  it('removeIndexEntry removes only the target id', async () => {
    const { writeIndex, removeIndexEntry, readIndex } = await import('../../src/main/ipc/recordingsIndex')
    writeIndex([entry('a'), entry('b')])
    removeIndexEntry('a')
    const all = readIndex()
    expect(all.map((e) => e.id)).toEqual(['b'])
  })

  it('writes atomically — no leftover .tmp file after a successful write', async () => {
    const { writeIndex } = await import('../../src/main/ipc/recordingsIndex')
    writeIndex([entry('a')])
    expect(existsSync(join(userDataDir, 'recordings-index.json'))).toBe(true)
    expect(existsSync(join(userDataDir, 'recordings-index.json.tmp'))).toBe(false)
  })

  it('stores a real JSON array on disk, not a serialized string of stringified data', async () => {
    const { writeIndex } = await import('../../src/main/ipc/recordingsIndex')
    writeIndex([entry('a')])
    const raw = JSON.parse(readFileSync(join(userDataDir, 'recordings-index.json'), 'utf-8'))
    expect(raw.version).toBe(1)
    expect(Array.isArray(raw.entries)).toBe(true)
    expect(raw.entries[0].id).toBe('a')
  })
})
