import { useRef, useState, useCallback } from 'react'
import type { ReviewComment } from '../../../../shared/project-types'
import { useProjectStore } from '../../store/useProjectStore'

interface Props {
  comments: ReviewComment[]
  duration: number
}

/**
 * Timeline track for local review comments (Sprint 15 US-128). Deliberately
 * NOT real-time/networked — a colleague opens the same `.recordscreen`
 * project file (shared via Slack/Drive alongside the exported video) and
 * leaves timestamped notes here. Comments never render into export output;
 * this track only exists inside the app.
 */
export function ReviewCommentTrack({ comments, duration }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const updateReviewComment = useProjectStore((s) => s.updateReviewComment)
  const removeReviewComment = useProjectStore((s) => s.removeReviewComment)

  if (duration <= 0) return <div ref={trackRef} className="h-3 bg-[var(--bg-secondary)] rounded-sm opacity-30" />

  return (
    <div ref={trackRef} className="relative h-3 bg-[var(--bg-secondary)] rounded-sm overflow-visible">
      {comments.map((c) => (
        <CommentMarker
          key={c.id}
          comment={c}
          duration={duration}
          trackRef={trackRef}
          editing={editingId === c.id}
          onEdit={(open) => setEditingId(open ? c.id : null)}
          onUpdate={(changes) => updateReviewComment(c.id, changes)}
          onRemove={() => removeReviewComment(c.id)}
        />
      ))}
    </div>
  )
}

function CommentMarker({
  comment: c, duration, trackRef, editing, onEdit, onUpdate, onRemove
}: {
  comment: ReviewComment
  duration: number
  trackRef: React.RefObject<HTMLDivElement>
  editing: boolean
  onEdit: (open: boolean) => void
  onUpdate: (changes: Partial<ReviewComment>) => void
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
        title={`${c.text} @ ${c.t.toFixed(1)}s${c.author ? ` — ${c.author}` : ''}`}
        className={`w-2 h-full transition-colors cursor-ew-resize rounded-sm ${
          c.resolved ? 'bg-gray-500/50 group-hover:bg-gray-400/70' : 'bg-amber-500/70 group-hover:bg-amber-400/90'
        }`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title="Delete comment"
        className="absolute -top-4 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[9px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        ✕
      </button>

      {editing && (
        <div
          className="absolute bottom-full mb-5 left-1/2 -translate-x-1/2 min-w-[220px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl p-2 z-30 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            value={c.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') onEdit(false) }}
            rows={2}
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50 resize-none"
            placeholder="Note for the editor…"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={!!c.resolved}
              onChange={(e) => onUpdate({ resolved: e.target.checked })}
              className="accent-indigo-500"
            />
            Resolved
          </label>
        </div>
      )}
    </div>
  )
}
