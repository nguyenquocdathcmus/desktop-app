// All IPC channel types — single source of truth for main <-> renderer communication
import type { ZoomEvent, SessionManifest, ProjectState, BackgroundSource, WebcamSettings, DeviceFrame } from './project-types'

export type RecordingStatus =
  | { state: 'idle' }
  | { state: 'ready'; displayId: number }
  | { state: 'recording'; startedAt: number; displayId: number; windowId?: number; pausedElapsedMs: number }
  | { state: 'paused'; startedAt: number; displayId: number; windowId?: number; pausedElapsedMs: number; pausedAt: number }
  | { state: 'processing'; videoPath: string }
  | { state: 'done'; manifest: SessionManifest }
  | { state: 'error'; code: string; message: string }

export interface StartOptions {
  displayId: number
  windowId?: number
  /** Sprint 25 US-189 — 90/120 only make sense on a ProMotion-class display;
   *  RecordingControls only offers them when the selected display's real
   *  refreshRate (DisplayInfo) supports it. */
  fps: 30 | 60 | 90 | 120
  captureAudio: boolean
  micDeviceId?: string
  webcamEnabled?: boolean
  maxHeight?: number
  outputDir: string
  /** Set by the main process when Accessibility is granted (cursor tracking
   *  works) — capture skips the system cursor and the editor draws it instead. */
  hideCursor?: boolean
  /** Sprint 25 US-190 — opt-in 10-bit HDR capture. Only offered in the UI
   *  when the selected display actually reports HDR support. */
  hdr?: boolean
}

export interface WindowInfo {
  id: number
  title: string
  appName: string
  bundleId: string
  width: number
  height: number
}

export type ExportCodec = 'h264' | 'h265'
export type ExportQuality = 'low' | 'balanced' | 'high' | 'lossless'

export interface ExportOptions {
  projectPath: string
  outputPath: string
  format: 'mp4' | 'gif'
  resolution: ExportResolution
  fps: 24 | 30 | 60 | 90 | 120
  background: BackgroundSource
  padding: number
  cornerRadius: number
  inPoint?: number
  outPoint?: number
  /** Full source video duration (seconds) — used to compute export ETA when
   *  inPoint/outPoint aren't set (i.e. exporting the whole recording). */
  sourceDuration?: number
  /** Kept regions of the source video, in source-video seconds, ordered and
   *  non-overlapping. When there are 2+ segments, the exporter splices them
   *  together (trim+concat) before applying zoom/background/etc. When there's
   *  0 or 1, inPoint/outPoint are used instead (single continuous trim). */
  segments?: { start: number; end: number; speed?: number }[]
  /** Sprint 9 — timed text overlays, rendered via drawtext */
  annotations?: { text: string; startTime: number; endTime: number; x: number; y: number; style: 'heading' | 'pill' | 'plain'; color: string }[]
  /** Sprint 9 — keyboard shortcut badges ({ t: source-seconds, display: '⌘⇧5' }) */
  keystrokes?: { t: number; display: string }[]
  /** Sprint 9 — output aspect. Default 16:9 (canvas = resolution as-is). */
  aspectRatio?: '16:9' | '9:16' | '1:1'
  /** Sprint 9 — apply afftdn noise reduction to the mic/audio chain */
  denoiseMic?: boolean
  /** Sprint 15 — chapter markers, muxed into the output MP4's chapter metadata
   *  track (re-mapped to conceptual/output time like every other timed event). */
  chapters?: { t: number; title: string }[]
  /** Sprint 19 — redaction regions, normalized 0-1 in output-frame space
   *  (same basis as annotations). Applied via crop+boxblur+overlay. */
  blurRegions?: { startTime: number; endTime: number; x: number; y: number; width: number; height: number; intensity: number }[]
  /** Sprint 10 — synthetic cursor: smoothed, downsampled cursor path (normalized
   *  0-1 coords, source-video seconds), prepared by the renderer from cursor.json.
   *  Only sent when the capture was cursor-less (manifest.cursorHidden). */
  cursorPath?: { t: number; x: number; y: number }[]
  cursorScale?: number
  sourceWidth?: number
  sourceHeight?: number
  /** Sprint 10 — mix a click sound at each mouse click event */
  clickSounds?: boolean
  clickTimes?: number[]
  /** Sprint 11 — camera layout scenes */
  scenes?: { startTime: number; endTime: number; layout: 'screen-only' | 'pip' | 'camera-full' | 'side-by-side' | 'title-card'; text?: string }[]
  /** Sprint 11 — audio mixer (1 = 100%) + ducking */
  micVolume?: number
  systemVolume?: number
  duckSystem?: boolean
  /** Separate system-audio sidecar (system.m4a), required for ducking */
  systemAudioPath?: string
  /** Sprint 11 — webcam auto-framing crop path (normalized center per time) */
  faceCropPath?: { t: number; cx: number; cy: number }[]
  micAudioPath?: string
  hasSystemAudio?: boolean
  webcamPath?: string
  webcam?: WebcamSettings
  deviceFrame?: DeviceFrame
  zoomEvents?: ZoomEvent[]
  cursorHighlight?: {
    enabled: boolean
    color: string
    radius: number
    opacity: number
  }
  /** MP4 only — ignored for gif. Defaults to h264/balanced when omitted. */
  codec?: ExportCodec
  quality?: ExportQuality
  audioBitrate?: 128 | 192 | 256
  /** Sprint 25 US-191 — only meaningful when the source (SessionManifest.hdr)
   *  is actually HDR; forces HEVC Main10 (10-bit) output with BT.2020/PQ color
   *  tags instead of the default 8-bit yuv420p. Off by default even for an
   *  HDR source — an HDR file played on a non-HDR display/player looks washed
   *  out, so this must always be an explicit choice, never automatic. */
  preserveHdr?: boolean
}

export interface ExportResolution {
  width: number
  height: number
  label: string
}

export type MainToRenderer =
  | { channel: 'recording:status'; payload: RecordingStatus }
  | { channel: 'export:progress'; payload: { percent: number; eta?: number } }
  | { channel: 'export:done'; payload: { outputPath: string } }
  | { channel: 'export:error'; payload: { message: string } }
  | { channel: 'app:open-project'; payload: { projectPath: string } }

export type RendererToMain =
  | { channel: 'recording:get-displays' }
  | { channel: 'recording:start'; payload: StartOptions }
  | { channel: 'recording:stop' }
  | { channel: 'recording:pause' }
  | { channel: 'recording:resume' }
  | { channel: 'recording:get-status' }
  | { channel: 'export:start'; payload: ExportOptions }
  | { channel: 'export:cancel' }
  | { channel: 'project:save'; payload: { projectPath: string; state: ProjectState } }
  | { channel: 'project:open'; payload: { projectPath: string } }
  | { channel: 'project:get-recent' }
  | { channel: 'ping' }

export interface DisplayInfo {
  id: number
  name: string
  width: number
  height: number
  scaleFactor: number
  isPrimary: boolean
  /** Position in the global desktop coordinate space (Sprint 20 US-161) —
   *  used to draw a real spatial layout picker instead of a flat list. Can
   *  be negative (a display positioned left of or above the main display). */
  x: number
  y: number
  /** Sprint 25 US-189 — the display's real refresh rate (Hz), used to gate
   *  which fps options make sense to offer (e.g. 120fps only on ProMotion
   *  displays that actually run at 120Hz — offering it elsewhere just wastes
   *  disk with duplicated frames since ScreenCaptureKit can't exceed the
   *  display's own refresh rate no matter what fps is requested). */
  refreshRate: number
  /** Sprint 25 US-190 — heuristic from Electron's Display.depthPerComponent
   *  (10-bit-per-component displays, e.g. Liquid Retina XDR, report 10; standard
   *  SDR displays report 8) — the closest signal Electron exposes to "is this
   *  an HDR-capable panel" without a native module. Verified against a real
   *  Liquid Retina XDR display during Sprint 25 (see test/RESULTS). */
  supportsHDR: boolean
}

export interface IpcInvokeMap {
  'recording:get-displays': DisplayInfo[]
  'recording:start': { ok: true } | { ok: false; error: string }
  'recording:stop': { ok: true; manifest: SessionManifest } | { ok: false; error: string }
  'recording:pause': { ok: true } | { ok: false; error: string }
  'recording:resume': { ok: true } | { ok: false; error: string }
  'recording:get-status': RecordingStatus
  'project:open': ProjectState | null
  'project:save': { ok: boolean }
  'project:get-recent': string[]
  'ping': 'pong'
}

export type { SessionManifest, ProjectState, BackgroundSource }
