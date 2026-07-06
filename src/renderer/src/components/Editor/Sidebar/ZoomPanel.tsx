import { useProjectStore } from '../../../store/useProjectStore'

export function ZoomPanel() {
  const { project, autoZoomEnabled, setAutoZoomEnabled, regenerateZoom, addZoomEvent, removeZoomEvent, updateZoomEvent } = useProjectStore()
  if (!project) return null

  const { zoomEvents } = project

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-3">
        <p className="label">Zoom & Pan</p>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <span className="text-[10px] text-[var(--text-secondary)]">Auto</span>
          <button
            onClick={() => {
              const next = !autoZoomEnabled
              setAutoZoomEnabled(next)
              if (next) regenerateZoom()
            }}
            className={`relative w-7 h-4 rounded-full transition-colors ${autoZoomEnabled ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${autoZoomEnabled ? 'left-3.5' : 'left-0.5'}`}
            />
          </button>
        </label>
      </div>

      {/* Regenerate button */}
      <button
        onClick={() => regenerateZoom()}
        className="w-full mb-3 py-1.5 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] text-xs text-[var(--text-secondary)] transition-colors border border-[var(--border)]"
      >
        ↻ Regenerate from cursor
      </button>

      {/* Zoom events list */}
      {zoomEvents.length === 0 ? (
        <p className="text-[10px] text-[var(--text-secondary)] text-center py-2 leading-relaxed">
          No zoom events yet. Turn on <span className="text-[var(--text-primary)]">Auto</span> above to generate them from cursor movement, or click <span className="text-[var(--text-primary)]">+ Zoom</span> on the Timeline to add one at the playhead.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
          {zoomEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-lg px-2 py-1.5 group">
              <span className="text-[10px] font-mono text-indigo-400 shrink-0">
                {e.startTime.toFixed(1)}s
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] flex-1 truncate">
                {e.zoomLevel.toFixed(1)}× @ ({(e.centerX * 100).toFixed(0)}%, {(e.centerY * 100).toFixed(0)}%)
              </span>
              {/* Zoom level slider */}
              <input
                type="range"
                min="1.2"
                max="4"
                step="0.1"
                value={e.zoomLevel}
                onChange={(ev) => updateZoomEvent(e.id, { zoomLevel: parseFloat(ev.target.value) })}
                className="w-12 accent-indigo-500"
                title="Zoom level"
              />
              <button
                onClick={() => removeZoomEvent(e.id)}
                className="text-[var(--text-secondary)] hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {zoomEvents.length > 0 && (
        <p className="text-[10px] text-[var(--text-secondary)] text-center mt-2">
          {zoomEvents.length} zoom event{zoomEvents.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
