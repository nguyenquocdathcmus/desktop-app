import { useEffect, useState } from 'react'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useT } from '../../hooks/useT'

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 4.8v10.4a.8.8 0 0 0 1.2.7l8.4-5.2a.8.8 0 0 0 0-1.4L7.7 4.1a.8.8 0 0 0-1.2.7z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5.5" y="4.5" width="3" height="11" rx="1" fill="currentColor" />
      <rect x="11.5" y="4.5" width="3" height="11" rx="1" fill="currentColor" />
    </svg>
  )
}

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 8H12.5C14.9853 8 17 10.0147 17 12.5C17 14.9853 14.9853 17 12.5 17H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 4.5L5 8L8 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RedoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 8H7.5C5.01472 8 3 10.0147 3 12.5C3 14.9853 5.01472 17 7.5 17H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4.5L15 8L12 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ControlBar() {
  const t = useT()
  const { currentTime, duration, isPlaying, togglePlay, seek } = usePlaybackStore()
  const { project, projectPath, canUndo, canRedo, undo, redo } = useProjectStore()
  const [linkCopied, setLinkCopied] = useState(false)

  function handleCopyTimestampLink() {
    if (!projectPath) return
    const link = `recordscreen://open?path=${encodeURIComponent(projectPath)}&t=${currentTime.toFixed(2)}`
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      // Sprint 17 US-138 — spacebar play/pause was documented as a shortcut
      // nowhere before this, and wasn't actually wired to anything.
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, togglePlay])

  if (!project) return null

  const totalDuration = project.manifest.duration || 0
  const progress = totalDuration > 0 ? currentTime / totalDuration : 0

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const cs = Math.floor((s % 1) * 100)
    return `${m}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-14 flex items-center gap-3.5 px-4 bg-[var(--bg-primary)] border-t border-white/[0.06] shrink-0">
      {/* Undo/Redo */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          aria-label={t('controlBar.undo')}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <UndoIcon className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          aria-label={t('controlBar.redo')}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RedoIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? t('controlBar.pause') : t('controlBar.play')}
        aria-pressed={isPlaying}
        className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 flex items-center justify-center text-white transition-colors shrink-0 shadow-[0_2px_10px_-2px_rgba(99,102,241,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
      </button>

      {/* Chapter navigation (Sprint 15 US-126) */}
      {!!project.chapters?.length && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) seek(Number(e.target.value)) }}
          aria-label="Jump to chapter"
          title="Jump to chapter"
          className="h-7 px-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0 max-w-[140px]"
        >
          <option value="">Chapters…</option>
          {[...project.chapters].sort((a, b) => a.t - b.t).map((c) => (
            <option key={c.id} value={c.t}>{formatTime(c.t)} — {c.title}</option>
          ))}
        </select>
      )}

      {/* Timecode */}
      <span className="text-[11px] font-mono text-[var(--text-secondary)] tabular-nums shrink-0 w-[92px]" aria-hidden="true">
        {formatTime(currentTime)} <span className="text-[var(--text-secondary)]">/</span> {formatTime(totalDuration)}
      </span>
      <span className="sr-only" aria-live="polite">
        {isPlaying ? 'Playing' : 'Paused'} at {formatTime(currentTime)} of {formatTime(totalDuration)}
      </span>

      {/* Scrubber */}
      <div className="flex-1 relative h-4 flex items-center cursor-pointer group">
        <div className="relative w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden group-hover:h-2 transition-all">
          <div
            className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {/* Scrub thumb */}
        <div
          className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-md -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.01}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={t('controlBar.seek')}
          className="absolute inset-0 w-full opacity-0 cursor-pointer focus-visible:outline-none"
        />
      </div>

      {/* Copy timestamp link (Sprint 15 US-127) — file-based sharing: works
          when a colleague has the same app and access to the same project
          path (network drive/cloud sync), not a hosted/real-time feature. */}
      <button
        onClick={handleCopyTimestampLink}
        title="Copy a link to this exact moment — opens for anyone with access to this project file"
        aria-label="Copy timestamp link"
        className="shrink-0 text-[10px] text-[var(--text-secondary)] hover:text-indigo-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {linkCopied ? 'Copied ✓' : '🔗 Copy link'}
      </button>
    </div>
  )
}
