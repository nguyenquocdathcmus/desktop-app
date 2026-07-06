import { spawn, ChildProcess } from 'child_process'
import { binPath } from '../binPath'

export interface CaptureEvent {
  event: 'started' | 'stopped' | 'progress' | 'display' | 'error' | 'warning' | 'paused' | 'resumed'
  t: number
  outputPath?: string
  fps?: number
  frames?: number
  elapsed?: number
  id?: number
  width?: number
  height?: number
  code?: string
  message?: string
  /** Global-screen-coordinate origin of the captured region (Sprint 20
   *  US-159) — needed to rebase cursor-tracker's absolute coordinates onto
   *  the captured frame for both display mode (may be non-zero/negative for
   *  a non-main display) and window mode (the window's screen position). */
  originX?: number
  originY?: number
  /** Combined points→final-pixels scale (Retina scale × any maxHeight
   *  downscale) — cursor-tracker reports in points; multiply by this to
   *  land on the actual video pixel grid. */
  pointsToPixels?: number
}

export interface CaptureOptions {
  outputPath: string
  displayId: number
  windowId?: number
  fps: 30 | 60 | 90 | 120
  captureAudio: boolean
  maxHeight?: number
  /** Capture without the system cursor — the editor draws a synthetic cursor
   *  from cursor.json instead (Sprint 10). */
  hideCursor?: boolean
  /** Sprint 25 US-190 — 10-bit HEVC Main10 capture preserving HDR color
   *  metadata (BT.2020/PQ), opt-in only — see main.swift/VideoWriter.swift. */
  hdr?: boolean
}

export class CaptureProcess {
  private proc: ChildProcess | null = null
  private onEvent?: (event: CaptureEvent) => void

  private get binaryPath(): string {
    return binPath('capture')
  }

  start(opts: CaptureOptions, onEvent: (event: CaptureEvent) => void): void {
    if (this.proc) throw new Error('CaptureProcess already running')
    this.onEvent = onEvent

    const args = [
      '--output', opts.outputPath,
      '--display-id', String(opts.displayId),
      '--fps', String(opts.fps),
      ...(opts.captureAudio ? [] : ['--no-audio']),
      ...(opts.windowId ? ['--window-id', String(opts.windowId)] : []),
      ...(opts.maxHeight ? ['--max-height', String(opts.maxHeight)] : []),
      ...(opts.hideCursor ? ['--hide-cursor'] : []),
      ...(opts.hdr ? ['--hdr'] : [])
    ]

    this.proc = spawn(this.binaryPath, args, {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
    })

    // Parse JSON events from stdout
    let buffer = ''
    this.proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as CaptureEvent
          this.onEvent?.(event)
        } catch {
          // Not JSON — ignore
        }
      }
    })

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[capture binary]', chunk.toString())
    })

    this.proc.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        this.onEvent?.({
          event: 'error',
          t: Date.now(),
          code: 'PROCESS_EXIT',
          message: `Capture process exited with code ${code}`
        })
      }
      this.proc = null
    })
  }

  /** Sends SIGTERM and resolves once the process has actually exited — i.e. the
   *  binary's signal handler has run stream.stopCapture() + writer.finish(), so
   *  the .mov's moov atom is on disk. Reading the file any earlier races the
   *  encoder flush ("moov atom not found" in ffmpeg). SIGKILL fallback at 10s. */
  stop(): Promise<void> {
    const proc = this.proc
    if (!proc) return Promise.resolve()
    return new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
        resolve()
      }, 10_000)
      proc.once('exit', () => {
        clearTimeout(killTimer)
        resolve()
      })
      proc.kill('SIGTERM')
    })
  }

  /** Sends a "pause"/"resume" line over stdin — the binary keeps the SCStream running
   *  and drops frames internally, avoiding the cost/risk of tearing down and restarting
   *  the capture stream. No-op if the process isn't running. */
  pause(): void {
    this.proc?.stdin?.write('pause\n')
  }

  resume(): void {
    this.proc?.stdin?.write('resume\n')
  }

  get isRunning(): boolean {
    return this.proc !== null
  }
}
