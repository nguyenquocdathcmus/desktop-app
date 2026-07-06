import { useProjectStore } from '../../../store/useProjectStore'

export function PaddingPanel() {
  const { project, setPadding, setCornerRadius } = useProjectStore()
  if (!project) return null

  const { padding, cornerRadius } = project

  return (
    <div className="panel space-y-4">
      <p className="label">Layout</p>

      {/* Padding */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Padding</span>
          <span className="text-xs font-mono text-[var(--text-secondary)]">{padding}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={120}
          step={4}
          value={padding}
          onChange={(e) => setPadding(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        {/* Quick presets */}
        <div className="flex gap-1 mt-1">
          {[0, 40, 60, 80].map((v) => (
            <button
              key={v}
              onClick={() => setPadding(v)}
              className={`flex-1 rounded py-0.5 text-[10px] transition-colors ${
                padding === v ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {v === 0 ? 'None' : `${v}`}
            </button>
          ))}
        </div>
      </div>

      {/* Corner radius */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Corner radius</span>
          <span className="text-xs font-mono text-[var(--text-secondary)]">{cornerRadius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={32}
          step={2}
          value={cornerRadius}
          onChange={(e) => setCornerRadius(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>
    </div>
  )
}
