import { useRef, useState, useCallback } from 'react'
import type { BlurRegion } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  regions: BlurRegion[]
  duration: number
}

/**
 * Sprint 19 US-153 — timeline track for redaction regions, same interaction
 * pattern as AnnotationTrack (drag edges to retime, ✕ to delete). Position/
 * size/intensity are edited via the popover here plus a draggable rectangle
 * directly on the preview (see PreviewCanvas's blur-region editing mode).
 */
export function BlurRegionTrack({ regions, duration }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const updateBlurRegion = useProjectStore((s) => s.updateBlurRegion)
  const removeBlurRegion = useProjectStore((s) => s.removeBlurRegion)

  if (duration <= 0) return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {regions.map((b) => (
        <BlurBlock
          key={b.id}
          region={b}
          duration={duration}
          trackRef={trackRef}
          editing={editingId === b.id}
          onEdit={(open) => setEditingId(open ? b.id : null)}
          onUpdate={(changes) => updateBlurRegion(b.id, changes)}
          onRemove={() => removeBlurRegion(b.id)}
        />
      ))}
    </div>
  )
}

function BlurBlock({
  region: b, duration, trackRef, editing, onEdit, onUpdate, onRemove
}: {
  region: BlurRegion
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  editing: boolean
  onEdit: (open: boolean) => void
  onUpdate: (changes: Partial<BlurRegion>) => void
  onRemove: () => void
}) {
  const dragEdge = useCallback((edge: 'start' | 'end') => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (e: MouseEvent) => {
      const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration
      if (edge === 'start') onUpdate({ startTime: Math.min(t, b.endTime - 0.2) })
      else onUpdate({ endTime: Math.max(t, b.startTime + 0.2) })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [b.startTime, b.endTime, duration, onUpdate, trackRef])

  return (
    <div
      className="group absolute top-0 h-full"
      style={{
        left: `${(b.startTime / duration) * 100}%`,
        width: `${((b.endTime - b.startTime) / duration) * 100}%`
      }}
    >
      <div
        title={`Blur region (intensity ${b.intensity}) — click to edit`}
        onClick={(e) => { e.stopPropagation(); onEdit(!editing) }}
        className="w-full h-full bg-rose-500/60 group-hover:bg-rose-400/80 transition-colors cursor-pointer rounded-sm"
      />
      <div onMouseDown={dragEdge('start')} className="absolute top-0 left-0 -ml-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <div onMouseDown={dragEdge('end')} className="absolute top-0 right-0 -mr-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Remove blur region"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>

      {editing && (
        <div
          className="absolute bottom-full mb-5 left-0 min-w-[200px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-[var(--text-secondary)]">Drag the box on the preview to move/resize. Intensity:</p>
          <input
            type="range"
            min={4}
            max={40}
            value={b.intensity}
            onChange={(e) => onUpdate({ intensity: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}
