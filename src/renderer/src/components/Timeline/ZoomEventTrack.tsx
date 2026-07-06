import { useRef, useCallback } from 'react'
import type { ZoomEvent } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  events: ZoomEvent[]
  duration: number
}

export function ZoomEventTrack({ events, duration }: Props) {
  const removeZoomEvent = useProjectStore((s) => s.removeZoomEvent)
  const updateZoomEvent = useProjectStore((s) => s.updateZoomEvent)
  const trackRef = useRef<HTMLDivElement>(null)

  if (!events.length || duration <= 0) {
    return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />
  }

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {events.map((e) => (
        <ZoomBlock
          key={e.id}
          event={e}
          duration={duration}
          trackRef={trackRef}
          onRemove={() => removeZoomEvent(e.id)}
          onUpdate={(changes) => updateZoomEvent(e.id, changes)}
        />
      ))}
    </div>
  )
}

function ZoomBlock({
  event: e,
  duration,
  trackRef,
  onRemove,
  onUpdate
}: {
  event: ZoomEvent
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  onRemove: () => void
  onUpdate: (changes: Partial<ZoomEvent>) => void
}) {
  const dragEdge = useCallback((edge: 'start' | 'end') => (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.stopPropagation()
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return

    const move = (ev: MouseEvent) => {
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const t = pct * duration
      if (edge === 'start') {
        onUpdate({ startTime: Math.min(t, e.endTime - 0.2) })
      } else {
        onUpdate({ endTime: Math.max(t, e.startTime + 0.2) })
      }
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [e.startTime, e.endTime, duration, onUpdate, trackRef])

  return (
    <div
      className="group absolute top-0 h-full"
      style={{
        left: `${(e.startTime / duration) * 100}%`,
        width: `${((e.endTime - e.startTime) / duration) * 100}%`
      }}
    >
      <div
        title={`${e.isAuto ? 'Auto' : 'Manual'} zoom ×${e.zoomLevel.toFixed(1)} @ ${e.startTime.toFixed(1)}s`}
        className="w-full h-full bg-indigo-500/60 group-hover:bg-indigo-400/80 transition-colors cursor-pointer rounded-sm"
      />
      {/* Drag handles to adjust start/end — manual events only, auto events are
          regenerated from cursor data so resizing them by hand would be lost on
          the next "regenerate zoom" pass. */}
      {!e.isAuto && (
        <>
          <div
            onMouseDown={dragEdge('start')}
            className="absolute top-0 left-0 -ml-0.5 w-1.5 h-full cursor-ew-resize z-10"
          />
          <div
            onMouseDown={dragEdge('end')}
            className="absolute top-0 right-0 -mr-0.5 w-1.5 h-full cursor-ew-resize z-10"
          />
        </>
      )}
      <button
        onClick={(ev) => { ev.stopPropagation(); onRemove() }}
        title="Remove this zoom event"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>
    </div>
  )
}
