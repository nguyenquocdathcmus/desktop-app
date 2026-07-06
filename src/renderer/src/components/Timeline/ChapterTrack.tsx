import { useRef, useState, useCallback } from 'react'
import type { Chapter } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  chapters: Chapter[]
  duration: number
}

/** Timeline track for chapter markers (Sprint 15 US-125) — unlike the other
 *  tracks (zoom/annotation/scene, which are time RANGES), a chapter is a
 *  single point: drag to retime, click to rename, ✕ to remove. */
export function ChapterTrack({ chapters, duration }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const updateChapter = useProjectStore((s) => s.updateChapter)
  const removeChapter = useProjectStore((s) => s.removeChapter)

  if (duration <= 0) return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {chapters.map((c) => (
        <ChapterMarker
          key={c.id}
          chapter={c}
          duration={duration}
          trackRef={trackRef}
          editing={editingId === c.id}
          onEdit={(open) => setEditingId(open ? c.id : null)}
          onUpdate={(changes) => updateChapter(c.id, changes)}
          onRemove={() => removeChapter(c.id)}
        />
      ))}
    </div>
  )
}

function ChapterMarker({
  chapter: c, duration, trackRef, editing, onEdit, onUpdate, onRemove
}: {
  chapter: Chapter
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  editing: boolean
  onEdit: (open: boolean) => void
  onUpdate: (changes: Partial<Chapter>) => void
  onRemove: () => void
}) {
  const drag = useCallback((ev: React.MouseEvent) => {
    ev.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (e: MouseEvent) => {
      const t = Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration))
      onUpdate({ t })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [duration, onUpdate, trackRef])

  return (
    <div
      className="group absolute top-0 h-full -translate-x-1/2"
      style={{ left: `${(c.t / duration) * 100}%` }}
    >
      <div
        onMouseDown={drag}
        onClick={(e) => { e.stopPropagation(); onEdit(!editing) }}
        title={`${c.title} @ ${c.t.toFixed(1)}s — drag to retime, click to rename`}
        className="w-2 h-full bg-violet-500/70 group-hover:bg-violet-400/90 transition-colors cursor-ew-resize rounded-sm"
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Remove chapter"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>

      {editing && (
        <div
          className="absolute bottom-full mb-5 left-1/2 -translate-x-1/2 min-w-[180px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={c.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onEdit(false) }}
            className="w-full h-7 px-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
            placeholder="Chapter title…"
          />
        </div>
      )}
    </div>
  )
}
