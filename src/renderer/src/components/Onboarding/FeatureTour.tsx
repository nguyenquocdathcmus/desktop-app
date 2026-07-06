import { useEffect, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'

interface Step {
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    title: 'Preview',
    description: 'This is your recording. Click the frame while a manual zoom is active to re-pan its focus point, or drag annotations directly on top of it.'
  },
  {
    title: 'Timeline',
    description: 'Split clips with S, set in/out points with [ and ], and drag zoom/annotation/scene/chapter markers below the scrub bar. Detect Silences finds quiet gaps you can ripple-delete in one click.'
  },
  {
    title: 'Sidebar',
    description: 'Style your recording — background, padding, cursor highlight, device frame — and save the look as a preset, or save the whole structure as a template to reuse on your next recording.'
  },
  {
    title: 'Export',
    description: 'When you\'re happy with the edit, hit Export (top right) to render the final video at full quality — the proxy preview never affects export output.'
  }
]

/**
 * Sprint 17 US-140 — a feature tour, distinct from Sprint 12's permission
 * onboarding: this explains what's now on screen once a project is actually
 * open, not what macOS permissions are needed before recording starts.
 * Triggered once on the first project ever opened; reopenable via
 * Help → Show Tour Again (see main/index.ts + preload onRestartTour).
 */
export function FeatureTour() {
  const project = useProjectStore((s) => s.project)
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [checkedOnce, setCheckedOnce] = useState(false)

  useEffect(() => {
    if (!project || checkedOnce) return
    setCheckedOnce(true)
    window.api.getHintsState().then(({ dismissed }) => {
      if (!dismissed.includes('feature-tour-seen')) {
        setStepIndex(0)
        setVisible(true)
      }
    })
  }, [project, checkedOnce])

  useEffect(() => window.api.onRestartTour(() => { setStepIndex(0); setVisible(true) }), [])

  if (!visible || !project) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  function finish() {
    window.api.dismissHint('feature-tour-seen')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center">
      <div className="w-[420px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
            />
          ))}
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{step.title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">{step.description}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
            className="btn-primary text-xs"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
