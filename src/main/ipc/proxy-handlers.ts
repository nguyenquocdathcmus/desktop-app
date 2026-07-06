import { IpcMain, BrowserWindow } from 'electron'
import { existsSync, statSync, unlinkSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { FFmpegWrapper } from '../export/FFmpegWrapper'

const ffmpeg = new FFmpegWrapper()

/**
 * Proxy preview generation (Sprint 16). A 720p H.264 ultrafast re-encode of
 * `capture.mov`, generated in the background right after recording stops, so
 * scrubbing/seeking a 4K source in the editor doesn't force the browser to
 * decode full-resolution HEVC on every timeline drag. Export always reads
 * `capture.mov` directly — this file only ever backs the preview `<video>`.
 */
function proxyPath(videoPath: string): string {
  return join(dirname(videoPath), 'proxy.mp4')
}

function isProxyFresh(videoPath: string): boolean {
  const proxy = proxyPath(videoPath)
  if (!existsSync(proxy) || !existsSync(videoPath)) return false
  return statSync(proxy).mtimeMs >= statSync(videoPath).mtimeMs
}

const inFlight = new Set<string>()

/** Fire-and-forget: spawns proxy generation for a just-finished recording.
 *  Non-blocking — callers should not await this on the recording-stop path. */
export function generateProxyInBackground(videoPath: string): void {
  if (isProxyFresh(videoPath) || inFlight.has(videoPath)) return
  inFlight.add(videoPath)

  const outPath = proxyPath(videoPath)
  const tmpPath = outPath.replace(/\.mp4$/, '.tmp.mp4')

  ffmpeg.run(
    ['-i', videoPath, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', tmpPath],
    0,
    (progress) => {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('proxy:progress', { videoPath, percent: progress.percent })
      })
    }
  )
    .then(() => {
      // Sprint 29 (round 2) — the unlinkSync(outPath) that used to run right
      // before this was both redundant and the actual source of
      // non-atomicity the comment claims to avoid: renameSync alone already
      // overwrites an existing destination atomically on POSIX. If the app
      // died between the unlink and the rename, `proxy.mp4` was gone with no
      // replacement (forcing a silent re-encode on next launch) and the temp
      // file was left orphaned on disk indefinitely.
      renameSync(tmpPath, outPath)
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('proxy:ready', { videoPath, proxyPath: outPath })
      })
    })
    .catch((err) => {
      console.warn('[proxy] generation failed (non-fatal, preview falls back to original):', err.message)
      try { if (existsSync(tmpPath)) unlinkSync(tmpPath) } catch { /* ignore */ }
    })
    .finally(() => {
      inFlight.delete(videoPath)
    })
}

export function registerProxyHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('proxy:get-status', (_, { videoPath }: { videoPath: string }): { ready: boolean; proxyPath: string | null } => {
    if (isProxyFresh(videoPath)) return { ready: true, proxyPath: proxyPath(videoPath) }
    return { ready: false, proxyPath: null }
  })

  // Allows the editor to (re)request a proxy if one wasn't generated at record-stop
  // time (e.g. an older recording made before Sprint 16, or a manual re-encode).
  ipcMain.handle('proxy:generate', (_, { videoPath }: { videoPath: string }): { started: boolean } => {
    if (isProxyFresh(videoPath)) return { started: false }
    generateProxyInBackground(videoPath)
    return { started: true }
  })
}

/** Deletes the cached proxy alongside a recording being deleted (US-134). */
export function deleteProxyFor(videoPath: string): void {
  try {
    const p = proxyPath(videoPath)
    if (existsSync(p)) unlinkSync(p)
  } catch { /* non-fatal */ }
}
