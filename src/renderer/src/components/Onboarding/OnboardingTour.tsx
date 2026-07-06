import { useEffect, useState } from 'react'

interface Step {
  key: 'screen' | 'accessibility' | 'microphone' | 'camera'
  title: string
  description: string
  request: () => Promise<boolean>
}

/**
 * Sprint 12 US-102 — first-run tour that explains each macOS permission
 * *before* triggering its TCC prompt, in the order macOS actually needs them
 * (Screen Recording first — nothing else works without it). Previously the
 * app only asked for permissions reactively when a feature needed them,
 * which meant a new user's first minute was an unexplained barrage of
 * system dialogs.
 */
export function OnboardingTour() {
  const [visible, setVisible] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [granted, setGranted] = useState<Record<string, boolean>>({})
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    window.api.isOnboarded().then((done) => setVisible(!done))
  }, [])

  const steps: Step[] = [
    {
      key: 'screen',
      title: 'Screen Recording',
      description: 'Required to capture your screen at all. macOS will show a system prompt — choose Record Screen in System Settings if it doesn\'t appear automatically.',
      request: async () => (await window.api.checkPermissions()).screen
    },
    {
      key: 'accessibility',
      title: 'Accessibility',
      description: 'Lets the app track your cursor position and clicks, powering automatic zoom/pan and the cursor highlight effect.',
      request: async () => (await window.api.checkPermissions()).accessibility
    },
    {
      key: 'microphone',
      title: 'Microphone',
      description: 'Only used if you choose to record voiceover — you can always record with the mic off.',
      request: async () => (await window.api.checkPermissions()).microphone
    },
    {
      key: 'camera',
      title: 'Camera',
      description: 'Only used if you enable the webcam overlay — entirely optional per-recording.',
      request: async () => window.api.requestCameraPermission()
    }
  ]

  if (!visible) return null

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  async function handleGrant() {
    setRequesting(true)
    try {
      const ok = await step.request()
      setGranted((g) => ({ ...g, [step.key]: ok }))
    } finally {
      setRequesting(false)
    }
  }

  function handleNext() {
    if (isLast) {
      window.api.setOnboarded()
      setVisible(false)
      return
    }
    setStepIndex((i) => i + 1)
  }

  function handleSkipAll() {
    window.api.setOnboarded()
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center">
      <div className="w-[440px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-indigo-500' : 'bg-[var(--bg-hover)]'}`}
            />
          ))}
        </div>

        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{step.title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">{step.description}</p>

        {granted[step.key] === true && (
          <p className="text-xs text-emerald-400 mb-4">✓ Granted</p>
        )}
        {granted[step.key] === false && (
          <p className="text-xs text-amber-400 mb-4">
            Not granted yet — you can enable this later in System Settings › Privacy &amp; Security.
          </p>
        )}

        <div className="flex items-center justify-between">
          <button onClick={handleSkipAll} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            Skip for now
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleGrant}
              disabled={requesting}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              {requesting ? 'Requesting…' : 'Grant permission'}
            </button>
            <button onClick={handleNext} className="btn-primary text-xs">
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
