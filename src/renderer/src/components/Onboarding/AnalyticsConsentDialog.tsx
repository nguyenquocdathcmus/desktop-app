import { useEffect, useState } from 'react'

const CONSENT_SEEN_FLAG = 'analytics-consent-prompted'

/**
 * Sprint 18 US-145 — a single, explicit opt-in prompt, shown once. Default
 * is OFF; declining or dismissing leaves it off. This is intentionally
 * separate from crash reporting (Sprint 12) and from the permission/feature
 * tours (Sprint 12/17) — the user can want one without the other.
 */
export function AnalyticsConsentDialog() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    window.api.getHintsState().then(({ dismissed }) => {
      if (!dismissed.includes(CONSENT_SEEN_FLAG)) setVisible(true)
    })
  }, [])

  if (!visible) return null

  function choose(enabled: boolean) {
    window.api.setAnalyticsConsent(enabled)
    window.api.dismissHint(CONSENT_SEEN_FLAG)
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center">
      <div className="w-[440px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Help improve the app?</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
          You can share anonymous usage data — which features get used, whether exports succeed, and basic app/OS version. This is off by default; you can turn it on or off anytime in Settings (⌘,).
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="font-medium text-emerald-300 mb-1.5">We collect</p>
            <ul className="text-[var(--text-secondary)] space-y-1 leading-relaxed">
              <li>• Which features you use</li>
              <li>• Export success/failure + config (codec, aspect ratio)</li>
              <li>• App version and OS</li>
            </ul>
          </div>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="font-medium text-red-300 mb-1.5">We never collect</p>
            <ul className="text-[var(--text-secondary)] space-y-1 leading-relaxed">
              <li>• Video or audio content</li>
              <li>• Annotation/comment text</li>
              <li>• Real file paths or screenshots</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => choose(false)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-3 py-1.5">
            No thanks
          </button>
          <button onClick={() => choose(true)} className="btn-primary text-xs px-3 py-1.5">
            Share anonymous usage data
          </button>
        </div>
      </div>
    </div>
  )
}
