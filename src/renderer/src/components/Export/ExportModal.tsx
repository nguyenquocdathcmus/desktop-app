import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '../../store/useProjectStore'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { EXPORT_PRESETS, EXPORT_RESOLUTIONS } from '../../../../shared/constants'
import { smoothCursorEvents } from '../../effects/CursorSmoother'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useT } from '../../hooks/useT'
import type { ExportCodec, ExportQuality, ExportOptions } from '../../../../shared/ipc-types'
import { trackEvent } from '../../analytics'
import { PublishPanel } from './PublishPanel'

interface Props {
  open: boolean
  onClose: () => void
}

type Aspect = '16:9' | '9:16' | '1:1'

const QUALITY_LABELS: Record<ExportQuality, string> = {
  low: 'Low',
  balanced: 'Balanced',
  high: 'High',
  lossless: 'Lossless'
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export function ExportModal({ open, onClose }: Props) {
  const t = useT()
  const { project } = useProjectStore()
  const cursorEvents = useProjectStore((s) => s.cursorEvents)
  const { duration } = usePlaybackStore()
  const [format, setFormat] = useState<'mp4' | 'gif'>('mp4')
  const [resIdx, setResIdx] = useState(1) // 1080p default
  const [fps, setFps] = useState<24 | 30 | 60 | 90 | 120>(60)
  const [codec, setCodec] = useState<ExportCodec>('h264')
  const [quality, setQuality] = useState<ExportQuality>('balanced')
  // Sprint 25 US-191 — only offered when the source was captured in HDR
  // (SessionManifest.hdr); always defaults off even then, since an HDR file
  // played on a non-HDR display/player looks washed out unless the viewer's
  // setup actually supports it — must always be an explicit choice.
  const [preserveHdr, setPreserveHdr] = useState(false)
  const [aspect, setAspect] = useState<Aspect>('16:9')
  const [denoise, setDenoise] = useState(false)
  const [clickSounds, setClickSounds] = useState(false)
  const [micVolume, setMicVolume] = useState(100)
  const [systemVolume, setSystemVolume] = useState(100)
  const [duckSystem, setDuckSystem] = useState(false)
  const [canDuck, setCanDuck] = useState(false)
  const [alsoVertical, setAlsoVertical] = useState(false)
  const [alsoGif, setAlsoGif] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [eta, setEta] = useState<number | null>(null)
  const [targetInfo, setTargetInfo] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [perfWarningDismissed, setPerfWarningDismissed] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sprint 13 US-108 — keep Tab inside the modal, restore focus to whatever
  // opened it on close; Escape closes consistently with other overlays.
  useFocusTrap(modalRef, open)
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setPerfWarningDismissed(false)
      setCopied(false)
      // Sprint 18 US-148 — funnel signal: modal opened but export never
      // started (or started but never completed) shows up as a drop-off
      // between this event and export_started/export_completed.
      trackEvent('export_modal_opened')
    }
  }, [open])

  // Ducking needs separate mic + system sidecar files (Sprint 11) — probe once.
  useEffect(() => {
    if (!open || !project) return
    const dir = project.manifest.videoPath.replace(/capture\.mov$/, '')
    Promise.all([
      window.api.fileExists(`${dir}mic.webm`),
      window.api.fileExists(`${dir}system.m4a`)
    ]).then(([mic, sys]) => setCanDuck(mic && sys)).catch(() => setCanDuck(false))
  }, [open, project])

  useEffect(() => {
    if (!open) return
    const unsubProgress = window.api.onExportProgress(({ percent, eta: e }) => {
      setProgress(percent)
      setEta(e ?? null)
    })
    const unsubDone = window.api.onExportDone(({ outputPath }) => {
      setProgress(null)
      setEta(null)
      setDone(outputPath)
    })
    const unsubError = window.api.onExportError(({ message }) => {
      setProgress(null)
      setEta(null)
      setError(message)
    })
    return () => { unsubProgress(); unsubDone(); unsubError() }
  }, [open])

  const res = EXPORT_RESOLUTIONS[resIdx]

  const perfWarning = useMemo(() => {
    if (!project) return null
    const isLong = duration > 600
    const is4k = res.height >= 2160
    const overlappingZoomCount = project.zoomEvents.filter((e, i) =>
      project.zoomEvents.some((other, j) => j !== i && e.startTime < other.endTime && other.startTime < e.endTime)
    ).length

    if (is4k && isLong) return `Video 4K dài ${Math.round(duration / 60)} phút có thể mất nhiều thời gian export. Cân nhắc xuất ở 1080p.`
    if (overlappingZoomCount > 4) return `${overlappingZoomCount} zoom event chồng lấn nhau — có thể làm chậm export. Cân nhắc giảm bớt hoặc gộp lại trong Zoom panel.`
    if (isLong) return `Recording dài ${Math.round(duration / 60)} phút, export có thể mất vài phút.`
    return null
  }, [project, duration, res.height])

  if (!project) return null

  /** Builds the full export payload for one target. */
  function buildOptions(targetAspect: Aspect, targetFormat: 'mp4' | 'gif', outputPath: string): ExportOptions {
    const p = project!
    const manifest = p.manifest
    const segments = p.segments ?? []
    const inPoint = segments[0]?.start ?? 0
    const outPoint = segments[segments.length - 1]?.end || duration
    const originMs = manifest.createdAt
    const dir = manifest.videoPath.replace(/capture\.mov$/, '')

    // Synthetic cursor path (Sprint 10) — smoothed + downsampled to ~15Hz.
    let cursorPath: { t: number; x: number; y: number }[] | undefined
    if (manifest.cursorHidden && p.cursorSettings.visible && cursorEvents.length > 1 && manifest.width > 0) {
      const moves = smoothCursorEvents(
        cursorEvents.filter((e) => e.type === 'move' || e.type === 'click'),
        p.cursorSettings.smooth ? p.cursorSettings.smoothSamples : 1
      )
      const out: { t: number; x: number; y: number }[] = []
      let lastT = -Infinity
      for (const e of moves) {
        const t = (e.t - originMs) / 1000
        if (t < 0 || t - lastT < 1 / 15) continue
        lastT = t
        out.push({ t, x: e.x / manifest.width, y: e.y / manifest.height })
      }
      cursorPath = out
    }

    // Keystroke badges (Sprint 9) — modifier combos only, merged when <300ms apart.
    const keystrokes: { t: number; display: string }[] = []
    let lastKeyT = -Infinity
    for (const e of cursorEvents) {
      if (e.type !== 'keydown' || !e.display) continue
      if (!/[⌘⌃⌥]/.test(e.display)) continue
      const t = (e.t - originMs) / 1000
      if (t < 0 || t - lastKeyT < 0.3) continue
      lastKeyT = t
      keystrokes.push({ t, display: e.display })
    }

    // Click times for click sounds (Sprint 10).
    const clickTimes = clickSounds
      ? cursorEvents.filter((e) => e.type === 'click').map((e) => (e.t - originMs) / 1000).filter((t) => t >= 0)
      : undefined

    return {
      projectPath: manifest.videoPath,
      outputPath,
      format: targetFormat,
      resolution: { width: res.width, height: res.height, label: res.label },
      fps,
      codec: targetFormat === 'mp4' ? codec : undefined,
      quality: targetFormat === 'mp4' ? quality : undefined,
      preserveHdr: targetFormat === 'mp4' && preserveHdr,
      aspectRatio: targetAspect,
      background: p.background,
      padding: p.padding,
      cornerRadius: p.cornerRadius,
      inPoint: inPoint > 0 ? inPoint : undefined,
      outPoint: outPoint < duration - 0.1 ? outPoint : undefined,
      segments: segments.length >= 2 ? segments.map((s) => ({ start: s.start, end: s.end, speed: s.speed })) : undefined,
      sourceDuration: duration,
      sourceWidth: manifest.width || undefined,
      sourceHeight: manifest.height || undefined,
      annotations: p.annotations?.length ? p.annotations : undefined,
      keystrokes: keystrokes.length ? keystrokes.slice(0, 30) : undefined,
      scenes: p.scenes?.length ? p.scenes : undefined,
      chapters: p.chapters?.length ? p.chapters.map((c) => ({ t: c.t, title: c.title })) : undefined,
      blurRegions: p.blurRegions?.length ? p.blurRegions.map((b) => ({
        startTime: b.startTime, endTime: b.endTime, x: b.x, y: b.y, width: b.width, height: b.height, intensity: b.intensity
      })) : undefined,
      cursorPath,
      cursorScale: p.cursorSettings.size ?? 1,
      denoiseMic: denoise || undefined,
      clickSounds: clickSounds || undefined,
      clickTimes,
      micVolume: micVolume !== 100 ? micVolume / 100 : undefined,
      systemVolume: systemVolume !== 100 ? systemVolume / 100 : undefined,
      duckSystem: (duckSystem && canDuck) || undefined,
      systemAudioPath: duckSystem && canDuck ? `${dir}system.m4a` : undefined,
      micAudioPath: duckSystem && canDuck ? `${dir}mic.webm` : manifest.audioPath,
      hasSystemAudio: manifest.hasSystemAudio,
      webcamPath: manifest.webcamPath,
      webcam: p.webcam,
      deviceFrame: p.deviceFrame,
      zoomEvents: p.zoomEvents.length > 0 ? p.zoomEvents : undefined,
      cursorHighlight: p.cursorSettings.highlight ? {
        enabled: true,
        color: p.cursorSettings.highlightColor,
        radius: p.cursorSettings.highlightRadius,
        opacity: p.cursorSettings.highlightOpacity
      } : undefined
    }
  }

  async function handleExport() {
    if (!project) return
    setProgress(0)
    setDone(null)
    setError(null)
    setCopied(false)

    // Sprint 18 US-147 — export config, no PII (no file paths, no annotation
    // text, no video content — just the shape of what was chosen).
    trackEvent('export_started', {
      format,
      codec: format === 'mp4' ? codec : 'n/a',
      quality: format === 'mp4' ? quality : 'n/a',
      aspectRatio: aspect,
      segmentCount: project.segments.length,
      hadMultiSegment: project.segments.length > 1,
      hadSpeedRamp: project.segments.some((s) => (s.speed ?? 1) !== 1),
      hadWebcamScenes: (project.scenes?.length ?? 0) > 0,
      hadChapters: (project.chapters?.length ?? 0) > 0
    })

    const manifest = project.manifest
    const outputDir = manifest.videoPath.replace('capture.mov', '')
    const stamp = Date.now()

    // Face auto-framing path (Sprint 11) — resolved just-in-time so the cache
    // (face.cache.json) is warm from preview usage in most cases.
    let faceCropPath: { t: number; cx: number; cy: number }[] | undefined
    if (project.webcam?.faceTracking && manifest.webcamPath) {
      try {
        const samples = await window.api.detectFaces(manifest.webcamPath)
        if (samples.length > 0) faceCropPath = samples
      } catch { /* framing is best-effort */ }
    }

    // Batch targets (Sprint 10): primary + optional extras, run sequentially.
    const targets: { label: string; opts: ExportOptions }[] = []
    const ext = format === 'gif' ? 'gif' : 'mp4'
    targets.push({
      label: `${format.toUpperCase()} ${aspect}`,
      opts: { ...buildOptions(aspect, format, `${outputDir}export-${stamp}.${ext}`), faceCropPath }
    })
    if (format === 'mp4' && alsoVertical && aspect !== '9:16') {
      targets.push({
        label: 'MP4 9:16',
        opts: { ...buildOptions('9:16', 'mp4', `${outputDir}export-${stamp}-vertical.mp4`), faceCropPath }
      })
    }
    if (format === 'mp4' && alsoGif) {
      targets.push({
        label: 'GIF',
        opts: buildOptions(aspect, 'gif', `${outputDir}export-${stamp}.gif`)
      })
    }

    try {
      let lastOutput: string | null = null
      for (let i = 0; i < targets.length; i++) {
        setTargetInfo(targets.length > 1 ? `Target ${i + 1}/${targets.length} — ${targets[i].label}` : null)
        setProgress(0)
        const result = await window.api.startExport(targets[i].opts)
        if (!result.ok) {
          trackEvent('export_failed', { format, target: targets[i].label })
          setError(`${targets[i].label}: ${result.error}`)
          setProgress(null)
          setTargetInfo(null)
          return
        }
        lastOutput = result.outputPath
      }
      setTargetInfo(null)
      if (lastOutput) {
        trackEvent('export_completed', { format, targetCount: targets.length })
        setDone(lastOutput)
      }
    } catch (e) {
      trackEvent('export_failed', { format, error: 'exception' })
      setError(String(e))
      setProgress(null)
      setTargetInfo(null)
    }
  }

  async function handleCopyFile() {
    if (!done) return
    const r = await window.api.copyFileToClipboard(done)
    if (r.ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasMicTrack = !!project.manifest.hasSystemAudio || !!project.manifest.audioPath

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-modal-title"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl w-[520px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="export-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">{t('exportModal.title')}</h2>
              <button onClick={onClose} aria-label="Close export dialog" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">×</button>
            </div>

            {/* Social presets */}
            <div className="mb-4">
              <p className="label mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPORT_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      setFormat(p.format)
                      setFps(p.fps)
                      const idx = EXPORT_RESOLUTIONS.findIndex(r => r.width === p.width)
                      if (idx >= 0) setResIdx(idx)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Format + FPS */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="label mb-2">Format</p>
                <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
                  {(['mp4', 'gif'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium uppercase transition-colors ${format === f ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="label mb-2">FPS</p>
                <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
                  {/* Sprint 25 US-189 — 90/120 only shown when the source was
                      actually captured at a fps above 60 (SessionManifest.fps);
                      exporting higher than the source has no benefit. */}
                  {([24, 30, 60, 90, 120] as const)
                    .filter((f) => f <= 60 || (project?.manifest.fps ?? 60) >= f)
                    .map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${fps === f ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aspect ratio (Sprint 9) */}
            {format === 'mp4' && (
              <div className="mb-4">
                <p className="label mb-2">Aspect ratio</p>
                <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
                  {(['16:9', '9:16', '1:1'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAspect(a)}
                      title={a === '9:16' ? 'Vertical — TikTok / Shorts / Reels. Crop follows your zoom focus.' : a === '1:1' ? 'Square' : 'Widescreen'}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${aspect === a ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      {a === '16:9' ? '▭ 16:9' : a === '9:16' ? '▯ 9:16' : '□ 1:1'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution */}
            <div className="mb-4">
              <p className="label mb-2">Resolution</p>
              <div className="grid grid-cols-2 gap-1.5">
                {EXPORT_RESOLUTIONS.map((r, i) => (
                  <button
                    key={r.label}
                    onClick={() => setResIdx(i)}
                    className={`rounded-lg px-3 py-2 text-xs text-left transition-colors border ${resIdx === i ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border)]'}`}
                  >
                    <span className="font-medium">{r.label}</span>
                    <span className="block opacity-60">{r.width}×{r.height}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Codec + quality — MP4 only */}
            {format === 'mp4' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="label mb-2">Codec</p>
                  <div className="flex gap-1 bg-[var(--bg-primary)] rounded-lg p-1">
                    {(['h264', 'h265'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCodec(c)}
                        title={c === 'h265' ? 'HEVC — smaller files, hardware-accelerated on Apple Silicon' : 'H.264 — most compatible'}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium uppercase transition-colors ${codec === c ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                      >
                        {c === 'h264' ? 'H.264' : 'H.265'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label mb-2">Quality</p>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as ExportQuality)}
                    className="w-full h-[30px] rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] px-2"
                  >
                    {(Object.keys(QUALITY_LABELS) as ExportQuality[]).map((q) => (
                      <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Sprint 25 US-191 — only shown for a source actually captured in
                HDR; off by default even then (see preserveHdr comment above). */}
            {format === 'mp4' && project?.manifest.hdr && (
              <label className="flex items-center justify-between gap-2 mb-4 cursor-pointer">
                <div>
                  <p className="text-xs text-[var(--text-primary)]">Preserve HDR</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">10-bit HEVC — looks washed out on non-HDR displays/players</p>
                </div>
                <button
                  onClick={() => setPreserveHdr(!preserveHdr)}
                  role="switch"
                  aria-checked={preserveHdr}
                  className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${preserveHdr ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${preserveHdr ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </label>
            )}

            {/* Audio (Sprint 9/11): mixer, denoise, ducking, click sounds */}
            {format === 'mp4' && hasMicTrack && (
              <div className="mb-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 space-y-2.5">
                <p className="label">Audio</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[11px] text-[var(--text-secondary)]">
                    Mic volume — {micVolume}%
                    <input type="range" min={0} max={200} value={micVolume}
                      onChange={(e) => setMicVolume(Number(e.target.value))}
                      className="w-full accent-indigo-500" />
                  </label>
                  <label className="text-[11px] text-[var(--text-secondary)]">
                    System volume — {systemVolume}%
                    <input type="range" min={0} max={200} value={systemVolume}
                      onChange={(e) => setSystemVolume(Number(e.target.value))}
                      className="w-full accent-indigo-500" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} className="accent-indigo-500" />
                    Reduce background noise
                  </label>
                  <label
                    className={`flex items-center gap-1.5 text-[11px] cursor-pointer ${canDuck ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] cursor-not-allowed'}`}
                    title={canDuck ? 'System audio automatically lowers while you speak' : 'Needs separate mic + system tracks — available for recordings made after this update'}
                  >
                    <input type="checkbox" disabled={!canDuck} checked={duckSystem && canDuck} onChange={(e) => setDuckSystem(e.target.checked)} className="accent-indigo-500" />
                    Duck system audio when speaking
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={clickSounds} onChange={(e) => setClickSounds(e.target.checked)} className="accent-indigo-500" />
                    Click sounds
                  </label>
                </div>
              </div>
            )}

            {/* Batch targets (Sprint 10) */}
            {format === 'mp4' && (
              <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5">
                {aspect !== '9:16' && (
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={alsoVertical} onChange={(e) => setAlsoVertical(e.target.checked)} className="accent-indigo-500" />
                    Also export 9:16 vertical
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={alsoGif} onChange={(e) => setAlsoGif(e.target.checked)} className="accent-indigo-500" />
                  Also export GIF
                </label>
              </div>
            )}

            {/* Performance warning */}
            {perfWarning && !perfWarningDismissed && progress === null && !done && (
              <div className="mb-4 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                <span className="shrink-0">⚠</span>
                <span className="flex-1">{perfWarning}</span>
                <button onClick={() => setPerfWarningDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {/* Progress / done / error */}
            {progress !== null && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>{targetInfo ?? 'Exporting…'}</span>
                  <span>{progress}%{eta != null && eta > 0 ? ` · ~${formatEta(eta)} left` : ''}</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-indigo-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: 'linear', duration: 0.3 }}
                  />
                </div>
              </div>
            )}
            {done && (
              <div className="mb-4 flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                <span className="flex-1 truncate">✓ Saved to {done.split('/').slice(-2).join('/')}</span>
                {/* Quick share (Sprint 10): copy to clipboard + drag out */}
                <button
                  onClick={handleCopyFile}
                  className="shrink-0 px-2 py-1 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 font-medium transition-colors"
                  title="Copy the file — paste into Slack, Finder, iMessage…"
                >
                  {copied ? t('exportModal.copied') : t('exportModal.copyFile')}
                </button>
                <span
                  draggable
                  role="button"
                  tabIndex={0}
                  onDragStart={(e) => { e.preventDefault(); window.api.startFileDrag(done) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopyFile() }}
                  className="shrink-0 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[var(--text-primary)] cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Drag this out to Desktop, Slack… (or press Enter to copy the file instead)"
                  aria-label="Drag exported file out of the app; press Enter to copy it instead"
                >
                  ⇱ {t('exportModal.drag')}
                </span>
                <button
                  onClick={() => window.api.showInFolder(done)}
                  className="shrink-0 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="Show in Finder"
                  aria-label="Show exported file in Finder"
                >
                  📁
                </button>
              </div>
            )}
            {done && project && (
              <div className="mb-4">
                {/* No recording-title field currently flows into ProjectState
                    (HomeScreen's title.txt is separate) — derive a reasonable
                    default from the export filename rather than invent new
                    title-loading plumbing for this placeholder-credentials
                    feature. */}
                <PublishPanel
                  exportedFilePath={done}
                  recordingTitle={done.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Untitled Recording'}
                  chapters={project.chapters ?? []}
                  reviewComments={project.reviewComments ?? []}
                />
              </div>
            )}
            {error && (
              <div className="mb-4 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                ⚠ {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn-ghost">{t('exportModal.cancel')}</button>
              <button
                onClick={handleExport}
                disabled={progress !== null}
                className="btn-primary disabled:opacity-50"
              >
                {progress !== null ? t('exportModal.exporting') : `Export ${format.toUpperCase()}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
