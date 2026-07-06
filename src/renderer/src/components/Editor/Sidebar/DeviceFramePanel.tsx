import { useProjectStore } from '../../../store/useProjectStore'
import type { DeviceFrame } from '../../../../../shared/project-types'

const FRAMES: { id: DeviceFrame; label: string; icon: string }[] = [
  { id: 'none', label: 'None', icon: '⬜' },
  { id: 'macbook', label: 'MacBook', icon: '💻' },
  { id: 'browser', label: 'Browser', icon: '🌐' },
  { id: 'iphone', label: 'iPhone', icon: '📱' }
]

export function DeviceFramePanel() {
  const { project, setDeviceFrame } = useProjectStore()
  if (!project) return null

  const currentFrame = project.deviceFrame ?? 'none'

  return (
    <div className="panel">
      <p className="label mb-3">Device Frame</p>
      <div className="grid grid-cols-2 gap-1.5">
        {FRAMES.map((f) => (
          <button
            key={f.id}
            onClick={() => setDeviceFrame(f.id)}
            className={`flex flex-col items-center gap-1 rounded-lg border py-2 px-1 transition-all text-center ${
              currentFrame === f.id
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                : 'border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--border)]'
            }`}
          >
            <span className="text-lg leading-none">{f.icon}</span>
            <span className="text-[10px] font-medium leading-none">{f.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
