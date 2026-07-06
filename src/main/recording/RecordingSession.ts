import { randomUUID } from 'crypto'
import { join } from 'path'
import { app, screen } from 'electron'
import { mkdirSync, existsSync, writeFileSync, renameSync, unlinkSync, readFileSync } from 'fs'
import type { RecordingStatus, StartOptions } from '../../shared/ipc-types'
import type { SessionManifest } from '../../shared/project-types'
import { CaptureProcess } from './CaptureProcess'
import { CursorProcess } from './CursorProcess'
import { FFmpegWrapper } from '../export/FFmpegWrapper'
import { RECORDINGS_DIR } from '../../shared/constants'

const ffmpeg = new FFmpegWrapper()

/**
 * Sprint 20 US-159 — cursor-tracker's CGEventTap always reports absolute,
 * system-wide point coordinates, regardless of which display/window is being
 * captured. Every consumer downstream (zoom auto-generation, synthetic
 * cursor, click ripples) divides by `manifest.width/height` assuming (0,0)
 * is the top-left of the captured frame in pixels — which silently breaks
 * two ways on any multi-display setup: (1) a non-main display or a window
 * has a non-zero (possibly negative) origin, so raw coordinates land outside
 * or in the wrong part of the frame; (2) cursor-tracker's points don't match
 * the frame's pixel grid on Retina displays (e.g. 1512pt vs 3024px = 2x off).
 * This is fixed once, here, at the source — every downstream consumer
 * continues to just divide by manifest.width/height and gets the right
 * answer, no changes needed anywhere else.
 */
export function rebaseCursorEvents(cursorPath: string, originX: number, originY: number, pointsToPixels: number, captureWidthPx: number, captureHeightPx: number): void {
  if (!existsSync(cursorPath)) return

  try {
    const raw = readFileSync(cursorPath, 'utf-8').trim()
    if (!raw || raw === '[]' || raw === '[\n]') return
    const events: Array<{ x?: number; y?: number; [k: string]: unknown }> = JSON.parse(raw)

    const rebased = events
      .map((e) => {
        if (e.x === undefined || e.y === undefined) return e // keydown/etc have no position
        const px = (e.x - originX) * pointsToPixels
        const py = (e.y - originY) * pointsToPixels
        return { ...e, x: px, y: py }
      })
      .filter((e) => {
        if (e.x === undefined || e.y === undefined) return true
        // Cursor moved outside the captured frame (e.g. onto another display) —
        // drop the event rather than let it produce a nonsensical zoom/cursor
        // position far outside the visible video.
        return e.x >= 0 && e.x <= captureWidthPx && e.y >= 0 && e.y <= captureHeightPx
      })

    writeFileSync(cursorPath, JSON.stringify(rebased, null, 0))
  } catch (err) {
    console.warn('[cursor] rebase failed (non-fatal, cursor overlay may be misaligned):', err)
  }
}

export class RecordingSession {
  private _status: RecordingStatus = { state: 'idle' }
  private _manifest: SessionManifest | null = null
  // Real bug fixed here: this used to be a single `?: callback` slot, so the
  // second caller of onStatusChange() silently replaced the first instead of
  // adding a second listener. registerRecordingHandlers() registers first
  // (broadcasts RECORDING_STATUS to all renderer windows — the controls
  // pill's and Editor's source of truth for "is a recording in progress");
  // createTray() (Sprint 23) registers afterward to update the menu bar icon
  // — which overwrote the renderer broadcaster entirely, so after the tray
  // was added the controls pill and menu bar could show whichever one
  // happened to subscribe last, never both in sync.
  private _onStatusChangeCallbacks: Array<(status: RecordingStatus) => void> = []

  private capture = new CaptureProcess()
  private cursor = new CursorProcess()
  private _sessionId: string = ''
  private _outputDir: string = ''
  private _startedAt: number = 0
  private _opts: StartOptions | null = null
  private _micPath: string = ''
  private _micLeadMs: number = 0
  private _webcamPath: string = ''
  private _expectWebcam: boolean = false
  private _captureWidth: number = 0
  private _captureHeight: number = 0
  private _captureOriginX: number = 0
  private _captureOriginY: number = 0
  private _capturePointsToPixels: number = 1
  private _pausedElapsedMs: number = 0

  get status(): RecordingStatus { return this._status }
  get manifest(): SessionManifest | null { return this._manifest }

  onStatusChange(cb: (status: RecordingStatus) => void): void {
    this._onStatusChangeCallbacks.push(cb)
  }

  private setState(status: RecordingStatus): void {
    this._status = status
    for (const cb of this._onStatusChangeCallbacks) cb(status)
  }

  async start(opts: StartOptions): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this._status.state !== 'idle') {
      return { ok: false, error: `Cannot start: session is ${this._status.state}` }
    }

    this._opts = opts
    this._expectWebcam = !!opts.webcamEnabled
    this._webcamPath = ''
    this._captureWidth = 0
    this._captureHeight = 0
    this._captureOriginX = 0
    this._captureOriginY = 0
    this._capturePointsToPixels = 1
    this._sessionId = randomUUID()
    this._outputDir = opts.outputDir || join(
      app.getPath('documents'),
      RECORDINGS_DIR,
      this._sessionId
    )
    mkdirSync(this._outputDir, { recursive: true })

    const videoPath = join(this._outputDir, 'capture.mov')
    const cursorPath = join(this._outputDir, 'cursor.json')

    this.setState({ state: 'ready', displayId: opts.displayId })

    // Start cursor tracker first (it starts immediately, no permission prompt needed here)
    try {
      this.cursor.start(cursorPath)
    } catch (err) {
      console.error('cursor-tracker start failed (non-fatal):', err)
    }

    // Start screen capture
    return new Promise((resolve) => {
      let resolved = false

      this.capture.start(
        { outputPath: videoPath, displayId: opts.displayId, windowId: opts.windowId, fps: opts.fps, captureAudio: opts.captureAudio, maxHeight: opts.maxHeight, hideCursor: opts.hideCursor, hdr: opts.hdr },
        (event) => {
          if (event.event === 'display' && event.width && event.height) {
            // Actual pixel dimensions being written to the video — in window mode this is
            // the window's cropped size, not the full display, so prefer it over recomputing
            // from Electron's screen module in stop().
            this._captureWidth = event.width
            this._captureHeight = event.height
            // Sprint 20 US-159 — global-screen-coordinate origin of the captured
            // region, in POINTS (not the scaled pixel width/height above). Used to
            // rebase cursor-tracker's absolute coordinates in stop().
            this._captureOriginX = event.originX ?? 0
            this._captureOriginY = event.originY ?? 0
            this._capturePointsToPixels = event.pointsToPixels ?? 1
          } else if (event.event === 'started' && !resolved) {
            resolved = true
            this._startedAt = Date.now()
            this._pausedElapsedMs = 0
            this.setState({ state: 'recording', startedAt: this._startedAt, displayId: opts.displayId, windowId: opts.windowId, pausedElapsedMs: 0 })
            resolve({ ok: true })
          } else if (event.event === 'error' && !resolved) {
            resolved = true
            // Real bug fixed here: this only stopped cursor-tracker, never the
            // capture process itself — if capture didn't fully exit on its own
            // right after emitting the error (e.g. it's still tearing down the
            // SCStream), it was left running with no session state pointing at
            // it, since state jumps straight to 'idle' below.
            this.capture.stop().catch(() => {})
            this.cursor.stop()
            this.setState({ state: 'idle' })
            resolve({ ok: false, error: event.message ?? 'Capture failed' })
          } else if (event.event === 'progress') {
            // Forward progress to UI if needed
          }
        }
      )

      // Timeout if capture doesn't start within 10s
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          this.capture.stop()
          this.cursor.stop()
          this.setState({ state: 'idle' })
          resolve({ ok: false, error: 'Capture start timeout (check Screen Recording permission)' })
        }
      }, 10_000)
    })
  }

  pause(): { ok: true } | { ok: false; error: string } {
    if (this._status.state !== 'recording') {
      return { ok: false, error: `Cannot pause: session is ${this._status.state}` }
    }
    const s = this._status
    this.capture.pause()
    this.setState({ state: 'paused', startedAt: s.startedAt, displayId: s.displayId, windowId: s.windowId, pausedElapsedMs: s.pausedElapsedMs, pausedAt: Date.now() })
    return { ok: true }
  }

  resume(): { ok: true } | { ok: false; error: string } {
    if (this._status.state !== 'paused') {
      return { ok: false, error: `Cannot resume: session is ${this._status.state}` }
    }
    const s = this._status
    this.capture.resume()
    const pausedElapsedMs = s.pausedElapsedMs + (Date.now() - s.pausedAt)
    this.setState({ state: 'recording', startedAt: s.startedAt, displayId: s.displayId, windowId: s.windowId, pausedElapsedMs })
    return { ok: true }
  }

  async stop(): Promise<{ ok: true; manifest: SessionManifest } | { ok: false; error: string }> {
    if (this._status.state !== 'recording' && this._status.state !== 'paused') {
      return { ok: false, error: `Cannot stop: session is ${this._status.state}` }
    }

    // Stopping while paused: fold the still-open pause interval into pausedElapsedMs
    // before we compute final duration below.
    if (this._status.state === 'paused') {
      this._pausedElapsedMs = this._status.pausedElapsedMs + (Date.now() - this._status.pausedAt)
    } else {
      this._pausedElapsedMs = this._status.pausedElapsedMs
    }

    const recordingStatus = this._status as Extract<RecordingStatus, { state: 'recording' | 'paused' }>
    const videoPath = join(this._outputDir, 'capture.mov')
    const cursorPath = join(this._outputDir, 'cursor.json')

    this.setState({ state: 'processing', videoPath })

    // Stop processes. capture.stop() resolves only when the binary has exited —
    // meaning writer.finish() completed and the moov atom is on disk. The old
    // fixed 1.5s sleep raced the encoder flush on big Retina captures and ffmpeg
    // would hit "moov atom not found" reading a half-finalized file.
    this.cursor.stop()
    await this.capture.stop()

    // Sprint 20 US-159 — rebase cursor.json onto the captured frame's own
    // pixel grid before anything else reads it (manifest build below, and
    // eventually the renderer's cursor:read IPC call).
    rebaseCursorEvents(
      cursorPath,
      this._captureOriginX,
      this._captureOriginY,
      this._capturePointsToPixels,
      this._captureWidth || 1920,
      this._captureHeight || 1080
    )

    // Webcam recording lives in a separate window and saves its blob asynchronously
    // after receiving the 'processing' broadcast — poll briefly for it to land.
    if (this._expectWebcam && !this._webcamPath) {
      const deadline = Date.now() + 4000
      while (!this._webcamPath && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 150))
      }
    }

    // Mux mic audio into the video file so preview playback (and export) has sound
    const hasMic = !!(this._micPath && existsSync(this._micPath))
    let muxedAudio = this._opts?.captureAudio ?? false
    if (hasMic) {
      // Keep a pre-mux copy of the system-audio track as a sidecar — export-time
      // ducking (Sprint 11) needs mic and system as separate streams, which the
      // muxed capture.mov can't provide.
      if (muxedAudio) {
        try {
          await ffmpeg.run(['-i', videoPath, '-map', '0:a', '-c', 'copy', join(this._outputDir, 'system.m4a')], 0, () => {})
        } catch (err) {
          console.warn('system audio sidecar extraction failed (non-fatal):', err)
        }
      }
      try {
        await this.muxMicIntoVideo(videoPath, this._micPath, muxedAudio, this._micLeadMs)
        muxedAudio = true
      } catch (err) {
        console.error('mux mic audio failed (non-fatal):', err)
      }
    }

    const duration = (Date.now() - this._startedAt - this._pausedElapsedMs) / 1000

    // Resolve actual capture dimensions. Prefer the size reported by the capture binary's
    // 'display' event, since in window mode it's the cropped window size, not the full display.
    let displayW = this._captureWidth || 1920
    let displayH = this._captureHeight || 1080
    if (!this._captureWidth && this._opts?.displayId) {
      const allDisplays = screen.getAllDisplays()
      const display = allDisplays.find(d => d.id === this._opts!.displayId)
      if (display) {
        displayW = Math.round(display.bounds.width * display.scaleFactor)
        displayH = Math.round(display.bounds.height * display.scaleFactor)
      }
    }

    const manifest: SessionManifest = {
      id: this._sessionId,
      version: 1,
      createdAt: this._startedAt,
      updatedAt: Date.now(),
      videoPath,
      cursorPath: existsSync(cursorPath) ? cursorPath : '',
      // Mic audio is muxed directly into videoPath above, so no separate audioPath is needed
      hasSystemAudio: muxedAudio,
      webcamPath: this._webcamPath && existsSync(this._webcamPath) ? this._webcamPath : undefined,
      displayId: recordingStatus.displayId,
      displayBounds: { x: 0, y: 0, width: displayW, height: displayH },
      fps: this._opts?.fps ?? 60,
      hdr: !!this._opts?.hdr,
      duration,
      width: displayW,
      height: displayH,
      cursorHidden: !!this._opts?.hideCursor && existsSync(cursorPath)
    }

    this._manifest = manifest
    this.setState({ state: 'done', manifest })
    return { ok: true, manifest }
  }

  saveMicAudio(data: Buffer, leadMs: number = 0): void {
    if (!this._outputDir) return
    this._micPath = join(this._outputDir, 'mic.webm')
    this._micLeadMs = leadMs
    writeFileSync(this._micPath, data)
    console.log(`[mic] saved ${data.length} bytes → ${this._micPath} (lead: ${leadMs}ms)`)
  }

  saveWebcamVideo(data: Buffer): void {
    if (!this._outputDir) return
    this._webcamPath = join(this._outputDir, 'webcam.webm')
    writeFileSync(this._webcamPath, data)
    console.log(`[webcam] saved ${data.length} bytes → ${this._webcamPath}`)
  }

  /**
   * Muxes mic.webm into the video file in-place, mixing with system audio if present.
   * leadMs trims the head of the mic track to compensate for the mic MediaRecorder
   * starting before the Swift capture binary actually begins writing video frames.
   */
  private async muxMicIntoVideo(videoPath: string, micPath: string, hasSystemAudio: boolean, leadMs: number = 0): Promise<void> {
    const tmpPath = videoPath.replace(/\.mov$/, '.muxed.mov')
    const args = ['-i', videoPath]
    if (leadMs > 0) args.push('-ss', (leadMs / 1000).toFixed(3))
    args.push('-i', micPath)
    const filter = hasSystemAudio
      ? '[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[sys];' +
        '[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[mic];' +
        '[sys][mic]amix=inputs=2:duration=longest:normalize=0[aud]'
      : '[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aud]'

    args.push(
      '-filter_complex', filter,
      '-map', '0:v',
      '-map', '[aud]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '256k',
      tmpPath
    )

    await ffmpeg.run(args, 0, () => {})
    unlinkSync(videoPath)
    renameSync(tmpPath, videoPath)
  }

  /** Sprint 29 BUG-01 — this used to call `this.capture.stop()` without
   *  awaiting it, then immediately set state to 'idle'. `CaptureProcess.stop()`
   *  only resolves once the Swift binary has actually exited (SIGTERM, up to
   *  a 10s SIGKILL fallback) — not awaiting it here let RECORDING_START's
   *  handler proceed straight into `session.start()` while the old process
   *  was still tearing down, and `CaptureProcess.start()` throws
   *  "already running" if `this.proc` isn't null yet. Now async + awaited by
   *  every caller (see recording-handlers.ts's RECORDING_START), so a new
   *  start always begins from a session whose capture process has genuinely
   *  exited. */
  async reset(): Promise<void> {
    if (this.capture.isRunning) await this.capture.stop()
    if (this.cursor.isRunning) this.cursor.stop()
    this._status = { state: 'idle' }
    this._manifest = null
    this._sessionId = ''
    this._micPath = ''
    this._micLeadMs = 0
    this._webcamPath = ''
    this._expectWebcam = false
    this._captureWidth = 0
    this._captureHeight = 0
    this._captureOriginX = 0
    this._captureOriginY = 0
    this._capturePointsToPixels = 1
    this._pausedElapsedMs = 0
  }
}

export const session = new RecordingSession()
