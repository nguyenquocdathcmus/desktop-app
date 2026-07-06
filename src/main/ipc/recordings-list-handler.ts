import { IpcMain, app } from 'electron'
import {
  existsSync, readdirSync, statSync, rmSync,
  readFileSync, writeFileSync
} from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { binPath } from '../binPath'
import { RECORDINGS_DIR } from '../../shared/constants'
import { readPublishHistory, type PublishRecord } from './publish-handlers'
import { readIndex, writeIndex, indexExists, upsertIndexEntry, removeIndexEntry, type RecordingIndexEntry } from './recordingsIndex'

export interface RecordingMeta {
  id: string
  videoPath: string
  title: string | null
  createdAt: number
  duration: number
  width: number
  height: number
  fileSize: number
  thumbnailDataUrl: string | null
  /** Sprint 21 US-170 — where this recording's exports have been published,
   *  read from the sidecar file next to whichever export file was uploaded. */
  publishHistory: PublishRecord[]
  /** Sprint 26 US-199 — count of review comments not yet marked resolved,
   *  read directly from manifest.json (reviewComments field, Sprint 15). */
  unresolvedCommentCount: number
  /** Sprint 27 US-204 — capture frame rate, 0 if unknown (never opened as a
   *  project yet, so no manifest.json to read it from). */
  fps: number
}

interface CachedMeta {
  videoMtimeMs: number
  duration: number
  width: number
  height: number
}

function getRecordingsDir(): string {
  return join(app.getPath('documents'), RECORDINGS_DIR)
}

// Async FFmpeg wrapper — does NOT block main thread
function runFFmpeg(args: string[]): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve) => {
    const ff = binPath('ffmpeg')
    const chunks: Buffer[] = []
    const errChunks: string[] = []

    const proc = spawn(ff, args)
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))
    proc.stderr.on('data', (d: Buffer) => errChunks.push(d.toString()))
    proc.on('close', () => resolve({
      stdout: Buffer.concat(chunks),
      stderr: errChunks.join('')
    }))
    proc.on('error', () => resolve({ stdout: Buffer.alloc(0), stderr: '' }))

    // Kill after 8s
    setTimeout(() => proc.kill(), 8000)
  })
}

async function probeVideo(videoPath: string): Promise<{ duration: number; width: number; height: number }> {
  try {
    const { stderr } = await runFFmpeg(['-i', videoPath, '-f', 'null', '-'])
    const dur = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/)
    const dim = stderr.match(/(\d{3,5})x(\d{3,5})/)
    return {
      duration: dur ? parseInt(dur[1]) * 3600 + parseInt(dur[2]) * 60 + parseFloat(dur[3]) : 0,
      width: dim ? parseInt(dim[1]) : 0,
      height: dim ? parseInt(dim[2]) : 0
    }
  } catch {
    return { duration: 0, width: 0, height: 0 }
  }
}

async function makeThumbnail(videoPath: string): Promise<string | null> {
  try {
    const { stdout } = await runFFmpeg([
      '-ss', '1', '-i', videoPath,
      '-vframes', '1', '-vf', 'scale=480:-1',
      '-f', 'image2', '-vcodec', 'mjpeg', '-update', '1', 'pipe:1'
    ])
    if (stdout.length < 100) return null
    return `data:image/jpeg;base64,${stdout.toString('base64')}`
  } catch {
    return null
  }
}

function titlePath(dir: string, id: string): string {
  return join(dir, id, 'title.txt')
}

function readTitle(dir: string, id: string): string | null {
  try {
    const t = readFileSync(titlePath(dir, id), 'utf-8').trim()
    return t || null
  } catch {
    return null
  }
}

/** Sprint 26 US-199 — reads reviewComments directly from manifest.json rather
 *  than adding another cache file; this list is small and read infrequently
 *  (HomeScreen render), so the extra JSON parse isn't worth caching. */
function readUnresolvedCommentCount(dir: string, id: string): number {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf-8'))
    const comments = manifest.reviewComments as { resolved?: boolean }[] | undefined
    return (comments ?? []).filter((c) => !c.resolved).length
  } catch {
    return 0
  }
}

/** Sprint 27 US-204 — fps lives in the project manifest.json (SessionManifest.fps),
 *  written once the recording is opened/saved as a project; a fresh recording
 *  that's never been opened has no manifest.json yet, so this returns 0
 *  (HomeScreen hides the fps detail rather than showing a wrong/fake number). */
function readFps(dir: string, id: string): number {
  try {
    const manifest = JSON.parse(readFileSync(join(dir, id, 'manifest.json'), 'utf-8'))
    return typeof manifest.fps === 'number' ? manifest.fps : 0
  } catch {
    return 0
  }
}

function metaCachePath(dir: string, id: string): string {
  return join(dir, id, 'meta.cache.json')
}

function thumbCachePath(dir: string, id: string): string {
  return join(dir, id, 'thumb.cache.jpg')
}

function readMetaCache(dir: string, id: string, videoMtimeMs: number): CachedMeta | null {
  try {
    const raw = readFileSync(metaCachePath(dir, id), 'utf-8')
    const cached: CachedMeta = JSON.parse(raw)
    if (cached.videoMtimeMs !== videoMtimeMs) return null
    return cached
  } catch {
    return null
  }
}

function writeMetaCache(dir: string, id: string, cached: CachedMeta): void {
  try {
    writeFileSync(metaCachePath(dir, id), JSON.stringify(cached))
  } catch { /* non-fatal — will just re-probe next time */ }
}

function readThumbCache(dir: string, id: string, videoMtimeMs: number): string | null {
  try {
    const thumbPath = thumbCachePath(dir, id)
    const thumbStat = statSync(thumbPath)
    if (thumbStat.mtimeMs < videoMtimeMs) return null
    return `data:image/jpeg;base64,${readFileSync(thumbPath).toString('base64')}`
  } catch {
    return null
  }
}

function writeThumbCache(dir: string, id: string, dataUrl: string): void {
  try {
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
    writeFileSync(thumbCachePath(dir, id), Buffer.from(base64, 'base64'))
  } catch { /* non-fatal */ }
}

/** Builds a full index entry for one recording directory by reading its
 *  files directly — the expensive path, only used for recordings not
 *  already in the index (or with a stale entry). Sprint 27 US-200. */
async function buildEntry(dir: string, id: string): Promise<RecordingIndexEntry | null> {
  const videoPath = join(dir, id, 'capture.mov')
  if (!existsSync(videoPath)) return null

  const stat = statSync(videoPath)
  if (stat.size < 10_000) return null // skip broken/empty

  const cached = readMetaCache(dir, id, stat.mtimeMs)
  const info = cached ?? await probeVideo(videoPath)
  if (!cached) {
    writeMetaCache(dir, id, { videoMtimeMs: stat.mtimeMs, ...info })
  }

  return {
    id,
    videoPath,
    title: readTitle(dir, id),
    createdAt: stat.birthtimeMs || stat.ctimeMs,
    duration: info.duration,
    width: info.width,
    height: info.height,
    fileSize: stat.size,
    publishHistory: readPublishHistory(join(dir, id)),
    unresolvedCommentCount: readUnresolvedCommentCount(dir, id),
    fps: readFps(dir, id),
    videoMtimeMs: stat.mtimeMs
  }
}

/** Sprint 27 US-201/US-202 — reconciles the JSON index against what's
 *  actually on disk: drops entries whose recording directory no longer
 *  exists (deleted outside the app), and builds entries for any directory
 *  missing from the index (first run after update, or an index that was
 *  deleted/corrupted). This is the ONLY place that ever calls `readdirSync`
 *  on the recordings directory — every other read is a plain JSON array
 *  scan, which is what actually fixes the "reads ≥5 files per recording on
 *  every call" bottleneck the previous implementation had.
 *
 *  Cheap in the common case (index already covers everything — this is just
 *  an array diff + statSync per existing entry to catch external
 *  deletions), so it's safe to call on every `recordings:list` request
 *  rather than needing a separate file-watcher process. */
async function reconcileIndex(dir: string): Promise<RecordingIndexEntry[]> {
  const entries = readIndex()

  if (!existsSync(dir)) {
    if (entries.length > 0) writeIndex([])
    return []
  }

  const dirIds = new Set(
    readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  )

  // Drop entries for recordings deleted outside the app (or a stale index
  // entry whose backing file vanished) — statSync is one syscall per entry,
  // far cheaper than the old per-recording multi-file read this replaces.
  // No `await` between the read above and this write, so nothing else can
  // have changed the index in between — safe to write the full array here.
  const stillValid = entries.filter((e) => dirIds.has(e.id) && existsSync(e.videoPath))
  const missingIds = [...dirIds].filter((id) => !stillValid.some((e) => e.id === id))
  if (stillValid.length !== entries.length) writeIndex(stillValid)

  if (missingIds.length === 0) return stillValid

  // Sprint 29 BUG-04 — building missing entries probes each one with ffmpeg
  // (buildEntry → probeVideo), which can take long enough for another IPC
  // call (recordings:delete, recordings:rename) to run to completion in
  // between, via upsertIndexEntry/removeIndexEntry — each of which reads a
  // FRESH index right before writing. This used to write back `stillValid`
  // (captured before the await) plus the newly built entries, silently
  // undoing whatever that other call had just done. Each new entry is now
  // upserted individually — same read-fresh-then-write pattern the
  // concurrent delete/rename call itself uses, so whichever finishes last
  // wins on its own entry only, never clobbering unrelated entries.
  const built = (await Promise.all(missingIds.map((id) => buildEntry(dir, id))))
    .filter((e): e is RecordingIndexEntry => e !== null)
  for (const entry of built) upsertIndexEntry(entry)

  return [...stillValid, ...built]
}

/** Sprint 27 US-201 — publishHistory and unresolvedCommentCount aren't
 *  refreshed by reconcileIndex (which only cares about additions/removals),
 *  so they're re-read live here on every list call. This is intentionally
 *  NOT cached in the index: both are cheap (one small JSON read each) and
 *  change from actions elsewhere (publish-handlers.ts, the Editor's comment
 *  UI) that don't know about — or need to know about — the recordings index.
 *  The expensive part this sprint actually fixes (ffmpeg probing, multi-file
 *  reads for duration/dimensions/title) stays cached in the index untouched. */
function toMeta(dir: string, entry: RecordingIndexEntry, thumbnailDataUrl: string | null): RecordingMeta {
  const { videoMtimeMs: _unused, ...meta } = entry
  return {
    ...meta,
    thumbnailDataUrl,
    publishHistory: readPublishHistory(join(dir, entry.id)),
    unresolvedCommentCount: readUnresolvedCommentCount(dir, entry.id),
    fps: readFps(dir, entry.id) || entry.fps
  }
}

export function registerRecordingsListHandler(ipcMain: IpcMain): void {
  ipcMain.handle('recordings:rename', async (_, { id, title }: { id: string; title: string }): Promise<{ ok: boolean }> => {
    try {
      const dir = getRecordingsDir()
      if (!existsSync(join(dir, id))) return { ok: false }
      writeFileSync(titlePath(dir, id), title.trim())
      // Sprint 27 US-201 — keep the index in sync incrementally rather than
      // waiting for the next full reconcile to notice the title changed.
      const entries = readIndex()
      const entry = entries.find((e) => e.id === id)
      if (entry) upsertIndexEntry({ ...entry, title: title.trim() })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('recordings:delete', async (_, { id }: { id: string }): Promise<{ ok: boolean }> => {
    try {
      const dir = join(getRecordingsDir(), id)
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
      removeIndexEntry(id)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  // Sprint 27 US-200/US-203 — reads the JSON index (reconciling against disk
  // first, cheaply) instead of re-reading every recording's files on every
  // call. Supports pagination so the renderer never has to load the entire
  // list just to show the first page (US-203 "Load more").
  ipcMain.handle('recordings:list', async (_, opts?: { limit?: number; offset?: number }): Promise<{
    items: RecordingMeta[]
    total: number
    hasMore: boolean
  }> => {
    const dir = getRecordingsDir()
    const entries = await reconcileIndex(dir)
    const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)

    const offset = opts?.offset ?? 0
    const limit = opts?.limit ?? sorted.length
    const page = sorted.slice(offset, offset + limit)

    // Thumbnails are intentionally NOT stored in the index (they'd bloat a
    // single JSON file with base64 image data for every recording) — always
    // lazy-loaded per-card via recordings:get-thumbnail, same as before.
    const items = page.map((e) => toMeta(dir, e, readThumbCache(dir, e.id, e.videoMtimeMs)))

    return { items, total: sorted.length, hasMore: offset + page.length < sorted.length }
  })

  // Lazy thumbnail generation — called by renderer per-recording after the
  // list resolves, so a cold cache doesn't block the whole list from showing.
  ipcMain.handle('recordings:get-thumbnail', async (_, { id }: { id: string }): Promise<string | null> => {
    const dir = getRecordingsDir()
    const videoPath = join(dir, id, 'capture.mov')
    if (!existsSync(videoPath)) return null

    const stat = statSync(videoPath)
    const cached = readThumbCache(dir, id, stat.mtimeMs)
    if (cached) return cached

    const thumbnail = await makeThumbnail(videoPath)
    if (thumbnail) writeThumbCache(dir, id, thumbnail)
    return thumbnail
  })
}
