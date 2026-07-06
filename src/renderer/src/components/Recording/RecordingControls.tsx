import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '../../store/useToastStore'
import { useRecordingStore } from '../../store/useRecordingStore'
import { useT } from '../../hooks/useT'
import { DisplayLayoutPicker } from './DisplayLayoutPicker'

// ─── Icons ──────────────────────────────────────────────────────────────────────

function ScreenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3.5" width="16" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 17h6M10 14v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function WindowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 7h15" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5" cy="5.3" r="0.6" fill="currentColor" />
      <circle cx="7" cy="5.3" r="0.6" fill="currentColor" />
    </svg>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5.5" width="11.5" height="9" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 8.6l4-2.3v7.4l-4-2.3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="7.25" y="2.5" width="5.5" height="9" rx="2.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5M7.5 17.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function SpeakerIcon({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7.5h2.8L10 4v12l-4.2-3.5H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      {muted ? (
        <path d="M13 7.5l4 4M17 7.5l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M13.2 7.2a3.6 3.6 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AppWindowFallbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
      <path d="M2.5 7h15" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
    </svg>
  )
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="10" height="10" rx="2" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="4.5" width="3" height="11" rx="1" />
      <rect x="11.5" y="4.5" width="3" height="11" rx="1" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4.5l10 5.5-10 5.5V4.5z" />
    </svg>
  )
}

// ─── Webcam Preview ────────────────────────────────────────────────────────────

function WebcamPreview({ deviceId }: { deviceId: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      } catch { /* permission denied */ }
    }
    start()
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [deviceId])

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover rounded-full"
      muted
      playsInline
      autoPlay
    />
  )
}

// ─── Mic level meter ────────────────────────────────────────────────────────────

/** Live VU meter so users can confirm the mic is actually picking up sound before recording. */
function MicLevelMeter({ deviceId }: { deviceId: string | null }) {
  const [level, setLevel] = useState(0) // 0..1
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }

        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sumSquares = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sumSquares += v * v
          }
          const rms = Math.sqrt(sumSquares / data.length)
          setLevel(Math.min(1, rms * 4)) // scale up — raw RMS for speech is quiet
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch { /* permission denied — meter just stays flat */ }
    }
    start()

    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach(t => t.stop())
      audioCtx?.close().catch(() => {})
    }
  }, [deviceId])

  const bars = 10
  const activeBars = Math.round(level * bars)

  return (
    <div className="flex items-center gap-[2px] h-3" title="Mic input level">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`w-[2.5px] rounded-full transition-colors ${
            i < activeBars
              ? i < bars * 0.6 ? 'bg-emerald-400' : i < bars * 0.85 ? 'bg-amber-400' : 'bg-red-400'
              : 'bg-[#3a3a3c]'
          }`}
          style={{ height: `${30 + (i / bars) * 70}%` }}
        />
      ))}
    </div>
  )
}

// ─── QuickTime-style pill ───────────────────────────────────────────────────────

/**
 * Compact floating control bar shown while counting down / recording / paused,
 * mirroring QuickTime Player's screen-recording pill: a small always-on-top
 * capsule near the top of the screen with a stop square, pause toggle, live
 * timer, and a chevron that reopens the full panel (source/device options)
 * without needing the whole picker UI visible at all times.
 */
function RecordingPill({
  isCountingDown,
  countdown,
  isPaused,
  status,
  onStop,
  onPauseToggle,
  onCancelCountdown,
  onExpand
}: {
  isCountingDown: boolean
  countdown: number | null
  isPaused: boolean
  status: { startedAt?: number; pausedElapsedMs?: number }
  onStop: () => void
  onPauseToggle: () => void
  onCancelCountdown: () => void
  onExpand: () => void
}) {
  return (
    <div
      className="h-11 w-full flex items-center gap-2.5 px-3 rounded-full bg-[#232326]/95 border border-white/[0.08] shadow-2xl"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {isCountingDown ? (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <AnimatePresence mode="wait">
            <motion.span
              key={countdown}
              initial={{ scale: 1.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[13px] font-semibold text-white tabular-nums"
            >
              Starting in {countdown}…
            </motion.span>
          </AnimatePresence>
          <button
            onClick={onCancelCountdown}
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="ml-auto text-[11px] font-medium text-[#9a9a9e] hover:text-white transition-colors shrink-0"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onStop}
            aria-label="Stop recording"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shrink-0 transition-colors"
          >
            <StopIcon className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={onPauseToggle}
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center shrink-0 transition-colors"
          >
            {isPaused ? <PlayIcon className="w-3.5 h-3.5 text-white" /> : <PauseIcon className="w-3.5 h-3.5 text-white" />}
          </button>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
          <RecordingTimer startedAt={status.startedAt} pausedElapsedMs={status.pausedElapsedMs} isPaused={isPaused} />
          <button
            onClick={onExpand}
            aria-label="Show recording options"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="ml-auto w-6 h-6 rounded-full hover:bg-white/[0.08] flex items-center justify-center shrink-0 transition-colors text-[#9a9a9e] hover:text-white"
          >
            <ChevronDownIcon className="w-3 h-3 rotate-180" />
          </button>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RecordingControls() {
  const t = useT()
  const {
    status, displays, windows,
    selectedDisplayId, selectedWindowId,
    captureMode, setCaptureMode,
    webcamEnabled, webcamDeviceId, webcamDevices,
    micEnabled, micDeviceId, micDevices,
    selectedFps, setSelectedFps,
    hdrEnabled, setHdrEnabled,
    fetchDisplays, fetchWindows, fetchMediaDevices,
    selectDisplay, selectWindow,
    setWebcamEnabled, setWebcamDeviceId,
    setMicEnabled, setMicDeviceId,
    startRecording, stopRecording, pauseRecording, resumeRecording
  } = useRecordingStore()

  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showMicMenu, setShowMicMenu] = useState(false)
  const [showCamMenu, setShowCamMenu] = useState(false)
  const [windowsLoading, setWindowsLoading] = useState(false)
  // User can reopen the full panel (chevron) while recording/paused to change
  // devices etc.; collapses back to the pill automatically once they start
  // a new countdown or explicitly collapse it again.
  const [pillExpanded, setPillExpanded] = useState(false)
  // Sprint 30 US-220 — Free plan can't record webcam/audio and caps at 5 min.
  // null while loading = draw nothing locked (avoids a lock flash for Pro).
  // Display-only: main strips the options and drops the sidecars regardless.
  const [maxRecordingSeconds, setMaxRecordingSeconds] = useState<number | null>(null)
  const [mediaLocked, setMediaLocked] = useState(false)
  const pushToast = useToastStore((s) => s.push)

  useEffect(() => {
    fetchDisplays()
    fetchMediaDevices()
  }, [])

  useEffect(() => {
    let stale = false
    window.api.getEntitlements().then((ent) => {
      if (stale) return
      setMaxRecordingSeconds(ent.limits.maxRecordingSeconds)
      setMediaLocked(!ent.limits.webcamAllowed)
      if (!ent.limits.webcamAllowed) {
        // A previous Pro session may have left these on in the store.
        setWebcamEnabled(false)
        setMicEnabled(false)
      }
    }).catch(() => {})
    const unsubscribe = window.api.onRecordingLimitReached(({ maxSeconds }) => {
      pushToast({
        kind: 'info',
        message: `Recording stopped at the Free plan's ${Math.round(maxSeconds / 60)}-minute limit. Upgrade to Pro for unlimited length.`
      })
    })
    return () => { stale = true; unsubscribe() }
  }, [])

  // Fetch windows when switching to window mode
  useEffect(() => {
    if (captureMode !== 'window') return
    setWindowsLoading(true)
    fetchWindows().finally(() => setWindowsLoading(false))
  }, [captureMode])

  const isRecording = status.state === 'recording'
  const isPaused = status.state === 'paused'
  const isProcessing = status.state === 'processing'
  const isDone = status.state === 'done'
  const isCountingDown = countdown !== null
  const isActive = isRecording || isPaused || isCountingDown || isProcessing

  // QuickTime-style shape: collapse the window down to a small pill once a
  // countdown starts or recording/paused begins, unless the user explicitly
  // reopened the panel via the chevron. Grows back to the full panel the
  // moment recording finishes (processing/done/idle).
  const showPill = (isCountingDown || isRecording || isPaused) && !pillExpanded
  useEffect(() => {
    window.api.setControlsMode(showPill ? 'pill' : 'panel')
  }, [showPill])

  // Once recording actually stops, drop the "manually reopened" flag so the
  // next countdown collapses to the pill again instead of staying expanded.
  useEffect(() => {
    if (!isRecording && !isPaused && !isCountingDown) setPillExpanded(false)
  }, [isRecording, isPaused, isCountingDown])

  // Name of the source currently being recorded, for the header shown while active.
  const activeSourceName = (isRecording || isPaused)
    ? (status.windowId
        ? windows.find((w) => w.id === status.windowId)?.appName ?? 'Window'
        : displays.find((d) => d.id === status.displayId)?.name ?? 'Screen')
    : null

  async function handleStartClick() {
    // Sprint 12 US-105 — lossless HEVC 4K60 runs ~2GB/minute; warn (don't block)
    // before a long recording fails partway through from a full disk. Sprint
    // 25 US-192 — higher fps scales disk usage roughly linearly (120fps ≈ 2x
    // the frames of 60fps), so the "low" threshold check alone isn't enough
    // warning for someone about to record at 120fps — call it out explicitly.
    try {
      const { freeGB, low } = await window.api.checkDiskSpace()
      if (low) {
        useToastStore.getState().push({
          kind: 'warning',
          message: `Only ${freeGB.toFixed(1)}GB free — recording may run out of disk space.`
        })
      } else if (selectedFps > 60 && freeGB < 10) {
        useToastStore.getState().push({
          kind: 'warning',
          message: `Recording at ${selectedFps}fps uses disk much faster than 60fps — only ${freeGB.toFixed(1)}GB free.`
        })
      }
    } catch { /* non-blocking — never let this check stop recording */ }

    setCountdown(3)
    let count = 3
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(countdownRef.current!)
        setCountdown(null)
        startRecording()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }

  function handleCancelCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(null)
  }

  // Sprint 23 US-179/US-180 — the menu bar "Start/Stop Recording" item and
  // the global keyboard shortcut both funnel into this single toggle so they
  // stay in sync with whatever the pill/panel buttons already do (countdown,
  // disk-space warning, pause vs stop) instead of a second code path in main.
  useEffect(() => {
    return window.api.onRecordingToggleRequested(() => {
      if (isCountingDown) {
        handleCancelCountdown()
      } else if (isRecording || isPaused) {
        stopRecording()
      } else if (!isProcessing) {
        handleStartClick()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCountingDown, isRecording, isPaused, isProcessing])

  const closeMenus = useCallback(() => {
    setShowMicMenu(false)
    setShowCamMenu(false)
  }, [])

  if (showPill) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent select-none">
        <RecordingPill
          isCountingDown={isCountingDown}
          countdown={countdown}
          isPaused={isPaused}
          status={status as any}
          onStop={stopRecording}
          onPauseToggle={isPaused ? resumeRecording : pauseRecording}
          onCancelCountdown={handleCancelCountdown}
          onExpand={() => setPillExpanded(true)}
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen bg-[#1c1c1e] select-none overflow-hidden rounded-xl border border-white/[0.06]"
      style={{ WebkitAppRegion: 'drag' } as any}
      onClick={closeMenus}
    >
      {/* ── Title bar ── */}
      <div className="h-9 flex items-center justify-center gap-1.5 shrink-0 border-b border-white/[0.04] px-3 relative">
        {!isRecording && !isPaused && (
          <button
            onClick={(e) => { e.stopPropagation(); window.api.setRecordingControlsVisible(false) }}
            aria-label="Close"
            title="Close"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-[#8a8a8e] hover:text-white transition-colors text-[13px] leading-none"
          >
            ×
          </button>
        )}
        {activeSourceName ? (
          <>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} />
            <span className="text-[12px] text-[#b0b0b3] font-semibold tracking-wide truncate">
              {isPaused ? 'Paused — ' : 'Recording '}{activeSourceName}
            </span>
          </>
        ) : (
          <span className="text-[12px] text-[#8a8a8e] font-semibold tracking-wide">Record Screen</span>
        )}
        {(isRecording || isPaused) && (
          <button
            onClick={(e) => { e.stopPropagation(); setPillExpanded(false) }}
            aria-label="Collapse to pill"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-[#8a8a8e] hover:text-white transition-colors"
          >
            <ChevronDownIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      <div
        className="flex flex-col gap-3 px-4 pt-3.5 pb-3.5 flex-1 min-h-0"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* ── Source tabs: Screen / Window ── */}
        <div className="flex gap-1 bg-black/30 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setCaptureMode('display')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors ${
              captureMode === 'display'
                ? 'bg-[#3a3a3d] text-white shadow-sm'
                : 'text-[#7a7a7e] hover:text-[#b0b0b3]'
            }`}
          >
            <ScreenIcon className="w-3.5 h-3.5" />
            Screen
          </button>
          <button
            onClick={() => setCaptureMode('window')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors ${
              captureMode === 'window'
                ? 'bg-[#3a3a3d] text-white shadow-sm'
                : 'text-[#7a7a7e] hover:text-[#b0b0b3]'
            }`}
          >
            <WindowIcon className="w-3.5 h-3.5" />
            Window
          </button>
        </div>

        {/* ── Screen picker ── */}
        {captureMode === 'display' && (
          <div className="shrink-0">
            {displays.length > 1 ? (
              <DisplayLayoutPicker displays={displays} selectedId={selectedDisplayId} onSelect={selectDisplay} />
            ) : (
              <div className="flex gap-2">
                {displays.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => selectDisplay(d.id)}
                    className={`flex-1 min-w-0 rounded-lg border px-2.5 py-2 text-left transition-all ${
                      selectedDisplayId === d.id
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/[0.06] bg-white/[0.03] text-[#9a9a9e] hover:border-white/[0.12] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="block truncate text-[12px] font-medium">{d.name}</span>
                    <span className="block text-[10px] opacity-60 mt-0.5 tabular-nums">{d.width}×{d.height}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sprint 20 US-163 — the selected display has an unusual aspect ratio
            (ultrawide or a vertical monitor) that a default 16:9 export would
            crop badly; nudge toward matching it instead. */}
        {captureMode === 'display' && (() => {
          const d = displays.find((x) => x.id === selectedDisplayId)
          if (!d) return null
          const ratio = d.width / d.height
          if (ratio > 2.1) {
            return (
              <p className="text-[10px] text-amber-400/90 -mt-1 leading-relaxed">
                This is an ultrawide display ({d.width}×{d.height}) — a 16:9 export will crop the sides. Consider a wider aspect ratio when exporting.
              </p>
            )
          }
          if (ratio < 0.9) {
            return (
              <p className="text-[10px] text-amber-400/90 -mt-1 leading-relaxed">
                This display is oriented vertically ({d.width}×{d.height}) — pick 9:16 when exporting to avoid heavy cropping.
              </p>
            )
          }
          return null
        })()}

        {/* Sprint 25 US-189 — only offer above 60fps when the selected display
            actually runs at a higher refresh rate (ProMotion); requesting more
            than the display produces just duplicates frames for no benefit,
            per SCStreamConfiguration.minimumFrameInterval's real behavior. */}
        {captureMode === 'display' && (() => {
          const d = displays.find((x) => x.id === selectedDisplayId)
          if (!d || d.refreshRate <= 60) return null
          const options = ([60, 90, 120] as const).filter((f) => f <= d.refreshRate)
          return (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-500">Frame rate</span>
              <div className="flex gap-1 bg-black/30 rounded-md p-0.5">
                {options.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFps(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      selectedFps === f ? 'bg-[#3a3a3d] text-white' : 'text-[#7a7a7e] hover:text-[#b0b0b3]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Sprint 25 US-190 — only offered when the selected display's panel
            actually reports 10-bit color (see DisplayInfo.supportsHDR);
            opt-in and off by default since HDR files play back with washed-out
            colors on non-HDR screens/players unless the viewer's setup supports it. */}
        {captureMode === 'display' && (() => {
          const d = displays.find((x) => x.id === selectedDisplayId)
          if (!d?.supportsHDR) return null
          return (
            <label className="flex items-center justify-between gap-2 shrink-0 cursor-pointer">
              <span className="text-[10px] text-gray-400">Capture HDR (10-bit)</span>
              <button
                onClick={() => setHdrEnabled(!hdrEnabled)}
                role="switch"
                aria-checked={hdrEnabled}
                className={`relative w-8 h-[18px] rounded-full transition-colors ${hdrEnabled ? 'bg-indigo-500' : 'bg-[#3a3a3d]'}`}
              >
                <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow transition-transform ${hdrEnabled ? 'left-[16px]' : 'left-[2px]'}`} />
              </button>
            </label>
          )
        })()}

        {/* ── Window picker ── */}
        {captureMode === 'window' && (
          <div className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto pr-0.5 -mr-0.5">
            {windowsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#555] py-6">
                <span className="w-4 h-4 rounded-full border-2 border-[#444] border-t-[#888] animate-spin" />
                <span className="text-[11px]">Finding windows…</span>
              </div>
            ) : windows.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-center py-6">
                <AppWindowFallbackIcon className="w-6 h-6 text-[#444]" />
                <span className="text-[11px] text-[#666]">No windows found</span>
                <span className="text-[10px] text-[#4a4a4a] max-w-[220px]">Open an app window, then reopen this tab</span>
              </div>
            ) : (
              windows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => selectWindow(w.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all shrink-0 ${
                    selectedWindowId === w.id
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                      : 'border-white/[0.06] bg-white/[0.03] text-[#b0b0b3] hover:border-white/[0.12] hover:bg-white/[0.05]'
                  }`}
                >
                  {/* App color badge */}
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white/90 shrink-0"
                    style={{ backgroundColor: appColor(w.appName) }}
                  >
                    {w.appName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium truncate leading-tight">
                      {w.appName}
                    </span>
                    {w.title !== w.appName && (
                      <span className="block text-[10.5px] opacity-55 truncate leading-tight mt-0.5">
                        {w.title}
                      </span>
                    )}
                  </div>
                  {selectedWindowId === w.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Camera + Mic row ── */}
        {mediaLocked && (
          <p className="text-[10px] text-[#8a8a8e] -mb-1 shrink-0">
            🔒 Webcam & audio recording is a Pro feature — Free records video only, up to {Math.round((maxRecordingSeconds ?? 300) / 60)} min.
          </p>
        )}
        <div className="flex gap-2 shrink-0">
          {/* Webcam toggle */}
          <div className="relative flex-1">
            <button
              disabled={mediaLocked}
              onClick={(e) => { e.stopPropagation(); setShowCamMenu(!showCamMenu) }}
              aria-haspopup="menu"
              aria-expanded={showCamMenu}
              aria-label={`Camera: ${webcamEnabled ? 'on' : 'off'}. Choose device`}
              className={`w-full flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                webcamEnabled
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/[0.06] bg-white/[0.03] text-[#8a8a8e] hover:border-white/[0.12]'
              }`}
            >
              <CameraIcon className="w-4 h-4 shrink-0" />
              <span className="truncate font-medium">
                {webcamEnabled
                  ? (webcamDevices.find(d => d.deviceId === webcamDeviceId)?.label || 'Camera').split(' ')[0]
                  : 'Camera'}
              </span>
              <ChevronDownIcon className="w-3 h-3 ml-auto opacity-60 shrink-0" />
            </button>

            <AnimatePresence>
              {showCamMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full mb-1.5 left-0 w-full bg-[#2c2c2e] border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${!webcamEnabled ? 'text-white bg-white/[0.08]' : 'text-[#9a9a9e] hover:bg-white/[0.05]'}`}
                    onClick={() => {
                      setWebcamEnabled(false)
                      setShowCamMenu(false)
                      window.api.closeWebcamWindow()
                    }}
                  >
                    Off
                  </button>
                  {webcamDevices.map((d) => (
                    <button
                      key={d.deviceId}
                      className={`w-full text-left px-3 py-2 text-[12px] truncate transition-colors ${webcamEnabled && webcamDeviceId === d.deviceId ? 'text-white bg-white/[0.08]' : 'text-[#9a9a9e] hover:bg-white/[0.05]'}`}
                      onClick={() => {
                        setWebcamEnabled(true)
                        setWebcamDeviceId(d.deviceId)
                        setShowCamMenu(false)
                        window.api.openWebcamWindow(d.deviceId)
                      }}
                    >
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mic toggle */}
          <div className="relative flex-1">
            <button
              disabled={mediaLocked}
              onClick={(e) => { e.stopPropagation(); setShowMicMenu(!showMicMenu) }}
              aria-haspopup="menu"
              aria-expanded={showMicMenu}
              aria-label={`Microphone: ${micEnabled ? 'on' : 'off'}. Choose device`}
              className={`w-full flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                micEnabled
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                  : 'border-white/[0.06] bg-white/[0.03] text-[#8a8a8e] hover:border-white/[0.12]'
              }`}
            >
              <MicIcon className="w-4 h-4 shrink-0" />
              <span className="truncate font-medium">
                {micEnabled
                  ? (micDevices.find(d => d.deviceId === micDeviceId)?.label || 'Mic').split(' ').slice(0, 2).join(' ')
                  : 'Mic Off'}
              </span>
              {micEnabled && !isActive && (
                <MicLevelMeter deviceId={micDeviceId} />
              )}
              <ChevronDownIcon className="w-3 h-3 ml-auto opacity-60 shrink-0" />
            </button>

            <AnimatePresence>
              {showMicMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute bottom-full mb-1.5 left-0 w-full bg-[#2c2c2e] border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${!micEnabled ? 'text-white bg-white/[0.08]' : 'text-[#9a9a9e] hover:bg-white/[0.05]'}`}
                    onClick={() => { setMicEnabled(false); setShowMicMenu(false) }}
                  >
                    Off
                  </button>
                  {micDevices.map((d) => (
                    <button
                      key={d.deviceId}
                      className={`w-full text-left px-3 py-2 text-[12px] truncate transition-colors ${micEnabled && micDeviceId === d.deviceId ? 'text-white bg-white/[0.08]' : 'text-[#9a9a9e] hover:bg-white/[0.05]'}`}
                      onClick={() => {
                        setMicEnabled(true)
                        setMicDeviceId(d.deviceId)
                        setShowMicMenu(false)
                      }}
                    >
                      {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── System audio status chip ── */}
        <div
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10.5px] shrink-0 ${
            captureMode === 'display'
              ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400/85'
              : 'border-white/[0.06] bg-white/[0.02] text-[#6a6a6e]'
          }`}
          title={captureMode === 'display'
            ? 'System audio (speaker sound, app sounds) will be recorded'
            : 'System audio requires full-screen recording — switch to Screen mode to capture it'}
        >
          <SpeakerIcon className="w-3.5 h-3.5 shrink-0" muted={captureMode !== 'display'} />
          <span className="font-medium">System Audio</span>
          <span className="ml-auto opacity-80">
            {captureMode === 'display' ? 'On' : 'Off (Window mode)'}
          </span>
        </div>

        {/* ── Main action button ── */}
        {isCountingDown ? (
          <div className="flex gap-2 h-11 shrink-0">
            <div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={countdown}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-2xl font-bold text-white tabular-nums leading-none"
                >
                  {countdown}
                </motion.span>
              </AnimatePresence>
            </div>
            <button
              onClick={handleCancelCountdown}
              className="px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#9a9a9e] hover:text-white text-[12px] font-medium transition-colors"
            >
              {t('recording.cancel')}
            </button>
          </div>
        ) : isRecording || isPaused ? (
          <div className="flex gap-2 h-11 shrink-0">
            <button
              onClick={stopRecording}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-400 text-white text-[13px] font-semibold transition-colors"
            >
              {t('recording.stop')}
            </button>
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#b0b0b3] hover:text-white text-[12px] font-medium transition-colors"
            >
              {isPaused ? t('recording.resume') : t('recording.pauseAction')}
            </button>
            <div className="flex items-center gap-2 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`} aria-hidden="true" />
              <RecordingTimer
                startedAt={(status as any).startedAt}
                pausedElapsedMs={(status as any).pausedElapsedMs}
                isPaused={isPaused}
              />
            </div>
          </div>
        ) : isProcessing ? (
          <div className="h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center gap-2 shrink-0">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-[#555] border-t-white animate-spin" />
            <span className="text-[12px] text-[#9a9a9e]">Saving…</span>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStartClick}
            className="h-11 w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-[13px] font-semibold transition-colors shrink-0"
          >
            {t('recording.startRecording')}
          </motion.button>
        )}

        {isDone && (
          <p className="text-[11px] text-emerald-400 text-center leading-none shrink-0">
            {t('recording.savedOpeningEditor')}
          </p>
        )}

        {/* Sprint 13 US-113 — announces state changes to screen readers; the
            colored dot + timer above are visual-only otherwise. */}
        <span className="sr-only" aria-live="polite">
          {isCountingDown ? `Starting in ${countdown}…`
            : isRecording ? t('recording.statusRecording')
            : isPaused ? t('recording.statusPaused')
            : isProcessing ? t('recording.statusSaving')
            : isDone ? t('recording.statusSaved')
            : t('recording.statusReady')}
        </span>
      </div>
    </div>
  )
}

function RecordingTimer({
  startedAt,
  pausedElapsedMs = 0,
  isPaused = false
}: {
  startedAt?: number
  pausedElapsedMs?: number
  isPaused?: boolean
}) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt - pausedElapsedMs) / 1000)))
    tick()
    if (isPaused) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, pausedElapsedMs, isPaused])
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const s = String(elapsed % 60).padStart(2, '0')
  return <span className="text-[12px] font-mono text-[#b0b0b3] tabular-nums">{m}:{s}</span>
}

// Deterministic color per app name
function appColor(name: string): string {
  const colors = ['#5856D6', '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#00C7BE', '#FF2D55']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return colors[Math.abs(hash) % colors.length]
}
