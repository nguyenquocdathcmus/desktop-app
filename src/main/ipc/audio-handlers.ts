import { IpcMain } from 'electron'
import { spawn } from 'child_process'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { binPath } from '../binPath'

export interface SilenceRegion {
  start: number
  end: number
}

interface SilenceCache {
  videoMtimeMs: number
  noiseDb: number
  minDuration: number
  regions: SilenceRegion[]
}

function cachePath(videoPath: string): string {
  return join(dirname(videoPath), 'silence.cache.json')
}

/**
 * Runs ffmpeg silencedetect over the video's audio track and returns the silent
 * regions. Results are cached next to the video keyed by its mtime, so re-opening
 * a project doesn't re-scan a file that hasn't changed.
 */
async function detectSilence(videoPath: string, noiseDb: number, minDuration: number): Promise<SilenceRegion[]> {
  const stat = statSync(videoPath)

  try {
    const cached: SilenceCache = JSON.parse(readFileSync(cachePath(videoPath), 'utf-8'))
    if (cached.videoMtimeMs === stat.mtimeMs && cached.noiseDb === noiseDb && cached.minDuration === minDuration) {
      return cached.regions
    }
  } catch { /* no cache — run detection */ }

  const regions = await new Promise<SilenceRegion[]>((resolve) => {
    const proc = spawn(binPath('ffmpeg'), [
      '-i', videoPath,
      '-af', `silencedetect=noise=${noiseDb}dB:d=${minDuration}`,
      '-f', 'null', '-'
    ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } })

    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', () => {
      const found: SilenceRegion[] = []
      // silencedetect logs pairs of lines: "silence_start: 4.2" then
      // "silence_end: 6.8 | silence_duration: 2.6"
      const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]))
      const ends = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => parseFloat(m[1]))
      for (let i = 0; i < starts.length; i++) {
        // A trailing silence_start without an end means silence runs to EOF —
        // skip it here; the out-point trim already covers trailing dead air.
        if (ends[i] === undefined) break
        found.push({ start: starts[i], end: ends[i] })
      }
      resolve(found)
    })
    proc.on('error', () => resolve([]))

    setTimeout(() => proc.kill(), 60_000)
  })

  try {
    writeFileSync(cachePath(videoPath), JSON.stringify({
      videoMtimeMs: stat.mtimeMs, noiseDb, minDuration, regions
    } satisfies SilenceCache))
  } catch { /* non-fatal */ }

  return regions
}

export function registerAudioHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('audio:detect-silence', async (_, { videoPath, noiseDb = -35, minDuration = 1.2 }: {
    videoPath: string
    noiseDb?: number
    minDuration?: number
  }): Promise<SilenceRegion[]> => {
    if (!videoPath || !existsSync(videoPath)) return []
    try {
      return await detectSilence(videoPath, noiseDb, minDuration)
    } catch (e) {
      console.error('[silence] detection failed:', e)
      return []
    }
  })

  // Small utility used by ExportModal to know whether optional sidecar files
  // (mic.webm, system.m4a — Sprint 11 ducking) exist for the current recording.
  ipcMain.handle('file:exists', (_, { path }: { path: string }): boolean => {
    try { return !!path && existsSync(path) } catch { return false }
  })
}
