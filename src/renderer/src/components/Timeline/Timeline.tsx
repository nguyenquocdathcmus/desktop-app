import { useRef, useCallback, useEffect, useState } from 'react'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { useProjectStore } from '../../store/useProjectStore'
import { ZoomEventTrack } from './ZoomEventTrack'
import { AnnotationTrack } from './AnnotationTrack'
import { SceneTrack } from './SceneTrack'
import { ChapterTrack } from './ChapterTrack'
import { ReviewCommentTrack } from './ReviewCommentTrack'
import { BlurRegionTrack } from './BlurRegionTrack'
import { AudioWaveform } from './AudioWaveform'
import { useT } from '../../hooks/useT'
import { Hint } from '../Common/Hint'
import { formatChapterList } from '../../chapterListFormat'

const SPEED_CYCLE = [1, 1.5, 2, 4]

export function Timeline() {
  const t = useT()
  const { currentTime, duration, seek } = usePlaybackStore()
  const {
    project, setInPoint, setOutPoint, addZoomEvent, splitSegmentAt, removeSegment, setSegmentSpeed,
    silenceRegions, detectingSilence, detectSilences, toggleSilenceRegion, applyRemoveSilences,
    addAnnotation, addScene, addChapter, addReviewComment, addBlurRegion
  } = useProjectStore()
  const trackRef = useRef<HTMLDivElement>(null)

  const segments = project?.segments ?? []
  const inPoint = segments[0]?.start ?? 0
  const outPoint = segments[segments.length - 1]?.end ?? duration
  const hasWebcam = !!project?.manifest.webcamPath

  const timeToPercent = (t: number) => duration > 0 ? (t / duration) * 100 : 0
  const percentToTime = (pct: number) => (pct / 100) * duration

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      if (key === 's') {
        e.preventDefault()
        splitSegmentAt(currentTime)
        return
      }

      // Sprint 13 US-109 — Timeline keyboard nav: without this, scrubbing/setting
      // in-out points was mouse-only. Frame step uses the recording's real fps
      // (falls back to 30 if unknown) so ← / → moves exactly one frame.
      const fps = project?.manifest.fps || 30
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 1 / fps
        const delta = e.key === 'ArrowLeft' ? -step : step
        seek(Math.max(0, Math.min(duration, currentTime + delta)))
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        setInPoint(currentTime)
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        setOutPoint(currentTime)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentTime, duration, splitSegmentAt, seek, setInPoint, setOutPoint, project])

  // Click on track to seek
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    seek(percentToTime(Math.max(0, Math.min(100, pct))))
  }, [duration, seek])

  function handleAddZoom() {
    if (!project) return
    const clampedStart = Math.max(0, Math.min(currentTime, duration - 0.5))
    addZoomEvent({
      id: `manual-${Date.now()}`,
      startTime: clampedStart,
      endTime: Math.min(duration, clampedStart + 2),
      zoomLevel: 1.5,
      centerX: 0.5,
      centerY: 0.5,
      easing: 'spring',
      isAuto: false
    })
  }

  function handleAddAnnotation() {
    if (!project) return
    const start = Math.max(0, Math.min(currentTime, duration - 0.5))
    addAnnotation({
      id: `anno-${Date.now()}`,
      text: 'Text',
      startTime: start,
      endTime: Math.min(duration, start + 3),
      x: 0.5,
      y: 0.15,
      style: 'pill',
      color: '#ffffff'
    })
  }

  function handleAddScene() {
    if (!project) return
    const start = Math.max(0, Math.min(currentTime, duration - 0.5))
    addScene({
      id: `scene-${Date.now()}`,
      startTime: start,
      endTime: Math.min(duration, start + 3),
      layout: 'pip'
    })
  }

  function handleAddChapter() {
    if (!project) return
    addChapter({ id: `chapter-${Date.now()}`, t: currentTime, title: 'Chapter' })
  }

  function handleAddComment() {
    if (!project) return
    addReviewComment({ id: `comment-${Date.now()}`, t: currentTime, text: '' })
  }

  // Sprint 26 US-197 — brings comments added on the static review page (US-196)
  // back into the project; each import is additive (doesn't touch/replace
  // existing comments) since the reviewer's file only ever contains their
  // own new comments, never the full set.
  async function handleImportComments() {
    if (!project) return
    const result = await window.api.importCommentsJson()
    if (!result.ok || !result.comments) return
    for (const c of result.comments) {
      addReviewComment({ id: `comment-imported-${c.id}`, t: c.t, text: c.text, author: c.author })
    }
  }

  function handleAddBlur() {
    if (!project) return
    const start = Math.max(0, Math.min(currentTime, duration - 0.5))
    addBlurRegion({
      id: `blur-${Date.now()}`,
      startTime: start,
      endTime: Math.min(duration, start + 3),
      x: 0.35,
      y: 0.35,
      width: 0.3,
      height: 0.3,
      intensity: 20
    })
  }

  // Sprint 19 US-152 (simplified per doc's own alternative — no Swift capture
  // binary changes) — a full-duration blur region defaulted to the top-right
  // corner, where macOS notification banners appear. The user drags it to the
  // actual "safe zone" they want covered for the whole recording (system
  // tray, a specific app window, etc). Editable/removable exactly like any
  // other blur region afterward — nothing is baked in irreversibly.
  function handleAddSafeZoneBlur() {
    if (!project || duration <= 0) return
    addBlurRegion({
      id: `blur-safezone-${Date.now()}`,
      startTime: 0,
      endTime: duration,
      x: 0.7,
      y: 0.02,
      width: 0.28,
      height: 0.18,
      intensity: 20
    })
  }

  // Sprint 22 US-174 — frame-diff heuristic run on demand (never automatic).
  // Each candidate needs an explicit click to become a real blur region — the
  // heuristic is measured (see test/RESULTS/sprint-22-notification-heuristic.md)
  // but still experimental on real footage, so it only ever suggests.
  const [notificationCandidates, setNotificationCandidates] = useState<
    { startTime: number; endTime: number; x: number; y: number; width: number; height: number; confidence: number }[]
  >([])
  const [detectingNotifications, setDetectingNotifications] = useState(false)

  async function handleDetectNotifications() {
    if (!project?.manifest.videoPath) return
    setDetectingNotifications(true)
    setNotificationCandidates([])
    try {
      const candidates = await window.api.detectNotifications(project.manifest.videoPath)
      setNotificationCandidates(candidates)
    } finally {
      setDetectingNotifications(false)
    }
  }

  function handleAcceptNotificationCandidate(index: number) {
    const c = notificationCandidates[index]
    if (!c) return
    addBlurRegion({
      id: `blur-notif-${Date.now()}`,
      startTime: c.startTime,
      endTime: c.endTime,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      intensity: 20
    })
    setNotificationCandidates((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDismissNotificationCandidate(index: number) {
    setNotificationCandidates((prev) => prev.filter((_, i) => i !== index))
  }

  // Sprint 15 US-129 — chapter list as YouTube-description-ready text, built
  // from the exact same chapter data US-125 exports into the MP4 metadata.
  const [chaptersCopied, setChaptersCopied] = useState(false)
  function handleCopyChapterList() {
    if (!project?.chapters?.length) return
    navigator.clipboard.writeText(formatChapterList(project.chapters)).then(() => {
      setChaptersCopied(true)
      setTimeout(() => setChaptersCopied(false), 1500)
    })
  }

  if (!project) return null

  const selectedSilences = silenceRegions.filter((r) => r.selected).length

  return (
    <div className="flex flex-col bg-[var(--bg-primary)] border-t border-[var(--border)] shrink-0 px-4 py-3 gap-2">
      {/* Audio waveform (with silence regions highlighted) */}
      <AudioWaveform videoPath={project.manifest.videoPath} silenceRegions={silenceRegions} duration={duration} />

      <Hint id="silence-detection-exists" active={silenceRegions.length === 0 && !detectingSilence}>
        Tip: "{t('timeline.detectSilences')}" below scans the audio track and lets you ripple-delete quiet gaps in one click.
      </Hint>

      {/* Zoom event markers */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddZoom}
          title="Add a manual zoom keyframe at the playhead"
          className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[9px] font-medium leading-none flex items-center transition-colors"
        >
          {t('timeline.addZoom')}
        </button>
        <div className="flex-1 min-w-0">
          <ZoomEventTrack events={project.zoomEvents} duration={duration} />
        </div>
      </div>

      {/* Annotation track (Sprint 9) */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddAnnotation}
          title="Add a text annotation at the playhead"
          className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[9px] font-medium leading-none flex items-center transition-colors"
        >
          {t('timeline.addText')}
        </button>
        <div className="flex-1 min-w-0">
          <AnnotationTrack annotations={project.annotations ?? []} duration={duration} />
        </div>
      </div>

      {/* Camera scene track (Sprint 11) — only when this recording has a webcam */}
      {hasWebcam && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddScene}
              title="Add a camera layout scene at the playhead"
              className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[9px] font-medium leading-none flex items-center transition-colors"
            >
              {t('timeline.addScene')}
            </button>
            <div className="flex-1 min-w-0">
              <SceneTrack scenes={project.scenes ?? []} duration={duration} />
            </div>
          </div>
          <Hint id="scene-layout-cycle" active={(project.scenes?.length ?? 0) >= 1}>
            Tip: click a scene block above to cycle its camera layout (PIP → Camera → Split → Screen → Title).
          </Hint>
        </div>
      )}

      {/* Chapter markers (Sprint 15) */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddChapter}
          title="Add a chapter marker at the playhead"
          className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[9px] font-medium leading-none flex items-center transition-colors"
        >
          + Chapter
        </button>
        <div className="flex-1 min-w-0">
          <ChapterTrack chapters={project.chapters ?? []} duration={duration} />
        </div>
        {!!project.chapters?.length && (
          <button
            onClick={handleCopyChapterList}
            title="Copy chapter list — paste into a YouTube description"
            className="shrink-0 text-[9px] text-[var(--text-secondary)] hover:text-violet-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            {chaptersCopied ? 'Copied ✓' : 'Copy list'}
          </button>
        )}
      </div>

      {/* Review comments (Sprint 15) — local-only, never exported into video */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddComment}
          title="Leave a review note at the playhead — visible only in-app, never exported"
          className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[9px] font-medium leading-none flex items-center transition-colors"
        >
          + Note
        </button>
        <div className="flex-1 min-w-0">
          <ReviewCommentTrack comments={project.reviewComments ?? []} duration={duration} />
        </div>
        <button
          onClick={handleImportComments}
          title="Import comments exported from a shareable review page (Sprint 26)"
          className="shrink-0 text-[9px] text-[var(--text-secondary)] hover:text-amber-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          Import
        </button>
      </div>

      {/* Blur regions (Sprint 19) — redaction, applied in preview and export */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddBlur}
          title="Add a redaction (blur) region at the playhead"
          className="shrink-0 w-14 h-3 px-1.5 rounded-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[9px] font-medium leading-none flex items-center transition-colors"
        >
          + Blur
        </button>
        <div className="flex-1 min-w-0">
          <BlurRegionTrack regions={project.blurRegions ?? []} duration={duration} />
        </div>
        <button
          onClick={handleAddSafeZoneBlur}
          title="Add a blur region covering the whole recording, defaulted to the top-right corner where macOS notifications appear — drag it to whatever needs covering the entire time"
          className="shrink-0 text-[9px] text-[var(--text-secondary)] hover:text-rose-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          + Safe zone
        </button>
        <button
          onClick={handleDetectNotifications}
          disabled={detectingNotifications || !project.manifest.videoPath}
          title="Experimental: scan the recording for banner-shaped flashes in the top-right corner (macOS notification signature) and suggest blur regions to confirm"
          className="shrink-0 text-[9px] text-[var(--text-secondary)] hover:text-rose-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 disabled:opacity-40"
        >
          {detectingNotifications ? 'Scanning…' : 'Detect notifications'}
        </button>
      </div>

      {notificationCandidates.length > 0 && (
        <div className="flex flex-col gap-1 bg-rose-500/[0.06] border border-rose-500/20 rounded-md px-2 py-1.5">
          <span className="text-[9px] text-rose-300/80 font-medium">
            {notificationCandidates.length} possible notification{notificationCandidates.length > 1 ? 's' : ''} found — experimental, please confirm each
          </span>
          {notificationCandidates.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-[9px] text-[var(--text-primary)]">
              <span className="tabular-nums text-[var(--text-secondary)]">{c.startTime.toFixed(1)}s–{c.endTime.toFixed(1)}s</span>
              <span className="text-[var(--text-secondary)]">confidence {(c.confidence * 100).toFixed(0)}%</span>
              <button
                onClick={() => handleAcceptNotificationCandidate(i)}
                className="ml-auto px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
              >
                Blur this
              </button>
              <button
                onClick={() => handleDismissNotificationCandidate(i)}
                className="px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main scrub track */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-label="Playhead position"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${currentTime.toFixed(1)}s of ${duration.toFixed(1)}s. Use arrow keys to move, [ and ] to set in/out points, S to split.`}
        className="relative h-6 bg-[var(--bg-secondary)] rounded-lg overflow-visible cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        onClick={handleTrackClick}
      >
        {/* Silence regions (Sprint 9) — amber suggestions, click to toggle */}
        {silenceRegions.map((r, i) => (
          <div
            key={`${r.start}-${i}`}
            title={`Silence ${r.start.toFixed(1)}s–${r.end.toFixed(1)}s — click to ${r.selected ? 'keep' : 'remove'}`}
            onClick={(e) => { e.stopPropagation(); toggleSilenceRegion(i) }}
            className={`absolute top-0 h-full z-[5] cursor-pointer transition-colors ${
              r.selected ? 'bg-amber-500/40 hover:bg-amber-400/50' : 'bg-amber-500/10 hover:bg-amber-500/20'
            }`}
            style={{
              left: `${timeToPercent(r.start)}%`,
              width: `${Math.max(0.3, timeToPercent(r.end) - timeToPercent(r.start))}%`
            }}
          />
        ))}

        {/* Kept segments */}
        {segments.map((seg, i) => (
          <div
            key={seg.id}
            className="group/seg absolute top-0 h-full bg-indigo-500/20 border-x border-indigo-500/30 overflow-visible"
            style={{
              left: `${timeToPercent(seg.start)}%`,
              width: `${Math.max(0, timeToPercent(seg.end) - timeToPercent(seg.start))}%`
            }}
          >
            {segments.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); removeSegment(seg.id) }}
                title="Delete this segment"
                className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover/seg:opacity-100 transition-opacity z-20"
              >
                ✕
              </button>
            )}
            {/* Speed badge (Sprint 9) — click cycles 1× → 1.5× → 2× → 4× */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                const cur = seg.speed ?? 1
                const next = SPEED_CYCLE[(SPEED_CYCLE.indexOf(cur) + 1) % SPEED_CYCLE.length]
                setSegmentSpeed(seg.id, next)
              }}
              title="Segment speed — click to change"
              className={`absolute bottom-0.5 right-1 px-1 rounded text-[8px] font-bold leading-tight z-20 transition-colors ${
                (seg.speed ?? 1) !== 1
                  ? 'bg-amber-500 text-black opacity-100'
                  : 'bg-white/10 text-[var(--text-secondary)] opacity-0 group-hover/seg:opacity-100'
              }`}
            >
              {(seg.speed ?? 1)}×
            </button>
            {i < segments.length - 1 && (
              <div className="absolute top-0 bottom-0 right-0 w-px bg-[var(--bg-primary)] z-10" />
            )}
          </div>
        ))}

        {/* In/out handles */}
        <TrimHandle position={timeToPercent(inPoint)} onDrag={(pct) => setInPoint(percentToTime(pct))} label="In" side="left" />
        <TrimHandle position={timeToPercent(outPoint)} onDrag={(pct) => setOutPoint(percentToTime(pct))} label="Out" side="right" />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
          style={{ left: `${timeToPercent(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-sm" />
        </div>

        <TimeTicks duration={duration} />
      </div>

      {/* Bottom row: time + silence controls + split */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)]">
        <span>{formatTime(inPoint)}</span>

        <div className="flex items-center gap-2 font-sans">
          {/* Silence detection controls (Sprint 9) */}
          {silenceRegions.length === 0 ? (
            <button
              onClick={detectSilences}
              disabled={detectingSilence}
              title="Scan the audio track for silent gaps"
              className="font-medium text-[var(--text-secondary)] hover:text-amber-300 transition-colors px-2 py-0.5 rounded hover:bg-white/5 disabled:opacity-50"
            >
              {detectingSilence ? t('timeline.detecting') : `◌ ${t('timeline.detectSilences')}`}
            </button>
          ) : (
            <button
              onClick={applyRemoveSilences}
              disabled={selectedSilences === 0}
              title="Ripple-delete every selected silence region (undoable)"
              className="font-medium text-amber-300 hover:text-amber-200 transition-colors px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50"
            >
              Remove {selectedSilences} silence{selectedSilences !== 1 ? 's' : ''}
            </button>
          )}

          <button
            onClick={() => splitSegmentAt(currentTime)}
            title="Split the clip at the playhead (S)"
            className="font-medium text-[var(--text-secondary)] hover:text-indigo-300 transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          >
            ✂ {t('timeline.splitAt')} {formatTime(currentTime)}
          </button>
        </div>

        <span>{formatTime(outPoint)}</span>
      </div>
    </div>
  )
}

// --- Subcomponents ---

function TrimHandle({ position, onDrag, side }: {
  position: number
  onDrag: (pct: number) => void
  label: string
  side: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const parent = ref.current?.parentElement
    if (!parent) return

    const move = (ev: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      onDrag(Math.max(0, Math.min(100, pct)))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [onDrag])

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      className="absolute top-0 bottom-0 w-2 bg-indigo-500 cursor-ew-resize z-20 hover:bg-indigo-400 transition-colors"
      style={{ left: `${position}%`, transform: side === 'right' ? 'translateX(-100%)' : 'none' }}
    />
  )
}

function TimeTicks({ duration }: { duration: number }) {
  if (duration <= 0) return null
  const tickInterval = duration <= 10 ? 1 : duration <= 60 ? 5 : 30
  const ticks: number[] = []
  for (let t = tickInterval; t < duration; t += tickInterval) ticks.push(t)

  return (
    <>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 h-2 w-px bg-white/10 pointer-events-none"
          style={{ left: `${(t / duration) * 100}%` }}
        />
      ))}
    </>
  )
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
