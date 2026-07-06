import type { DisplayInfo } from '../../../../shared/ipc-types'

interface Props {
  displays: DisplayInfo[]
  selectedId: number | null
  onSelect: (id: number) => void
}

/**
 * Sprint 20 US-161 — a to-scale spatial map of the real display arrangement
 * (like System Settings > Displays), replacing a flat list of cards that
 * gave no indication of physical position. Displays with a secondary
 * monitor positioned to the left/above the main one (negative x/y in
 * DisplayInfo) render in the correct relative spot instead of just being
 * "another card in the row."
 */
export function DisplayLayoutPicker({ displays, selectedId, onSelect }: Props) {
  if (displays.length === 0) return null

  const minX = Math.min(...displays.map((d) => d.x))
  const minY = Math.min(...displays.map((d) => d.y))
  const maxX = Math.max(...displays.map((d) => d.x + d.width))
  const maxY = Math.max(...displays.map((d) => d.y + d.height))
  const totalW = maxX - minX
  const totalH = maxY - minY

  const CANVAS_W = 260
  const scale = totalW > 0 ? Math.min(CANVAS_W / totalW, 90 / totalH) : 1
  const canvasH = totalH * scale

  return (
    <div
      className="relative mx-auto"
      style={{ width: totalW * scale, height: canvasH }}
      role="group"
      aria-label="Display layout"
    >
      {displays.map((d) => {
        const left = (d.x - minX) * scale
        const top = (d.y - minY) * scale
        const w = d.width * scale
        const h = d.height * scale
        const selected = selectedId === d.id
        return (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            title={`${d.name} — ${d.width}×${d.height}${d.isPrimary ? ' (main)' : ''}`}
            className={`absolute flex flex-col items-center justify-center rounded-md border text-[9px] font-medium transition-all ${
              selected
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 z-10'
                : 'border-white/[0.12] bg-white/[0.04] text-[var(--text-secondary)] hover:border-white/[0.2] hover:bg-white/[0.07]'
            }`}
            style={{ left, top, width: w, height: h }}
          >
            <span className="truncate px-1">{d.isPrimary ? 'Main' : d.name}</span>
          </button>
        )
      })}
    </div>
  )
}
