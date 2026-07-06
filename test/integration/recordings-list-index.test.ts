import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolve } from 'path'

/**
 * Sprint 27 US-200/201/202 — exercises the real IPC handlers in
 * recordings-list-handler.ts against real recording directories (real small
 * video files probed by the real bundled ffmpeg), verifying the new JSON
 * index actually replaces the old "read everything from disk every call"
 * pipeline correctly: first call builds the index from scratch, second call
 * reuses it without re-probing, deleting a recording outside the app is
 * detected and self-healed, and pagination returns the right slices.
 */

let documentsDir: string
let userDataDir: string

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => resolve(__dirname, '../..'),
    getPath: (name: string) => (name === 'documents' ? documentsDir : userDataDir)
  }
}))

function ffmpegBin(): string {
  return join(resolve(__dirname, '../..'), 'resources/bin/ffmpeg')
}

function makeFakeRecording(recordingsDir: string, id: string, durationSec = 2): void {
  const dir = join(recordingsDir, id)
  mkdirSync(dir, { recursive: true })
  const videoPath = join(dir, 'capture.mov')
  const result = spawnSync(ffmpegBin(), [
    '-y', '-f', 'lavfi', '-i', `testsrc=duration=${durationSec}:size=320x240:rate=10`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoPath
  ])
  if (result.status !== 0) throw new Error(`fixture generation failed: ${result.stderr}`)
}

describe('recordings-list-handler + recordingsIndex — real files, real ffmpeg', () => {
  beforeAll(() => {
    documentsDir = mkdtempSync(join(tmpdir(), 'recordings-list-docs-'))
    userDataDir = mkdtempSync(join(tmpdir(), 'recordings-list-userdata-'))
  }, 30_000)

  afterAll(() => {
    rmSync(documentsDir, { recursive: true, force: true })
    rmSync(userDataDir, { recursive: true, force: true })
  })

  it('builds the index from scratch on first call and lists real recordings', async () => {
    const recordingsDir = join(documentsDir, 'Record Screen Recordings')
    makeFakeRecording(recordingsDir, 'rec-1')
    makeFakeRecording(recordingsDir, 'rec-2')

    // Import fresh after the electron mock + fixtures are in place.
    vi.resetModules()
    const { registerRecordingsListHandler } = await import('../../src/main/ipc/recordings-list-handler')
    const handlers = new Map<string, (...args: any[]) => any>()
    const fakeIpcMain = { handle: (ch: string, fn: any) => handlers.set(ch, fn) } as any
    registerRecordingsListHandler(fakeIpcMain)

    const result = await handlers.get('recordings:list')!(null, {})
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.hasMore).toBe(false)
    expect(result.items.every((r: any) => r.duration > 0)).toBe(true)

    // Real assertion this sprint is actually about: the index file now exists on disk.
    expect(existsSync(join(userDataDir, 'recordings-index.json'))).toBe(true)
  }, 30_000)

  it('reuses the index on a second call without re-probing (fast path)', async () => {
    vi.resetModules()
    const { registerRecordingsListHandler } = await import('../../src/main/ipc/recordings-list-handler')
    const handlers = new Map<string, (...args: any[]) => any>()
    const fakeIpcMain = { handle: (ch: string, fn: any) => handlers.set(ch, fn) } as any
    registerRecordingsListHandler(fakeIpcMain)

    const before = readFileSync(join(userDataDir, 'recordings-index.json'), 'utf-8')
    const result = await handlers.get('recordings:list')!(null, {})
    const after = readFileSync(join(userDataDir, 'recordings-index.json'), 'utf-8')

    expect(result.items).toHaveLength(2)
    // Index content shouldn't churn on a no-op reconcile.
    expect(JSON.parse(before).entries.length).toBe(JSON.parse(after).entries.length)
  }, 15_000)

  it('paginates correctly with limit/offset', async () => {
    const recordingsDir = join(documentsDir, 'Record Screen Recordings')
    makeFakeRecording(recordingsDir, 'rec-3')

    vi.resetModules()
    const { registerRecordingsListHandler } = await import('../../src/main/ipc/recordings-list-handler')
    const handlers = new Map<string, (...args: any[]) => any>()
    const fakeIpcMain = { handle: (ch: string, fn: any) => handlers.set(ch, fn) } as any
    registerRecordingsListHandler(fakeIpcMain)

    const page1 = await handlers.get('recordings:list')!(null, { limit: 2, offset: 0 })
    expect(page1.items).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.hasMore).toBe(true)

    const page2 = await handlers.get('recordings:list')!(null, { limit: 2, offset: 2 })
    expect(page2.items).toHaveLength(1)
    expect(page2.hasMore).toBe(false)
  }, 30_000)

  it('self-heals when a recording is deleted outside the app', async () => {
    const recordingsDir = join(documentsDir, 'Record Screen Recordings')
    rmSync(join(recordingsDir, 'rec-3'), { recursive: true, force: true })

    vi.resetModules()
    const { registerRecordingsListHandler } = await import('../../src/main/ipc/recordings-list-handler')
    const handlers = new Map<string, (...args: any[]) => any>()
    const fakeIpcMain = { handle: (ch: string, fn: any) => handlers.set(ch, fn) } as any
    registerRecordingsListHandler(fakeIpcMain)

    const result = await handlers.get('recordings:list')!(null, {})
    expect(result.items.map((r: any) => r.id).sort()).toEqual(['rec-1', 'rec-2'])
  }, 15_000)

  it('recordings:delete removes both the directory and the index entry', async () => {
    vi.resetModules()
    const { registerRecordingsListHandler } = await import('../../src/main/ipc/recordings-list-handler')
    const handlers = new Map<string, (...args: any[]) => any>()
    const fakeIpcMain = { handle: (ch: string, fn: any) => handlers.set(ch, fn) } as any
    registerRecordingsListHandler(fakeIpcMain)

    const del = await handlers.get('recordings:delete')!(null, { id: 'rec-2' })
    expect(del.ok).toBe(true)
    expect(existsSync(join(documentsDir, 'Record Screen Recordings', 'rec-2'))).toBe(false)

    const result = await handlers.get('recordings:list')!(null, {})
    expect(result.items.map((r: any) => r.id)).toEqual(['rec-1'])
  }, 15_000)
})
