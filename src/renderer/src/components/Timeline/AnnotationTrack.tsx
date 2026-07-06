import { useRef, useState, useCallback } from 'react'
import type { Annotation } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  annotations: Annotation[]
  duration: number
}

/** Timeline track for timed text overlays (Sprint 9) — same interaction pattern
 *  as ZoomEventTrack: drag edges to retime, ✕ to delete, click to edit text. */
export function AnnotationTrack({ annotations, duration }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation)
  const removeAnnotation = useProjectStore((s) => s.removeAnnotation)

  if (duration <= 0) return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {annotations.map((a) => (
        <AnnotationBlock
          key={a.id}
          annotation={a}
          duration={duration}
          trackRef={trackRef}
          editing={editingId === a.id}
          onEdit={(open) => setEditingId(open ? a.id : null)}
          onUpdate={(changes) => updateAnnotation(a.id, changes)}
          onRemove={() => removeAnnotation(a.id)}
        />
      ))}
    </div>
  )
}

function AnnotationBlock({
  annotation: a, duration, trackRef, editing, onEdit, onUpdate, onRemove
}: {
  annotation: Annotation
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  editing: boolean
  onEdit: (open: boolean) => void
  onUpdate: (changes: Partial<Annotation>) => void
  onRemove: () => void
}) {
  const dragEdge = useCallback((edge: 'start' | 'end') => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (e: MouseEvent) => {
      const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration
      if (edge === 'start') onUpdate({ startTime: Math.min(t, a.endTime - 0.2) })
      else onUpdate({ endTime: Math.max(t, a.startTime + 0.2) })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [a.startTime, a.endTime, duration, onUpdate, trackRef])

  return (
    <div
      className="group absolute top-0 h-full"
      style={{
        left: `${(a.startTime / duration) * 100}%`,
        width: `${((a.endTime - a.startTime) / duration) * 100}%`
      }}
    >
      <div
        title={a.text}
        onClick={(e) => { e.stopPropagation(); onEdit(!editing) }}
        className="w-full h-full bg-emerald-500/60 group-hover:bg-emerald-400/80 transition-colors cursor-pointer rounded-sm"
      />
      <div onMouseDown={dragEdge('start')} className="absolute top-0 left-0 -ml-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <div onMouseDown={dragEdge('end')} className="absolute top-0 right-0 -mr-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Remove annotation"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>

      {editing && (
        <div
          className="absolute bottom-full mb-5 left-0 min-w-[220px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={a.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onEdit(false) }}
            className="h-7 px-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
            placeholder="Annotation text…"
          />
          <div className="flex gap-1">
            {(['heading', 'pill', 'plain'] as const).map((style) => (
              <button
                key={style}
                onClick={() => onUpdate({ style })}
                className={`flex-1 rounded px-1.5 py-1 text-[10px] capitalize transition-colors ${
                  a.style === style ? 'bg-indigo-500/30 text-indigo-300' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {style}
              </button>
            ))}
            <input
              type="color"
              value={a.color}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-7 h-6 rounded bg-transparent cursor-pointer"
              title="Text color"
            />
          </div>
        </div>
      )}
    </div>
  )
}
