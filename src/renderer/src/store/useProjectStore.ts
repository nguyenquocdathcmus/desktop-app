import { create } from 'zustand'
import { useEntitlementsStore } from './useEntitlementsStore'
import { useToastStore } from './useToastStore'
import { immer } from 'zustand/middleware/immer'
import type { ProjectState, BackgroundSource, ZoomEvent, CursorSettings, CursorEvent, DeviceFrame, WebcamSettings, TrimSegment, Annotation, CameraScene, Chapter, ReviewComment, BlurRegion } from '../../../shared/project-types'
import { DEFAULT_PROJECT_STATE } from '../../../shared/project-types'
import { generateZoomEvents } from '../effects/ZoomPathGenerator'
import { trackEvent } from '../analytics'

export interface SilenceRegionUI {
  start: number
  end: number
  selected: boolean
}

/** Sprint 24 US-183/184 — one recognized word with its source-video timestamp.
 *  Not persisted in ProjectState (regenerated on demand from the audio track
 *  and cached on disk by the main process), same treatment as SilenceRegionUI. */
export interface TranscriptWord {
  word: string
  startTime: number
  endTime: number
  confidence: number
}

/** Sprint 24 US-186 — filler words flagged for one-click bulk removal.
 *  English-only for now; extend per-locale if/when non-English transcription
 *  is exercised for real (see swift/transcriber's --locale flag). */
const FILLER_WORDS = new Set([
  'um', 'uh', 'umm', 'uhh', 'erm', 'hm', 'hmm', 'like', 'youknow'
])

export function isFillerWord(word: string): boolean {
  return FILLER_WORDS.has(word.toLowerCase().replace(/[.,!?]/g, ''))
}

let segmentIdCounter = 0
function newSegmentId(): string {
  return `seg-${Date.now()}-${segmentIdCounter++}`
}

/**
 * Ensures `project.segments` is populated, migrating from the legacy single
 * inPoint/outPoint trim if this project predates Sprint 8's multi-clip editing.
 * Safe to call on every load — no-ops if segments already exist.
 */
export function migrateProjectState(state: ProjectState): ProjectState {
  if (state.segments && state.segments.length > 0) return state
  const start = state.inPoint ?? 0
  const end = state.outPoint && state.outPoint > start ? state.outPoint : state.manifest.duration
  return { ...state, segments: [{ id: newSegmentId(), start, end }] }
}

// ── Templates (Sprint 15 US-124) ────────────────────────────────────────────
//
// Unlike a style preset (Sprint 10, which only captures background/padding/
// cursor/frame), a template captures EDIT STRUCTURE too: segments, zoom
// events, annotations, and scenes. Because the video a template gets applied
// to almost never has the exact same duration as the one it was captured
// from, every timestamp is stored as a fraction of the source duration
// (0-1) and re-expanded against the new recording's actual duration when
// applied — copying absolute timestamps would silently misplace everything
// on a video even a few seconds shorter or longer.

interface FractionalSegment { start: number; end: number; speed?: number }
interface FractionalZoomEvent extends Omit<ZoomEvent, 'startTime' | 'endTime'> { startTime: number; endTime: number }
interface FractionalAnnotation extends Omit<Annotation, 'startTime' | 'endTime'> { startTime: number; endTime: number }
interface FractionalScene extends Omit<CameraScene, 'startTime' | 'endTime'> { startTime: number; endTime: number }

export interface ProjectTemplate {
  background: BackgroundSource
  padding: number
  cornerRadius: number
  deviceFrame: DeviceFrame
  cursorSettings: CursorSettings
  segments: FractionalSegment[]
  zoomEvents: FractionalZoomEvent[]
  annotations: FractionalAnnotation[]
  scenes: FractionalScene[]
}

/** Captures a project's edit structure as a template, converting every
 *  timestamp to a 0-1 fraction of the source video's duration. */
export function captureTemplate(project: ProjectState): ProjectTemplate {
  const dur = Math.max(0.001, project.manifest.duration)
  const frac = (t: number) => t / dur
  return {
    background: project.background,
    padding: project.padding,
    cornerRadius: project.cornerRadius,
    deviceFrame: project.deviceFrame,
    cursorSettings: project.cursorSettings,
    segments: project.segments.map((s) => ({ start: frac(s.start), end: frac(s.end), speed: s.speed })),
    zoomEvents: (project.zoomEvents ?? []).map((e) => ({ ...e, startTime: frac(e.startTime), endTime: frac(e.endTime) })),
    annotations: (project.annotations ?? []).map((a) => ({ ...a, startTime: frac(a.startTime), endTime: frac(a.endTime) })),
    scenes: (project.scenes ?? []).map((s) => ({ ...s, startTime: frac(s.startTime), endTime: frac(s.endTime) }))
  }
}

/** Applies a template's structure onto a project, expanding every fractional
 *  timestamp against the target project's real duration. IDs are regenerated
 *  so applying the same template twice doesn't collide. */
export function applyTemplate(project: ProjectState, template: ProjectTemplate): ProjectState {
  const dur = project.manifest.duration
  const expand = (f: number) => Math.max(0, Math.min(dur, f * dur))
  return {
    ...project,
    background: template.background,
    padding: template.padding,
    cornerRadius: template.cornerRadius,
    deviceFrame: template.deviceFrame,
    cursorSettings: template.cursorSettings,
    segments: template.segments.map((s) => ({ id: newSegmentId(), start: expand(s.start), end: expand(s.end), speed: s.speed })),
    zoomEvents: template.zoomEvents.map((e) => ({ ...e, id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startTime: expand(e.startTime), endTime: expand(e.endTime) })),
    annotations: template.annotations.map((a) => ({ ...a, id: `anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startTime: expand(a.startTime), endTime: expand(a.endTime) })),
    scenes: template.scenes.map((s) => ({ ...s, id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, startTime: expand(s.startTime), endTime: expand(s.endTime) }))
  }
}

const AUTOSAVE_DEBOUNCE_MS = 2000
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

// Undo/redo history — snapshots of `project` taken after each edit, debounced so a
// dragged slider collapses into a single undo step instead of one per pixel.
const HISTORY_DEBOUNCE_MS = 400
const HISTORY_LIMIT = 50

/** Sprint 30 follow-up — editor effects that are Pro-only. Synchronous check
 *  against the entitlements mirror + upsell toast; main strips these from
 *  the export payload regardless, so this is UX, not security. */
function requirePro(flag: keyof ReturnType<typeof useEntitlementsStore.getState>['limits'], label: string): boolean {
  const { limits } = useEntitlementsStore.getState()
  if (limits[flag]) return true
  useToastStore.getState().push({ kind: 'info', message: `${label} là tính năng Pro — nâng cấp trong panel Tài khoản để dùng.` })
  return false
}

let historyTimer: ReturnType<typeof setTimeout> | null = null
let past: ProjectState[] = []
let future: ProjectState[] = []
let isTimeTraveling = false
let lastSnapshot: ProjectState | null = null

interface ProjectStore {
  project: ProjectState | null
  isDirty: boolean
  projectPath: string | null
  cursorEvents: CursorEvent[]        // raw cursor events for preview overlay
  autoZoomEnabled: boolean
  canUndo: boolean
  canRedo: boolean

  // Project lifecycle
  openProject: (path: string) => Promise<void>
  saveProject: () => Promise<void>
  closeProject: () => void
  newProjectFromManifest: (manifest: ProjectState['manifest']) => Promise<void>

  // Settings mutations
  setBackground: (bg: BackgroundSource) => void
  setPadding: (px: number) => void
  setCornerRadius: (px: number) => void
  setInPoint: (t: number) => void
  setOutPoint: (t: number) => void
  splitSegmentAt: (time: number) => void
  removeSegment: (id: string) => void
  setSegmentSpeed: (id: string, speed: number) => void
  setCursorSettings: (settings: Partial<CursorSettings>) => void

  // Silence detection (Sprint 9)
  silenceRegions: SilenceRegionUI[]
  detectingSilence: boolean
  detectSilences: () => Promise<void>
  toggleSilenceRegion: (index: number) => void
  applyRemoveSilences: () => void

  // Annotations (Sprint 9)
  addAnnotation: (a: Annotation) => void
  updateAnnotation: (id: string, changes: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void

  // Camera scenes (Sprint 11)
  addScene: (s: CameraScene) => void
  updateScene: (id: string, changes: Partial<CameraScene>) => void
  removeScene: (id: string) => void
  addZoomEvent: (event: ZoomEvent) => void
  updateZoomEvent: (id: string, changes: Partial<ZoomEvent>) => void
  removeZoomEvent: (id: string) => void
  regenerateZoom: () => Promise<void>
  setAutoZoomEnabled: (enabled: boolean) => void
  setDeviceFrame: (frame: DeviceFrame) => void
  setWebcam: (settings: Partial<WebcamSettings>) => void

  // History
  undo: () => void
  redo: () => void

  // Chapters (Sprint 15)
  addChapter: (c: Chapter) => void
  updateChapter: (id: string, changes: Partial<Chapter>) => void
  removeChapter: (id: string) => void

  // Review comments — local-only, never exported (Sprint 15)
  addReviewComment: (c: ReviewComment) => void
  updateReviewComment: (id: string, changes: Partial<ReviewComment>) => void
  removeReviewComment: (id: string) => void

  // Templates (Sprint 15)
  applyProjectTemplate: (template: ProjectTemplate) => void

  // Blur regions (Sprint 19)
  addBlurRegion: (b: BlurRegion) => void
  updateBlurRegion: (id: string, changes: Partial<BlurRegion>) => void
  removeBlurRegion: (id: string) => void

  // Transcript (Sprint 24 US-183/184/185)
  transcript: TranscriptWord[]
  generatingTranscript: boolean
  transcriptError: string | null
  generateTranscript: () => Promise<void>
  deleteTranscriptRange: (startTime: number, endTime: number) => void

  // Conflict detection (Sprint 26 US-198)
  saveConflict: boolean
  resolveSaveConflict: (choice: 'overwrite' | 'mergeComments' | 'discardMine') => Promise<void>
}

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => ({
    project: null,
    isDirty: false,
    projectPath: null,
    cursorEvents: [],
    autoZoomEnabled: true,
    canUndo: false,
    canRedo: false,

    openProject: async (path) => {
      const state = await window.api.openProject(path)
      if (state) {
        resetHistory()
        const migrated = migrateProjectState(state)
        set({ project: migrated, projectPath: path, isDirty: false, canUndo: false, canRedo: false })
        // Load cursor data for preview overlay
        if (state.manifest.cursorPath) {
          const cursorEvents = await window.api.readCursorData(state.manifest.cursorPath)
          set({ cursorEvents })
        }
      }
    },

    saveConflict: false,

    saveProject: async () => {
      const { project, projectPath } = get()
      if (!project || !projectPath) return
      const result = await window.api.saveProject(projectPath, project)
      if (result.conflict) {
        // Sprint 26 US-198 — don't overwrite; surface a resolution UI instead.
        // The in-memory project keeps the user's own edits untouched while
        // they decide (Cancel just leaves saveConflict true and they can
        // retry the resolution from the banner).
        set({ saveConflict: true })
        return
      }
      set({ isDirty: false })
    },

    resolveSaveConflict: async (choice) => {
      const { project, projectPath } = get()
      if (!project || !projectPath) return

      if (choice === 'discardMine') {
        // Reload whatever is on disk, discarding in-memory changes entirely.
        const onDisk = await window.api.peekProjectOnDisk(projectPath)
        if (onDisk) {
          resetHistory()
          set({ project: migrateProjectState(onDisk), isDirty: false, saveConflict: false })
        }
        return
      }

      if (choice === 'mergeComments') {
        // Sprint 26 — the sprint doc's recommended default: keep both sides'
        // review comments (the thing most likely to matter after an external
        // edit — someone else's feedback) rather than force a single winner.
        const onDisk = await window.api.peekProjectOnDisk(projectPath)
        const theirComments = onDisk?.reviewComments ?? []
        const mineIds = new Set((project.reviewComments ?? []).map((c) => c.id))
        const merged = [...(project.reviewComments ?? []), ...theirComments.filter((c) => !mineIds.has(c.id))]
        set((s) => { if (s.project) s.project.reviewComments = merged })
      }

      // 'overwrite' and 'mergeComments' both proceed to force-write the
      // (possibly comment-merged) in-memory project over what's on disk.
      const latest = get().project
      if (!latest) return
      await window.api.saveProject(projectPath, latest, true)
      set({ isDirty: false, saveConflict: false })
    },

    closeProject: () => {
      resetHistory()
      set({ project: null, projectPath: null, isDirty: false, cursorEvents: [], canUndo: false, canRedo: false })
    },

    newProjectFromManifest: async (manifest) => {
      // Default webcam overlay settings when this recording captured a webcam track
      const webcam = manifest.webcamPath
        ? {
            deviceId: '',
            position: 'bottom-right' as const,
            width: 240,
            height: 240,
            shape: 'circle' as const,
            faceTracking: false
          }
        : undefined

      // Default the project path to the recording's own folder so autosave has
      // somewhere to write immediately, without requiring an explicit "Save As".
      const defaultProjectPath = manifest.videoPath.replace(/\/capture\.mov$/, '')

      resetHistory()

      // Default style preset (Sprint 10) — applied on top of the built-in
      // defaults so every new recording starts with the user's house style.
      let presetOverrides: Partial<ProjectState> = {}
      try {
        const { presets, defaultName } = await window.api.listPresets()
        const def = defaultName ? presets.find((p) => p.name === defaultName) : null
        if (def) presetOverrides = def.state as Partial<ProjectState>
      } catch { /* presets are non-critical */ }

      // Always set project first so UI shows immediately even if cursor/zoom loading fails
      set({
        project: {
          manifest,
          ...DEFAULT_PROJECT_STATE,
          ...presetOverrides,
          zoomEvents: [],
          segments: [{ id: newSegmentId(), start: 0, end: manifest.duration }],
          webcam
        },
        isDirty: true,
        projectPath: defaultProjectPath,
        cursorEvents: [],
        canUndo: false,
        canRedo: false
      })

      // Load cursor data in background
      let cursorEvents: CursorEvent[] = []
      if (manifest.cursorPath) {
        try {
          cursorEvents = await window.api.readCursorData(manifest.cursorPath)
        } catch (e) {
          console.warn('[store] readCursorData failed:', e)
        }
      }

      // Generate zoom events
      let zoomEvents: ZoomEvent[] = []
      // Sprint 30 follow-up — auto zoom is Pro; skip generation silently on
      // Free (no upsell toast on every project open).
      const zoomEntitled = useEntitlementsStore.getState().limits.zoomAllowed
      if (zoomEntitled && cursorEvents.length > 2 && manifest.width > 0 && get().autoZoomEnabled) {
        try {
          zoomEvents = generateZoomEvents(
            cursorEvents,
            manifest.duration,
            manifest.width,
            manifest.height,
            manifest.createdAt
          )
        } catch (e) {
          console.warn('[store] generateZoomEvents failed:', e)
        }
      }

      // Update with cursor + zoom data
      set((s) => {
        if (s.project && s.project.manifest.id === manifest.id) {
          s.project.zoomEvents = zoomEvents
          s.cursorEvents = cursorEvents
        }
      })
    },

    setBackground: (bg) => set((s) => { if (s.project) { s.project.background = bg; s.isDirty = true } }),
    setPadding: (px) => set((s) => { if (s.project) { s.project.padding = px; s.isDirty = true } }),
    setCornerRadius: (px) => set((s) => { if (s.project) { s.project.cornerRadius = px; s.isDirty = true } }),

    // In/out trim handles operate on the first/last kept segment — the common
    // case of a single continuous clip. Multi-segment editing (split/delete) is
    // additive on top via splitSegmentAt/removeSegment below.
    setInPoint: (t) => set((s) => {
      if (!s.project || s.project.segments.length === 0) return
      s.project.segments[0].start = t
      s.isDirty = true
    }),
    setOutPoint: (t) => set((s) => {
      if (!s.project || s.project.segments.length === 0) return
      s.project.segments[s.project.segments.length - 1].end = t
      s.isDirty = true
    }),

    splitSegmentAt: (time) => set((s) => {
      if (!s.project) return
      const idx = s.project.segments.findIndex((seg) => time > seg.start + 0.05 && time < seg.end - 0.05)
      if (idx === -1) return
      const seg = s.project.segments[idx]
      const left: TrimSegment = { id: newSegmentId(), start: seg.start, end: time }
      const right: TrimSegment = { id: newSegmentId(), start: time, end: seg.end }
      s.project.segments.splice(idx, 1, left, right)
      s.isDirty = true
    }),

    removeSegment: (id) => set((s) => {
      if (!s.project || s.project.segments.length <= 1) return
      s.project.segments = s.project.segments.filter((seg) => seg.id !== id)
      s.isDirty = true
    }),

    setSegmentSpeed: (id, speed) => set((s) => {
      if (!s.project) return
      const seg = s.project.segments.find((x) => x.id === id)
      if (seg) { seg.speed = speed === 1 ? undefined : speed; s.isDirty = true }
    }),

    // ── Silence detection (Sprint 9) ──────────────────────────────────────────
    silenceRegions: [],
    detectingSilence: false,

    detectSilences: async () => {
      const { project } = get()
      if (!project) return
      set({ detectingSilence: true })
      try {
        const regions = await window.api.detectSilence(project.manifest.videoPath)
        set({ silenceRegions: regions.map((r) => ({ ...r, selected: true })) })
        trackEvent('feature_used_silence_detect', { regionCount: regions.length })
      } catch (e) {
        console.warn('[silence] detect failed:', e)
      } finally {
        set({ detectingSilence: false })
      }
    },

    toggleSilenceRegion: (index) => set((s) => {
      const r = s.silenceRegions[index]
      if (r) r.selected = !r.selected
    }),

    // Turns every selected silence region into a ripple-delete. Regions are
    // applied back-to-front so earlier splits don't invalidate later source
    // timestamps (segments always keep source-time). Shrinks each region by a
    // margin so speech onset isn't clipped.
    applyRemoveSilences: () => {
      const MARGIN = 0.15
      const { silenceRegions, splitSegmentAt, removeSegment } = get()
      const selected = silenceRegions
        .filter((r) => r.selected && r.end - r.start > MARGIN * 2 + 0.1)
        .sort((a, b) => b.start - a.start)

      for (const r of selected) {
        const cutStart = r.start + MARGIN
        const cutEnd = r.end - MARGIN
        splitSegmentAt(cutStart)
        splitSegmentAt(cutEnd)
        const seg = get().project?.segments.find(
          (x) => x.start >= cutStart - 0.01 && x.end <= cutEnd + 0.01
        )
        if (seg) removeSegment(seg.id)
      }
      set({ silenceRegions: [] })
    },

    // ── Transcript (Sprint 24) ───────────────────────────────────────────────
    transcript: [],
    generatingTranscript: false,
    transcriptError: null,

    generateTranscript: async () => {
      const { project } = get()
      if (!project) return
      set({ generatingTranscript: true, transcriptError: null })
      try {
        const result = await window.api.generateTranscript(project.manifest.videoPath)
        if (result.ok) {
          set({ transcript: result.words })
          trackEvent('feature_used_transcript_generate', { wordCount: result.words.length })
        } else {
          set({ transcriptError: result.error })
        }
      } catch (e) {
        set({ transcriptError: e instanceof Error ? e.message : String(e) })
      } finally {
        set({ generatingTranscript: false })
      }
    },

    // Sprint 24 US-185 — deleting a selected transcript range ripple-deletes
    // the matching video time range, reusing exactly the split/remove
    // sequence applyRemoveSilences() already established (Sprint 9) rather
    // than a new cutting mechanism.
    deleteTranscriptRange: (startTime, endTime) => {
      const { splitSegmentAt, removeSegment } = get()
      splitSegmentAt(startTime)
      splitSegmentAt(endTime)
      const seg = get().project?.segments.find(
        (x) => x.start >= startTime - 0.01 && x.end <= endTime + 0.01
      )
      if (seg) removeSegment(seg.id)
      set((s) => {
        s.transcript = s.transcript.filter((w) => w.endTime <= startTime || w.startTime >= endTime)
      })
    },

    // ── Annotations (Sprint 9) ────────────────────────────────────────────────
    addAnnotation: (a) => {
      if (!requirePro('annotationsAllowed', 'Chú thích văn bản')) return
      set((s) => {
      if (!s.project) return
      if (!s.project.annotations) s.project.annotations = []
      s.project.annotations.push(a)
      s.isDirty = true
      })
    },

    updateAnnotation: (id, changes) => set((s) => {
      const a = s.project?.annotations?.find((x) => x.id === id)
      if (a) { Object.assign(a, changes); s.isDirty = true }
    }),

    removeAnnotation: (id) => set((s) => {
      if (!s.project?.annotations) return
      s.project.annotations = s.project.annotations.filter((x) => x.id !== id)
      s.isDirty = true
    }),

    // ── Camera scenes (Sprint 11) ─────────────────────────────────────────────
    addScene: (sc) => {
      set((s) => {
        if (!s.project) return
        if (!s.project.scenes) s.project.scenes = []
        s.project.scenes.push(sc)
        s.project.scenes.sort((a, b) => a.startTime - b.startTime)
        s.isDirty = true
      })
      trackEvent('feature_used_scene_added', { layout: sc.layout })
    },

    updateScene: (id, changes) => set((s) => {
      const sc = s.project?.scenes?.find((x) => x.id === id)
      if (sc) { Object.assign(sc, changes); s.isDirty = true }
    }),

    removeScene: (id) => set((s) => {
      if (!s.project?.scenes) return
      s.project.scenes = s.project.scenes.filter((x) => x.id !== id)
      s.isDirty = true
    }),

    // ── Chapters (Sprint 15) ──────────────────────────────────────────────────
    addChapter: (c) => {
      if (!requirePro('chaptersAllowed', 'Chương (chapters)')) return
      set((s) => {
      if (!s.project) return
      if (!s.project.chapters) s.project.chapters = []
      s.project.chapters.push(c)
      s.project.chapters.sort((a, b) => a.t - b.t)
      s.isDirty = true
      })
    },

    updateChapter: (id, changes) => set((s) => {
      const c = s.project?.chapters?.find((x) => x.id === id)
      if (c) { Object.assign(c, changes); s.isDirty = true }
    }),

    removeChapter: (id) => set((s) => {
      if (!s.project?.chapters) return
      s.project.chapters = s.project.chapters.filter((x) => x.id !== id)
      s.isDirty = true
    }),

    // ── Review comments (Sprint 15) — local-only, never exported ───────────────
    addReviewComment: (c) => {
      if (!requirePro('notesAllowed', 'Ghi chú review')) return
      set((s) => {
      if (!s.project) return
      if (!s.project.reviewComments) s.project.reviewComments = []
      s.project.reviewComments.push(c)
      s.project.reviewComments.sort((a, b) => a.t - b.t)
      s.isDirty = true
      })
    },

    updateReviewComment: (id, changes) => set((s) => {
      const c = s.project?.reviewComments?.find((x) => x.id === id)
      if (c) { Object.assign(c, changes); s.isDirty = true }
    }),

    removeReviewComment: (id) => set((s) => {
      if (!s.project?.reviewComments) return
      s.project.reviewComments = s.project.reviewComments.filter((x) => x.id !== id)
      s.isDirty = true
    }),

    // ── Blur regions (Sprint 19) ────────────────────────────────────────────────
    addBlurRegion: (b) => {
      if (!requirePro('blurAllowed', 'Làm mờ vùng nhạy cảm')) return
      set((s) => {
      if (!s.project) return
      if (!s.project.blurRegions) s.project.blurRegions = []
      s.project.blurRegions.push(b)
      s.isDirty = true
      })
    },

    updateBlurRegion: (id, changes) => set((s) => {
      const b = s.project?.blurRegions?.find((x) => x.id === id)
      if (b) { Object.assign(b, changes); s.isDirty = true }
    }),

    removeBlurRegion: (id) => set((s) => {
      if (!s.project?.blurRegions) return
      s.project.blurRegions = s.project.blurRegions.filter((x) => x.id !== id)
      s.isDirty = true
    }),

    // ── Templates (Sprint 15) ───────────────────────────────────────────────────
    applyProjectTemplate: (template) => set((s) => {
      if (!s.project) return
      const next = applyTemplate(s.project, template)
      Object.assign(s.project, next)
      s.isDirty = true
    }),

    setCursorSettings: (settings) => set((s) => {
      if (s.project) { Object.assign(s.project.cursorSettings, settings); s.isDirty = true }
    }),

    addZoomEvent: (event) => {
      if (!requirePro('zoomAllowed', 'Zoom')) return
      set((s) => {
        if (s.project) { s.project.zoomEvents.push(event); s.isDirty = true }
      })
      if (!event.isAuto) trackEvent('feature_used_manual_zoom')
    },

    updateZoomEvent: (id, changes) => set((s) => {
      if (!s.project) return
      const idx = s.project.zoomEvents.findIndex((e) => e.id === id)
      if (idx !== -1) { Object.assign(s.project.zoomEvents[idx], changes); s.isDirty = true }
    }),

    removeZoomEvent: (id) => set((s) => {
      if (s.project) {
        s.project.zoomEvents = s.project.zoomEvents.filter((e) => e.id !== id)
        s.isDirty = true
      }
    }),

    regenerateZoom: async () => {
      if (!requirePro('zoomAllowed', 'Auto zoom')) return
      const { project, cursorEvents } = get()
      if (!project) return
      const { manifest } = project
      const zoomEvents = cursorEvents.length > 2 && manifest.width > 0
        ? generateZoomEvents(cursorEvents, manifest.duration, manifest.width, manifest.height, manifest.createdAt)
        : []
      set((s) => {
        if (s.project) { s.project.zoomEvents = zoomEvents; s.isDirty = true }
      })
    },

    setAutoZoomEnabled: (enabled) => set({ autoZoomEnabled: enabled }),
    setDeviceFrame: (frame) => set((s) => { if (s.project) { s.project.deviceFrame = frame; s.isDirty = true } }),

    setWebcam: (settings) => set((s) => {
      if (s.project && s.project.webcam) { Object.assign(s.project.webcam, settings); s.isDirty = true }
    }),

    undo: () => {
      const { project } = get()
      if (past.length === 0 || !project) return
      isTimeTraveling = true
      future.push(project)
      const previous = past.pop()!
      set({ project: previous, isDirty: true, canUndo: past.length > 0, canRedo: true })
      lastSnapshot = previous
      isTimeTraveling = false
    },

    redo: () => {
      const { project } = get()
      if (future.length === 0 || !project) return
      isTimeTraveling = true
      past.push(project)
      const next = future.pop()!
      set({ project: next, isDirty: true, canUndo: true, canRedo: future.length > 0 })
      lastSnapshot = next
      isTimeTraveling = false
    }
  }))
)

function resetHistory(): void {
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = null
  past = []
  future = []
  lastSnapshot = null
}

// Snapshot `project` into the undo stack shortly after each edit settles — debounced
// so continuous input (slider drags, timeline scrubbing) becomes one history entry.
useProjectStore.subscribe((state, prevState) => {
  if (isTimeTraveling) return
  if (!state.project || state.project === prevState.project) return

  if (lastSnapshot === null) {
    // First edit since a project was loaded/created — the pre-edit state becomes
    // the initial undo target, without a debounce delay.
    lastSnapshot = prevState.project ?? state.project
  }

  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    if (!lastSnapshot || lastSnapshot === state.project) return
    past.push(lastSnapshot)
    if (past.length > HISTORY_LIMIT) past.shift()
    future = []
    lastSnapshot = state.project
    useProjectStore.setState({ canUndo: true, canRedo: false })
  }, HISTORY_DEBOUNCE_MS)
})

// Debounced autosave — fires shortly after any edit marks the project dirty,
// so a crash or accidental quit mid-edit doesn't lose zoom/background/trim work.
useProjectStore.subscribe((state, prevState) => {
  if (!state.isDirty || state.project === prevState.project) return
  if (!state.project || !state.projectPath) return

  // Sprint 12 US-104: record the dirty path immediately (before the debounce
  // even fires) so a force-quit in the debounce window is still recoverable —
  // the main-process flag is cleared on the next successful save.
  window.api.markProjectDirty(state.projectPath)

  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    useProjectStore.getState().saveProject().catch((e) => console.warn('[autosave] failed:', e))
  }, AUTOSAVE_DEBOUNCE_MS)
})
