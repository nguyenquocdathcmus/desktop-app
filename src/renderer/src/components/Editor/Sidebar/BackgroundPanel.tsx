import { useProjectStore } from '../../../store/useProjectStore'
import type { BackgroundSource } from '../../../../../shared/project-types'

const PRESET_GRADIENTS: BackgroundSource[] = [
  { type: 'gradient', stops: [{ color: '#1a1a2e', position: 0 }, { color: '#16213e', position: 1 }], angle: 135 },
  { type: 'gradient', stops: [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 0.5 }, { color: '#24243e', position: 1 }], angle: 135 },
  { type: 'gradient', stops: [{ color: '#134e5e', position: 0 }, { color: '#71b280', position: 1 }], angle: 135 },
  { type: 'gradient', stops: [{ color: '#373b44', position: 0 }, { color: '#4286f4', position: 1 }], angle: 135 },
  { type: 'gradient', stops: [{ color: '#c94b4b', position: 0 }, { color: '#4b134f', position: 1 }], angle: 135 },
  { type: 'gradient', stops: [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 1 }], angle: 135 },
]

function gradientCss(bg: Extract<BackgroundSource, { type: 'gradient' }>): string {
  const stops = bg.stops.map((s) => `${s.color} ${s.position * 100}%`).join(', ')
  return `linear-gradient(${bg.angle}deg, ${stops})`
}

export function BackgroundPanel() {
  const { project, setBackground } = useProjectStore()
  if (!project) return null

  const { background } = project

  return (
    <div className="panel">
      <p className="label mb-3">Background</p>

      {/* Type tabs */}
      <div className="flex gap-1 mb-3 bg-[var(--bg-primary)] rounded-lg p-1">
        {(['solid', 'gradient', 'blur'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              if (type === 'solid') setBackground({ type: 'solid', color: '#1a1a2e' })
              if (type === 'gradient') setBackground(PRESET_GRADIENTS[0])
              if (type === 'blur') setBackground({ type: 'blur', blurRadius: 20, screenshotPath: '' })
            }}
            className={`flex-1 rounded-md py-1 text-xs capitalize transition-colors ${
              background.type === type
                ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Gradient presets */}
      {background.type === 'gradient' && (
        <div className="grid grid-cols-3 gap-1.5">
          {PRESET_GRADIENTS.map((preset, i) => (
            <button
              key={i}
              onClick={() => setBackground(preset)}
              className="h-10 rounded-lg border-2 transition-colors"
              style={{
                background: gradientCss(preset as Extract<BackgroundSource, { type: 'gradient' }>),
                borderColor:
                  JSON.stringify(background) === JSON.stringify(preset) ? '#6366f1' : 'transparent'
              }}
            />
          ))}
        </div>
      )}

      {/* Solid color */}
      {background.type === 'solid' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={background.color}
            onChange={(e) => setBackground({ type: 'solid', color: e.target.value })}
            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs font-mono text-[var(--text-secondary)]">{background.color}</span>
        </div>
      )}

      {/* Blur */}
      {background.type === 'blur' && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-[var(--text-secondary)]">Blur radius</span>
            <span className="text-xs font-mono text-[var(--text-secondary)]">{background.blurRadius}px</span>
          </div>
          <input
            type="range"
            min={4}
            max={60}
            value={background.blurRadius}
            onChange={(e) => setBackground({ ...background, blurRadius: Number(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      )}
    </div>
  )
}
