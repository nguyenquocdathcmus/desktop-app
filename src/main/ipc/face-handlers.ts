import { IpcMain } from 'electron'
import { spawn } from 'child_process'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { binPath } from '../binPath'

export interface FaceSample {
  /** Seconds into the webcam video */
  t: number
  /** Normalized face-center within the webcam frame */
  cx: number
  cy: number
}

interface FaceCache {
  webcamMtimeMs: number
  samples: FaceSample[]
}

/**
 * Runs the face-detector Swift binary (Vision framework) over the webcam video
 * and returns smoothed face-center samples. Cached next to the video by mtime.
 */
export function registerFaceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('webcam:detect-faces', async (_, { webcamPath }: { webcamPath: string }): Promise<FaceSample[]> => {
    if (!webcamPath || !existsSync(webcamPath)) return []

    const cacheFile = join(dirname(webcamPath), 'face.cache.json')
    const stat = statSync(webcamPath)

    try {
      const cached: FaceCache = JSON.parse(readFileSync(cacheFile, 'utf-8'))
      if (cached.webcamMtimeMs === stat.mtimeMs) return cached.samples
    } catch { /* no cache */ }

    const binary = binPath('face-detector')
    if (!existsSync(binary)) {
      console.warn('[face] face-detector binary not found — auto-framing unavailable')
      return []
    }

    const samples = await new Promise<FaceSample[]>((resolve) => {
      const proc = spawn(binary, ['--input', webcamPath], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
      })
      const found: FaceSample[] = []
      let buffer = ''
      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const e = JSON.parse(line)
            if (typeof e.t === 'number' && typeof e.cx === 'number') {
              found.push({ t: e.t, cx: e.cx, cy: e.cy })
            }
          } catch { /* not JSON */ }
        }
      })
      proc.on('close', () => resolve(found))
      proc.on('error', () => resolve([]))
      setTimeout(() => proc.kill(), 120_000)
    })

    // Light smoothing (moving average over ~1s of samples) so the crop doesn't
    // jitter with every detection wobble, then downsample to ≤40 points to keep
    // the export filter expression bounded.
    const smoothed = samples.map((s, i) => {
      const win = samples.slice(Math.max(0, i - 2), Math.min(samples.length, i + 3))
      return {
        t: s.t,
        cx: win.reduce((a, b) => a + b.cx, 0) / win.length,
        cy: win.reduce((a, b) => a + b.cy, 0) / win.length
      }
    })
    const step = Math.max(1, Math.ceil(smoothed.length / 40))
    const downsampled = smoothed.filter((_, i) => i % step === 0)

    try {
      writeFileSync(cacheFile, JSON.stringify({ webcamMtimeMs: stat.mtimeMs, samples: downsampled } satisfies FaceCache))
    } catch { /* non-fatal */ }

    return downsampled
  })
}
