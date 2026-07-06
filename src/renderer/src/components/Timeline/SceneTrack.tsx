import { useRef, useState, useCallback } from 'react'
import type { CameraScene } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  scenes: CameraScene[]
  duration: number
}

const LAYOUT_LABELS: Record<CameraScene['layout'], string> = {
  'pip': 'PIP',
  'camera-full': 'Camera',
  'side-by-side': 'Split',
  'screen-only': 'Screen',
  'title-card': 'Title'
}

const LAYOUT_CYCLE: CameraScene['layout'][] = ['pip', 'camera-full', 'side-by-side', 'screen-only', 'title-card']

/** Timeline track for camera layout scenes (Sprint 11). Click a block to cycle
 *  its layout; title-card scenes expose a text input. */
export function SceneTrack({ scenes, duration }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const updateScene = useProjectStore((s) => s.updateScene)
  const removeScene = useProjectStore((s) => s.removeScene)

  if (duration <= 0) return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {scenes.map((sc) => (
        <SceneBlock
          key={sc.id}
          scene={sc}
          duration={duration}
          trackRef={trackRef}
          editing={editingId === sc.id}
          onEdit={(open) => setEditingId(open ? sc.id : null)}
          onUpdate={(changes) => updateScene(sc.id, changes)}
          onRemove={() => removeScene(sc.id)}
        />
      ))}
    </div>
  )
}

function SceneBlock({
  scene: sc, duration, trackRef, editing, onEdit, onUpdate, onRemove
}: {
  scene: CameraScene
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  editing: boolean
  onEdit: (open: boolean) => void
  onUpdate: (changes: Partial<CameraScene>) => void
  onRemove: () => void
}) {
  const dragEdge = useCallback((edge: 'start' | 'end') => (ev: React.MouseEvent) => {
    ev.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (e: MouseEvent) => {
      const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration
      if (edge === 'start') onUpdate({ startTime: Math.min(t, sc.endTime - 0.3) })
      else onUpdate({ endTime: Math.max(t, sc.startTime + 0.3) })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [sc.startTime, sc.endTime, duration, onUpdate, trackRef])

  function cycleLayout() {
    const next = LAYOUT_CYCLE[(LAYOUT_CYCLE.indexOf(sc.layout) + 1) % LAYOUT_CYCLE.length]
    onUpdate({ layout: next, ...(next === 'title-card' && !sc.text ? { text: 'Title' } : {}) })
    if (next === 'title-card') onEdit(true)
  }

  return (
    <div
      className="group absolute top-0 h-full"
      style={{
        left: `${(sc.startTime / duration) * 100}%`,
        width: `${((sc.endTime - sc.startTime) / duration) * 100}%`
      }}
    >
      <div
        title={`${LAYOUT_LABELS[sc.layout]} — click to change layout`}
        onClick={(e) => { e.stopPropagation(); cycleLayout() }}
        className="w-full h-full bg-sky-500/60 group-hover:bg-sky-400/80 transition-colors cursor-pointer rounded-sm flex items-center justify-center overflow-hidden"
      >
        <span className="text-[8px] font-semibold text-white/90 leading-none truncate px-1 pointer-events-none">
          {LAYOUT_LABELS[sc.layout]}
        </span>
      </div>
      <div onMouseDown={dragEdge('start')} className="absolute top-0 left-0 -ml-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <div onMouseDown={dragEdge('end')} className="absolute top-0 right-0 -mr-0.5 w-1.5 h-full cursor-ew-resize z-10" />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Remove scene"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>

      {editing && sc.layout === 'title-card' && (
        <div
          className="absolute bottom-full mb-5 left-0 min-w-[200px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-30"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={sc.text ?? ''}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onEdit(false) }}
            className="w-full h-7 px-2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
            placeholder="Title text…"
          />
        </div>
      )}
    </div>
  )
}
