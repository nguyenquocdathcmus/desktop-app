import { useProjectStore } from '../../../store/useProjectStore'
import { useEntitlementsStore } from '../../../store/useEntitlementsStore'
import { ProLockedPanel } from './ProLockedPanel'

const HIGHLIGHT_COLORS = ['#FFD700', '#FF4444', '#44FF88', '#4488FF', '#FF44FF', '#FFFFFF']

export function CursorPanel() {
  const { project, setCursorSettings } = useProjectStore()
  const cursorFxAllowed = useEntitlementsStore((s) => s.limits.cursorFxAllowed)
  if (!project) return null
  if (!cursorFxAllowed) {
    return <ProLockedPanel title="Cursor" description="Hiệu ứng con trỏ (highlight, click animation, làm mượt, kích thước) là tính năng Pro." />
  }

  const cs = project.cursorSettings

  return (
    <div className="panel">
      <p className="label mb-3">Cursor</p>

      {/* Visibility + highlight toggles */}
      <div className="flex flex-col gap-2 mb-3">
        <Row label="Show cursor">
          <Toggle value={cs.visible} onChange={(v) => setCursorSettings({ visible: v })} />
        </Row>
        <Row label="Highlight circle">
          <Toggle value={cs.highlight} onChange={(v) => setCursorSettings({ highlight: v })} />
        </Row>
        <Row label="Click animation">
          <Toggle value={cs.clickAnimation} onChange={(v) => setCursorSettings({ clickAnimation: v })} />
        </Row>
      </div>

      {/* Synthetic cursor size (Sprint 10) — only for cursor-less captures,
          where the app draws the cursor and can scale it freely */}
      {project.manifest.cursorHidden && cs.visible && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <p className="text-[10px] text-[var(--text-secondary)]">Cursor size</p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)]">{(cs.size ?? 1).toFixed(1)}×</p>
          </div>
          <input
            type="range" min="1" max="3" step="0.1"
            value={cs.size ?? 1}
            onChange={(e) => setCursorSettings({ size: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      {/* Color picker */}
      {cs.highlight && (
        <div className="mb-3">
          <p className="text-[10px] text-[var(--text-secondary)] mb-1.5">Highlight color</p>
          <div className="flex gap-1.5 flex-wrap">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setCursorSettings({ highlightColor: c })}
                className={`w-6 h-6 rounded-full border-2 transition-all ${cs.highlightColor === c ? 'border-white scale-110' : 'border-transparent hover:border-gray-500'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Radius slider */}
      {cs.highlight && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <p className="text-[10px] text-[var(--text-secondary)]">Radius</p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)]">{cs.highlightRadius}px</p>
          </div>
          <input
            type="range" min="10" max="80" step="2"
            value={cs.highlightRadius}
            onChange={(e) => setCursorSettings({ highlightRadius: parseInt(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      )}

      {/* Opacity slider */}
      {cs.highlight && (
        <div>
          <div className="flex justify-between mb-1">
            <p className="text-[10px] text-[var(--text-secondary)]">Opacity</p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)]">{Math.round(cs.highlightOpacity * 100)}%</p>
          </div>
          <input
            type="range" min="0.05" max="0.8" step="0.05"
            value={cs.highlightOpacity}
            onChange={(e) => setCursorSettings({ highlightOpacity: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-7 h-4 rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${value ? 'left-3.5' : 'left-0.5'}`}
      />
    </button>
  )
}
