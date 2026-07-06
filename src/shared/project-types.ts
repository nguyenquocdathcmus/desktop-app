export interface SessionManifest {
  id: string
  version: 1
  createdAt: number
  updatedAt: number
  videoPath: string
  cursorPath: string
  audioPath?: string
  hasSystemAudio: boolean
  webcamPath?: string
  displayId: number
  displayBounds: Rect
  fps: number
  duration: number
  width: number
  height: number
  /** True when the recording was captured with the system cursor hidden
   *  (Sprint 10 synthetic cursor) — the editor draws the cursor from cursor.json. */
  cursorHidden?: boolean
  /** Sprint 25 US-190/191 — true when captured in 10-bit HDR (HEVC Main10,
   *  BT.2020/PQ). Lets the Export modal default "Preserve HDR" on for this
   *  source and tells Exporter.ts to use 10-bit-safe filter output formats. */
  hdr?: boolean
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type DeviceFrame = 'none' | 'macbook' | 'browser' | 'iphone'

/** A kept region of the source video, in source-video seconds. Segments are
 *  ordered and non-overlapping; the timeline UI and export both walk this list
 *  in order to build the final, spliced-together output. */
export interface TrimSegment {
  id: string
  start: number
  end: number
  /** Playback/export speed multiplier for this segment (1 = normal). Optional so
   *  pre-Sprint-9 projects load unchanged. */
  speed?: number
}

/** Timed text overlay. Position is normalized 0-1 within the video frame;
 *  times are source-video seconds (same basis as ZoomEvent). */
export interface Annotation {
  id: string
  text: string
  startTime: number
  endTime: number
  x: number
  y: number
  style: 'heading' | 'pill' | 'plain'
  color: string
}

/** Chapter marker (Sprint 15) — an instantaneous point (not a range) in
 *  source-video seconds, exported into the MP4's chapter metadata track. */
export interface Chapter {
  id: string
  t: number
  title: string
}

/** Timed redaction region (Sprint 19 US-153) — the 5th timed range event,
 *  same shape family as ZoomEvent/Annotation/CameraScene. Position and size
 *  are normalized 0-1 within the video frame, same basis as Annotation, so
 *  it survives aspect-ratio/resolution changes at export the same way. */
export interface BlurRegion {
  id: string
  startTime: number
  endTime: number
  x: number
  y: number
  width: number
  height: number
  /** Blur strength — mapped to ffmpeg boxblur's luma_radius at export. */
  intensity: number
}

/** Local, non-exported review annotation (Sprint 15 US-128) — visible only
 *  inside the app when a `.recordscreen` project file is opened, never
 *  rendered into export output. Intended for "send the project + video to a
 *  colleague, they open it in-app and leave timestamped notes" — file-based
 *  collaboration, not a real-time/networked feature. */
export interface ReviewComment {
  id: string
  t: number
  text: string
  author?: string
  resolved?: boolean
}

export interface ProjectState {
  manifest: SessionManifest
  background: BackgroundSource
  padding: number
  cornerRadius: number
  zoomEvents: ZoomEvent[]
  /** @deprecated superseded by `segments` — kept optional so old saved projects
   *  (single in/out trim, no segments array) still load; migrated on open via
   *  migrateProjectState() in useProjectStore.ts. */
  inPoint?: number
  outPoint?: number
  /** Ordered, non-overlapping kept regions of the source video. Always present
   *  on projects created after the Sprint 8 multi-clip editing work. */
  segments: TrimSegment[]
  /** Timed text overlays (Sprint 9). Optional for backward compat. */
  annotations?: Annotation[]
  /** Camera layout scenes (Sprint 11). Optional for backward compat. */
  scenes?: CameraScene[]
  /** Chapter markers (Sprint 15). Optional for backward compat. */
  chapters?: Chapter[]
  /** Local-only review notes (Sprint 15). Never exported. */
  reviewComments?: ReviewComment[]
  /** Redaction regions (Sprint 19). Blurred in both preview and export. */
  blurRegions?: BlurRegion[]
  cursorSettings: CursorSettings
  webcam?: WebcamSettings
  deviceFrame: DeviceFrame
}

export type BackgroundSource =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; stops: GradientStop[]; angle: number }
  | { type: 'image'; path: string; fit: 'cover' | 'contain' | 'fill' }
  | { type: 'blur'; blurRadius: number; screenshotPath: string }
  | { type: 'wallpaper'; screenshotPath: string }

export interface GradientStop {
  color: string
  position: number
}

export interface ZoomEvent {
  id: string
  startTime: number
  endTime: number
  zoomLevel: number
  centerX: number
  centerY: number
  easing: 'spring' | 'ease-in-out' | 'linear'
  isAuto: boolean
}

export interface CursorSettings {
  visible: boolean
  highlight: boolean
  highlightColor: string
  highlightRadius: number
  highlightOpacity: number
  clickAnimation: boolean
  smooth: boolean
  smoothSamples: number
  /** Synthetic cursor scale (Sprint 10) — only meaningful when the recording was
   *  captured cursor-less (manifest.cursorHidden). 1 = native size. */
  size?: number
}

/** Camera layout scene (Sprint 11) — a timed window during which the webcam is
 *  laid out differently. Gaps between scenes fall back to the default PIP. */
export interface CameraScene {
  id: string
  startTime: number
  endTime: number
  layout: 'screen-only' | 'pip' | 'camera-full' | 'side-by-side' | 'title-card'
  /** Only for layout 'title-card' */
  text?: string
}

export interface WebcamSettings {
  deviceId: string
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom'
  customX?: number
  customY?: number
  width: number
  height: number
  shape: 'circle' | 'rounded-rect'
  faceTracking: boolean
  /** Sprint 11 polish — all optional for backward compat */
  mirror?: boolean
  ringColor?: string
  ringWidth?: number
  /** Sprint 19 US-157 — blurs the face-centered crop window (reuses the same
   *  face-detector samples as faceTracking) instead of following it with the
   *  camera. Independent of faceTracking; anonymizes without cropping. */
  faceBlur?: boolean
}

export interface CursorEvent {
  t: number
  x: number
  y: number
  type: 'move' | 'click' | 'keydown' | 'scroll'
  button?: 'left' | 'right' | 'middle'
  key?: string
  display?: string
  dx?: number
  dy?: number
}

export const DEFAULT_PROJECT_STATE: Omit<ProjectState, 'manifest'> = {
  background: { type: 'gradient', stops: [{ color: '#1a1a2e', position: 0 }, { color: '#16213e', position: 1 }], angle: 135 },
  padding: 60,
  cornerRadius: 12,
  zoomEvents: [],
  segments: [],
  deviceFrame: 'none',
  cursorSettings: {
    visible: true,
    highlight: true,
    highlightColor: '#FFD700',
    highlightRadius: 30,
    highlightOpacity: 0.35,
    clickAnimation: true,
    smooth: true,
    smoothSamples: 8
  }
}
