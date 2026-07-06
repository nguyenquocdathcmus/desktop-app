import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import type { BackgroundSource, CursorEvent } from '../../../../shared/project-types'
import { getZoomAtTime } from '../../effects/ZoomPathGenerator'
import { Hint } from '../Common/Hint'

interface Ripple {
  id: number
  x: number // 0-1 normalized
  y: number // 0-1 normalized
  t: number // timestamp created
}

function bgToCss(bg: BackgroundSource): string {
  if (bg.type === 'solid') return bg.color
  if (bg.type === 'gradient') {
    const stops = bg.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')
    return `linear-gradient(${bg.angle}deg, ${stops})`
  }
  if (bg.type === 'blur' || bg.type === 'wallpaper') {
    return bg.screenshotPath ? `url(file://${bg.screenshotPath})` : '#1a1a2e'
  }
  return '#1a1a2e'
}

// Binary-search cursor position at a given time (seconds from recording start)
function cursorAtTime(
  events: { t: number; x: number; y: number }[],
  t: number,
  originMs: number
): { x: number; y: number } | null {
  if (events.length === 0) return null
  const videoT = t * 1000 + originMs  // convert back to absolute ms
  let lo = 0, hi = events.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (events[mid].t <= videoT) lo = mid
    else hi = mid - 1
  }
  const e = events[lo]
  if (Math.abs(e.t - videoT) > 200) return null  // > 200ms stale — hide
  return { x: e.x, y: e.y }
}

// Find click events near a given time (video-relative seconds)
function clicksNearTime(events: CursorEvent[], t: number, originMs: number, windowSec = 0.12) {
  const videoT = t * 1000 + originMs
  return events.filter(e => e.type === 'click' && Math.abs(e.t - videoT) < windowSec * 1000)
}

export function PreviewCanvas() {
  const { project, cursorEvents, setDeviceFrame, updateZoomEvent, updateAnnotation, updateBlurRegion } = useProjectStore()
  const { currentTime, isPlaying, setCurrentTime, setDuration, play, pause } = usePlaybackStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const webcamRef = useRef<HTMLVideoElement>(null)
  const videoFrameRef = useRef<HTMLDivElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [rePanMode, setRePanMode] = useState(false)
  const [faceSamples, setFaceSamples] = useState<{ t: number; cx: number; cy: number }[]>([])
  const lastClickRef = useRef<number>(-1)
  const rippleIdRef = useRef(0)

  // Proxy preview (Sprint 16 US-131/132) — a 720p re-encode used for smooth
  // scrubbing of large 4K sources. Export always reads the original; this only
  // ever changes what the preview <video> element's src points at.
  const [proxyPath, setProxyPath] = useState<string | null>(null)
  const [proxyPercent, setProxyPercent] = useState<number | null>(null)
  const [fullQuality, setFullQuality] = useState(false)

  if (!project) return null

  const { background, padding, cornerRadius, manifest, zoomEvents, cursorSettings, deviceFrame, webcam, scenes, segments, annotations, blurRegions } = project

  // Video playback sync (main + webcam kept in lockstep)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
    const wc = webcamRef.current
    if (wc) {
      if (isPlaying) wc.play().catch(() => {})
      else wc.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return
    if (Math.abs(video.currentTime - currentTime) > 0.3) {
      video.currentTime = currentTime
    }
    const wc = webcamRef.current
    if (wc && Math.abs(wc.currentTime - currentTime) > 0.3) {
      wc.currentTime = currentTime
    }
  }, [currentTime, videoReady])

  // Per-segment speed (Sprint 9): the raw source plays faster while the playhead
  // is inside a sped-up segment, previewing the export-time setpts/atempo.
  useEffect(() => {
    const active = segments.find((s) => currentTime >= s.start && currentTime <= s.end)
    const rate = active?.speed ?? 1
    if (videoRef.current && videoRef.current.playbackRate !== rate) videoRef.current.playbackRate = rate
    if (webcamRef.current && webcamRef.current.playbackRate !== rate) webcamRef.current.playbackRate = rate
  }, [currentTime, segments])

  // Proxy preview (Sprint 16): check for an existing proxy on mount, and listen
  // for the background generation started at record-stop time to finish later.
  useEffect(() => {
    let active = true
    setProxyPath(null)
    setProxyPercent(null)
    window.api.getProxyStatus(manifest.videoPath).then((s) => {
      if (active && s.ready) setProxyPath(s.proxyPath)
    })
    const unsubProgress = window.api.onProxyProgress(({ videoPath, percent }) => {
      if (videoPath === manifest.videoPath) setProxyPercent(percent)
    })
    const unsubReady = window.api.onProxyReady(({ videoPath, proxyPath: p }) => {
      if (videoPath === manifest.videoPath) {
        setProxyPath(p)
        setProxyPercent(null)
      }
    })
    return () => { active = false; unsubProgress(); unsubReady() }
  }, [manifest.videoPath])

  // Face auto-framing (Sprint 11): fetch cached face path once per webcam video.
  useEffect(() => {
    if (!manifest.webcamPath || !webcam?.faceTracking) { setFaceSamples([]); return }
    let active = true
    window.api.detectFaces(manifest.webcamPath)
      .then((samples) => { if (active) setFaceSamples(samples) })
      .catch(() => {})
    return () => { active = false }
  }, [manifest.webcamPath, webcam?.faceTracking])

  const handleLoaded = useCallback(() => {
    setDuration(videoRef.current?.duration ?? 0)
    setVideoReady(true)
  }, [setDuration])

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime ?? 0)
  }, [setCurrentTime])

  // Compute zoom state at current time
  const zoom = useMemo(() => {
    if (!zoomEvents || zoomEvents.length === 0) return { zoom: 1, cx: 0.5, cy: 0.5 }
    return getZoomAtTime(zoomEvents, currentTime)
  }, [zoomEvents, currentTime])

  // Manual zoom event whose window covers the playhead, if any — only manual events
  // can have their pan center re-targeted by clicking, since auto events get
  // overwritten whenever "regenerate zoom" runs from cursor data.
  const activeManualZoom = useMemo(
    () => zoomEvents?.find((e) => !e.isAuto && currentTime >= e.startTime && currentTime <= e.endTime) ?? null,
    [zoomEvents, currentTime]
  )

  const handleRePan = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rePanMode || !activeManualZoom) return
    const rect = videoFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    updateZoomEvent(activeManualZoom.id, { centerX: cx, centerY: cy })
    setRePanMode(false)
  }, [rePanMode, activeManualZoom, updateZoomEvent])

  // Detect click events as playback progresses → spawn ripple
  useEffect(() => {
    if (!cursorSettings.clickAnimation || !manifest.width || cursorEvents.length === 0) return
    const clicks = clicksNearTime(cursorEvents, currentTime, manifest.createdAt)
    if (clicks.length === 0) return
    const click = clicks[0]
    const clickKey = click.t
    if (lastClickRef.current === clickKey) return
    lastClickRef.current = clickKey
    const id = rippleIdRef.current++
    const rx = click.x / manifest.width
    const ry = click.y / manifest.height
    setRipples((prev) => [...prev, { id, x: rx, y: ry, t: Date.now() }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700)
  }, [currentTime, cursorEvents, manifest, cursorSettings.clickAnimation])

  // Compute cursor position at current time (normalized 0-1)
  const cursorPos = useMemo(() => {
    if (!cursorSettings.visible || cursorEvents.length === 0 || !manifest.width) return null
    const moveEvents = cursorEvents.filter(e => e.type === 'move' || e.type === 'click')
    const raw = cursorAtTime(moveEvents, currentTime, manifest.createdAt)
    if (!raw) return null
    return { x: raw.x / manifest.width, y: raw.y / manifest.height }
  }, [cursorEvents, currentTime, manifest, cursorSettings.visible])

  // Active camera scene at the playhead (Sprint 11); gaps fall back to PIP.
  const activeScene = useMemo(
    () => scenes?.find((s) => currentTime >= s.startTime && currentTime <= s.endTime) ?? null,
    [scenes, currentTime]
  )

  // Face-tracking crop center for the current time (nearest sample).
  const faceCenter = useMemo(() => {
    if (faceSamples.length === 0) return null
    let best = faceSamples[0]
    for (const s of faceSamples) {
      if (Math.abs(s.t - currentTime) < Math.abs(best.t - currentTime)) best = s
    }
    return best
  }, [faceSamples, currentTime])

  // Annotations visible at the playhead (Sprint 9).
  const activeAnnotations = useMemo(
    () => (annotations ?? []).filter((a) => currentTime >= a.startTime && currentTime <= a.endTime),
    [annotations, currentTime]
  )

  // Blur regions visible at the playhead (Sprint 19) — matches the export
  // filter's between(t, startTime, endTime) gating exactly.
  const activeBlurRegions = useMemo(
    () => (blurRegions ?? []).filter((b) => currentTime >= b.startTime && currentTime <= b.endTime),
    [blurRegions, currentTime]
  )

  const handleBlurRegionDrag = useCallback((id: string) => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    const rect = videoFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    const region = (blurRegions ?? []).find((b) => b.id === id)
    if (!region) return
    const startClientX = ev.clientX
    const startClientY = ev.clientY
    const startX = region.x
    const startY = region.y
    const move = (e: MouseEvent) => {
      const dx = (e.clientX - startClientX) / rect.width
      const dy = (e.clientY - startClientY) / rect.height
      const x = Math.max(0, Math.min(1 - region.width, startX + dx))
      const y = Math.max(0, Math.min(1 - region.height, startY + dy))
      updateBlurRegion(id, { x, y })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [blurRegions, updateBlurRegion])

  const handleBlurRegionResize = useCallback((id: string) => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    const rect = videoFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    const region = (blurRegions ?? []).find((b) => b.id === id)
    if (!region) return
    const move = (e: MouseEvent) => {
      const width = Math.max(0.05, Math.min(1 - region.x, (e.clientX - rect.left) / rect.width - region.x))
      const height = Math.max(0.05, Math.min(1 - region.y, (e.clientY - rect.top) / rect.height - region.y))
      updateBlurRegion(id, { width, height })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [blurRegions, updateBlurRegion])

  const handleAnnotationDrag = useCallback((id: string) => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    const rect = videoFrameRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      updateAnnotation(id, { x, y })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [updateAnnotation])

  // Preview layout
  const previewScale = 0.63
  const paddingPx = Math.round(padding * previewScale)
  const radiusPx = Math.round(cornerRadius * previewScale)

  // Webcam layout geometry per scene (Sprint 11) — mirrors sceneVariantGeometry
  // in Exporter.ts. Percent-based so it tracks the responsive preview size.
  const webcamLayout = useMemo((): React.CSSProperties | null => {
    if (!manifest.webcamPath || !webcam) return null
    const layout = activeScene?.layout ?? 'pip'
    if (layout === 'screen-only' || layout === 'title-card') return { opacity: 0, pointerEvents: 'none' as const, width: '20%', height: '20%', right: '2%', bottom: '2%' }
    const base: React.CSSProperties = {
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: 1
    }
    if (layout === 'camera-full') {
      return { ...base, left: 0, top: 0, width: '100%', height: '100%', borderRadius: radiusPx }
    }
    if (layout === 'side-by-side') {
      return { ...base, right: 0, top: 0, width: '50%', height: '100%', borderRadius: Math.min(12, radiusPx) }
    }
    // pip — sized/positioned from webcam settings
    const w = webcam.width * previewScale
    const h = webcam.height * previewScale
    const margin = 32 * previewScale
    const pos: React.CSSProperties = webcam.position === 'top-left' ? { left: margin, top: margin }
      : webcam.position === 'top-right' ? { right: margin, top: margin }
      : webcam.position === 'bottom-left' ? { left: margin, bottom: margin }
      : { right: margin, bottom: margin }
    return {
      ...base, ...pos, width: w, height: h,
      borderRadius: webcam.shape === 'circle' ? '50%' : 12
    }
  }, [manifest.webcamPath, webcam, activeScene, previewScale, radiusPx])

  const useProxy = !!proxyPath && !fullQuality
  const videoSrc = manifest.videoPath
    ? `file://${useProxy ? proxyPath : manifest.videoPath}`
    : undefined

  // Zoom CSS: scale around the focal point using transform-origin
  const zoomStyle = zoom.zoom > 1.001 ? {
    transform: `scale(${zoom.zoom.toFixed(3)})`,
    transformOrigin: `${(zoom.cx * 100).toFixed(1)}% ${(zoom.cy * 100).toFixed(1)}%`,
    transition: 'transform 0.05s linear'
  } : {
    transform: 'scale(1)',
    transformOrigin: 'center center',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
  }

  return (
    <div className="relative flex-1 bg-[var(--bg-primary)] overflow-hidden p-8 [background-image:radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.025),transparent_60%)]">
      <div
        className="absolute inset-8 m-auto rounded-2xl overflow-hidden ring-1 ring-white/[0.06]"
        style={{
          // The canvas matches the actual recording's aspect ratio (window
          // captures are rarely 16:9) instead of forcing a fixed 16:9 box —
          // that combined with object-cover on the <video> below used to crop
          // real content off the top/bottom of any non-16:9 window capture.
          // Export's own aspect-ratio cropping (16:9/9:16/1:1) is unaffected;
          // this only changes what the editor preview looks like.
          //
          // `position: absolute` + `inset` + `margin: auto` gives this box a
          // definite containing block (the `relative` parent, which has a
          // real height via the `h-screen` ancestor chain in Editor.tsx)
          // without the box itself needing `width`/`height: 100%` — so
          // `aspectRatio` + `maxWidth/maxHeight: 100%` can actually resolve
          // to "fit within, keep ratio" instead of either stretching (both
          // dimensions definite) or collapsing to 0 (neither definite).
          aspectRatio: manifest.width && manifest.height ? `${manifest.width} / ${manifest.height}` : '16 / 9',
          maxWidth: '100%',
          maxHeight: '100%',
          background: bgToCss(background),
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.65), 0 8px 24px -8px rgba(0,0,0,0.5)'
        }}
      >
        {/* Video inset with padding + rounded corners + zoom */}
        <div
          ref={videoFrameRef}
          onClick={handleRePan}
          className="absolute overflow-hidden"
          style={{
            top: paddingPx, right: paddingPx, bottom: paddingPx, left: paddingPx,
            borderRadius: radiusPx,
            boxShadow: paddingPx > 0 ? '0 4px 30px rgba(0,0,0,0.4)' : undefined,
            cursor: rePanMode ? 'crosshair' : undefined
          }}
        >
          <div className="w-full h-full" style={zoomStyle}>
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-cover"
                onLoadedMetadata={handleLoaded}
                onTimeUpdate={handleTimeUpdate}
                onEnded={pause}
                preload="auto"
                playsInline
              />
            ) : (
              <div className="w-full h-full bg-[var(--bg-primary)] flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
                <svg className="w-8 h-8 opacity-40" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M8.3 7.8l4.4 2.7-4.4 2.7V7.8z" fill="currentColor" />
                </svg>
                <span className="text-xs">No video</span>
              </div>
            )}

            {/* Synthetic cursor (Sprint 10) — drawn from cursor.json when the
                capture was made cursor-less; scales with cursorSettings.size */}
            {cursorPos && manifest.cursorHidden && cursorSettings.visible && videoReady && (
              <svg
                className="absolute pointer-events-none z-10"
                style={{
                  left: `${cursorPos.x * 100}%`,
                  top: `${cursorPos.y * 100}%`,
                  width: 21 * (cursorSettings.size ?? 1) * previewScale,
                  height: 35 * (cursorSettings.size ?? 1) * previewScale,
                  transition: 'left 0.04s linear, top 0.04s linear'
                }}
                viewBox="0 0 21 35"
              >
                <path
                  d="M0 0 L0 30 L7 23 L12 35 L16 33 L11 22 L21 22 Z"
                  fill="white"
                  stroke="black"
                  strokeWidth="1.5"
                />
              </svg>
            )}

            {/* Cursor highlight overlay */}
            {cursorPos && cursorSettings.highlight && videoReady && (
              <div
                className="absolute pointer-events-none rounded-full"
                style={{
                  left: `${cursorPos.x * 100}%`,
                  top: `${cursorPos.y * 100}%`,
                  width: cursorSettings.highlightRadius * 2 * previewScale,
                  height: cursorSettings.highlightRadius * 2 * previewScale,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: cursorSettings.highlightColor,
                  opacity: cursorSettings.highlightOpacity,
                  transition: 'left 0.04s linear, top 0.04s linear'
                }}
              />
            )}

            {/* Click ripple overlays */}
            {cursorSettings.clickAnimation && ripples.map((r) => (
              <div
                key={r.id}
                className="absolute pointer-events-none rounded-full border-2 border-white/70 animate-ripple"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: 36 * previewScale,
                  height: 36 * previewScale,
                  transform: 'translate(-50%, -50%)',
                  animation: 'ripple-out 0.65s ease-out forwards'
                }}
              />
            ))}
          </div>

          {/* Webcam overlay (Sprint 11) — laid out per active scene, kept in sync
              with the main video. Sits above the zoomed screen like in export. */}
          {manifest.webcamPath && webcam && webcamLayout && (
            <div className="absolute z-20" style={webcamLayout}>
              <video
                ref={webcamRef}
                src={`file://${manifest.webcamPath}`}
                className="w-full h-full object-cover"
                style={{
                  transform: webcam.mirror ? 'scaleX(-1)' : undefined,
                  objectPosition: faceCenter ? `${(faceCenter.cx * 100).toFixed(1)}% ${(faceCenter.cy * 100).toFixed(1)}%` : undefined,
                  boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
                  outline: (webcam.ringWidth ?? 0) > 0 ? `${webcam.ringWidth}px solid ${webcam.ringColor ?? '#ffffff'}` : undefined
                }}
                muted
                playsInline
                preload="auto"
              />
              {/* Face blur (Sprint 19 US-157) — approximates the export's
                  face-centered crop window as a centered blur box, since the
                  face-tracked video's objectPosition already keeps the face
                  near center of the visible frame. */}
              {webcam.faceBlur && (
                <div
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    left: '15%', top: '15%', width: '70%', height: '70%',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)'
                  }}
                />
              )}
            </div>
          )}

          {/* Annotations (Sprint 9) — draggable text overlays */}
          {activeAnnotations.map((a) => (
            <div
              key={a.id}
              onMouseDown={handleAnnotationDrag(a.id)}
              className={`absolute z-30 cursor-move select-none whitespace-nowrap -translate-x-1/2 -translate-y-1/2 ${
                a.style === 'heading' ? 'text-2xl font-bold drop-shadow-lg' :
                a.style === 'pill' ? 'text-sm font-medium px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm' :
                'text-sm drop-shadow'
              }`}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, color: a.color }}
            >
              {a.text}
            </div>
          ))}

          {/* Blur regions (Sprint 19) — redaction, fixed to output-frame position
              (same basis as annotations), applied after zoom in export so this
              matches: a region covers a spot on the final visible frame, not a
              point tracked inside the zoomed/panned source. */}
          {activeBlurRegions.map((b) => (
            <div
              key={b.id}
              onMouseDown={handleBlurRegionDrag(b.id)}
              className="absolute z-30 cursor-move rounded-sm ring-1 ring-rose-400/50"
              style={{
                left: `${b.x * 100}%`,
                top: `${b.y * 100}%`,
                width: `${b.width * 100}%`,
                height: `${b.height * 100}%`,
                backdropFilter: `blur(${Math.min(20, b.intensity)}px)`,
                WebkitBackdropFilter: `blur(${Math.min(20, b.intensity)}px)`
              }}
            >
              <div
                onMouseDown={handleBlurRegionResize(b.id)}
                title="Drag to resize"
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-rose-400 rounded-sm cursor-nwse-resize"
              />
            </div>
          ))}

          {/* Title card (Sprint 11) — covers the frame during a title-card scene */}
          {activeScene?.layout === 'title-card' && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center"
              style={{ background: background.type === 'solid' ? background.color : '#1a1a2e' }}
            >
              <span className="text-4xl font-bold text-white text-center px-8">{activeScene.text}</span>
            </div>
          )}

          {/* Loading overlay */}
          {videoSrc && !videoReady && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Browser frame overlay */}
        {deviceFrame === 'browser' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-[var(--bg-tertiary)] rounded-t-2xl flex items-center px-3 gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <div className="flex-1 mx-3 h-4 bg-[var(--bg-hover)] rounded-full" />
            </div>
          </div>
        )}

        {/* MacBook chrome overlay */}
        {deviceFrame === 'macbook' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 right-0 h-6 bg-[var(--bg-secondary)] rounded-t-2xl flex items-center px-3 gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <span className="w-2 h-2 rounded-full bg-[#28c840]" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-5 bg-[var(--bg-secondary)] rounded-b-2xl" />
          </div>
        )}

        {/* iPhone frame overlay */}
        {deviceFrame === 'iphone' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Status bar */}
            <div className="absolute top-0 left-0 right-0 h-7 bg-black/80 rounded-t-2xl flex items-center justify-between px-4">
              <span className="text-white text-[9px] font-semibold">9:41</span>
              <div className="absolute left-1/2 -translate-x-1/2 w-14 h-4 bg-black rounded-full" />
              <div className="flex items-center gap-1">
                <span className="text-white text-[9px]">▶ ▶▶</span>
                <span className="text-white text-[9px] ml-1">100%</span>
              </div>
            </div>
            {/* Home indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-black/80 rounded-b-2xl flex items-center justify-center">
              <div className="w-24 h-1 bg-white/60 rounded-full" />
            </div>
            {/* Border ring */}
            <div className="absolute inset-0 rounded-2xl ring-2 ring-white/10" />
          </div>
        )}

        {/* Proxy preview status (Sprint 16 US-132/US-135) */}
        {proxyPercent !== null && proxyPercent < 100 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 text-white/80 text-[10px] font-mono px-2 py-1 rounded-md backdrop-blur-md ring-1 ring-white/10">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
            Preparing smooth preview… {proxyPercent}%
          </div>
        )}
        {proxyPath && (
          <button
            onClick={() => setFullQuality((v) => !v)}
            title={fullQuality ? 'Showing original — click to switch back to the smooth proxy preview' : 'Showing smooth 720p proxy — click to see full quality (may stutter on large recordings)'}
            className={`absolute bottom-3 right-3 text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-md ring-1 transition-colors ${
              fullQuality
                ? 'bg-indigo-500 text-white ring-indigo-400'
                : 'bg-black/50 text-white/70 ring-white/10 hover:bg-black/70'
            }`}
          >
            {fullQuality ? 'Full quality' : 'Proxy preview'}
          </button>
        )}

        {/* Zoom indicator badge */}
        {zoom.zoom > 1.05 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 text-white/90 text-[10px] font-mono px-2 py-1 rounded-md backdrop-blur-md ring-1 ring-white/10">
            <svg className="w-2.5 h-2.5 opacity-70" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16.5 16.5l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {zoom.zoom.toFixed(1)}×
          </div>
        )}

        {/* Manual zoom re-pan control — only shown while the playhead is inside a
            manually-added zoom event's time range */}
        {activeManualZoom && !rePanMode && (
          <Hint
            id="manual-zoom-repan"
            active
            className="absolute top-10 left-3 max-w-[220px]"
          >
            Tip: click "Re-pan center" below, then click anywhere in the frame to move this zoom's focus point.
          </Hint>
        )}
        {activeManualZoom && (
          <button
            onClick={(e) => { e.stopPropagation(); setRePanMode((v) => !v) }}
            className={`absolute top-3 left-3 flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-md ring-1 transition-colors ${
              rePanMode
                ? 'bg-indigo-500 text-white ring-indigo-400'
                : 'bg-black/50 text-white/90 ring-white/10 hover:bg-black/70'
            }`}
          >
            {rePanMode ? 'Click video to set center…' : '⊹ Re-pan center'}
          </button>
        )}
      </div>
    </div>
  )
}
