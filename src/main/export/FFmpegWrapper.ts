import { spawn, ChildProcess } from 'child_process'
import { binPath } from '../binPath'

export interface FFmpegProgress {
  percent: number
  fps?: number
  speed?: string
  eta?: number
}

export class FFmpegWrapper {
  private currentProc: ChildProcess | null = null

  private get binary(): string {
    return binPath('ffmpeg')
  }

  run(
    args: string[],
    durationSec: number,
    onProgress: (p: FFmpegProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binary, ['-y', ...args], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
      })
      this.currentProc = proc

      // Stall watchdog: if ffmpeg produces no stderr output (no progress) for this
      // long, treat it as stuck (e.g. a pathologically slow filter or a wedged
      // VideoToolbox session) and kill it — a previous run hung indefinitely at
      // 600%+ CPU and corrupted the hardware encoder for subsequent recordings.
      const STALL_TIMEOUT_MS = 90_000
      let stallTimer: ReturnType<typeof setTimeout> | null = null
      const resetStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer)
        stallTimer = setTimeout(() => {
          stderr += '\n[watchdog] No progress for 90s — killing stalled ffmpeg process.\n'
          this.kill()
        }, STALL_TIMEOUT_MS)
      }
      resetStallTimer()

      let stderr = ''
      proc.stderr.on('data', (chunk: Buffer) => {
        resetStallTimer()
        const text = chunk.toString()
        stderr += text

        // Parse progress from FFmpeg output: "frame=  60 fps= 30 ... time=00:00:02.00 ..."
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
        const fpsMatch = text.match(/fps=\s*([\d.]+)/)
        const speedMatch = text.match(/speed=\s*([\d.]+x)/)

        if (timeMatch && durationSec > 0) {
          const h = parseInt(timeMatch[1])
          const m = parseInt(timeMatch[2])
          const s = parseInt(timeMatch[3])
          const elapsed = h * 3600 + m * 60 + s
          const percent = Math.min(100, Math.round((elapsed / durationSec) * 100))
          const speedMultiplier = speedMatch ? parseFloat(speedMatch[1]) : 0
          const remainingMediaSec = Math.max(0, durationSec - elapsed)
          const eta = speedMultiplier > 0 ? Math.round(remainingMediaSec / speedMultiplier) : undefined
          onProgress({
            percent,
            fps: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
            speed: speedMatch ? speedMatch[1] : undefined,
            eta
          })
        }
      })

      proc.on('close', (code, signal) => {
        if (stallTimer) clearTimeout(stallTimer)
        this.currentProc = null
        if (code === 0) {
          onProgress({ percent: 100 })
          resolve()
        } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          reject(new Error(`FFmpeg cancelled or killed (stalled)\n${stderr.slice(-500)}`))
        } else {
          reject(new Error(`FFmpeg exited with code ${code}\n${stderr.slice(process.env.DEBUG_FFMPEG_ARGS ? -4000 : -500)}`))
        }
      })

      proc.on('error', (err) => {
        if (stallTimer) clearTimeout(stallTimer)
        this.currentProc = null
        reject(new Error(`FFmpeg spawn error: ${err.message}`))
      })
    })
  }

  /** Kills the in-flight ffmpeg process, if any — used by export cancel and app quit. */
  kill(): void {
    if (this.currentProc && !this.currentProc.killed) {
      this.currentProc.kill('SIGTERM')
      // Force-kill if it doesn't exit within 3s (e.g. stuck in a slow filter)
      const proc = this.currentProc
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 3000)
    }
  }

  // Check if ffmpeg binary exists
  async checkBinary(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.binary, ['-version'])
      proc.on('close', (code) => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })
  }
}
