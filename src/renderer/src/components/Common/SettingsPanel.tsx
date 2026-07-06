import { useEffect, useState } from 'react'
import { useT } from '../../hooks/useT'
import { useLocaleStore } from '../../store/useLocaleStore'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type LocaleCode } from '../../../../shared/locales'

/** Sprint 18 US-145 — first real Settings surface in the app (⌘,). Sprint 27
 *  US-207/US-209 added the language and appearance (theme) pickers, and
 *  later trimmed this back down to just language — analytics consent, the
 *  global recording shortcut, and publish-destination connections all moved
 *  out per user feedback that this panel had gotten too busy. Sprint 28's
 *  account/billing section also moved out into its own AccountPanel.tsx +
 *  toolbar button, per feedback that bundling "am I logged in" under a
 *  general gear icon made it too easy to miss.
 *
 *  The Appearance/theme picker is hidden for now (not removed): the CSS
 *  variables and refactored components from US-209 only cover HomeScreen,
 *  Settings, and a first pass over the Editor's main surfaces — enough
 *  isn't verified yet to expose Light/System as real user-facing options
 *  without risking exactly the "half dark, half light" inconsistency this
 *  was meant to fix. useThemeStore/theme-handlers.ts are left in place;
 *  re-enabling this is restoring the toggle block below, once the
 *  remaining hardcoded-color sweep is actually finished. */
export function SettingsPanel() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { locale, setLocale } = useLocaleStore()

  useEffect(() => window.api.onOpenSettings(() => {
    setOpen(true)
  }), [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div role="dialog" aria-modal="true" aria-label={t('settings.title')} className="w-[420px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t('settings.title')}</h2>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors">✕</button>
        </div>

        {/* Language (Sprint 27 US-207) */}
        <div className="py-2">
          <p className="text-sm text-[var(--text-primary)] mb-1">{t('settings.language')}</p>
          <p className="text-xs text-[var(--text-secondary)] mb-2 leading-relaxed">{t('settings.languageHint')}</p>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as LocaleCode)}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/50"
          >
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
            ))}
          </select>
        </div>

        {/* Appearance/theme picker temporarily hidden — see file header comment. */}
      </div>
    </div>
  )
}
