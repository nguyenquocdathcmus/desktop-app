import { useEffect, useState } from 'react'

/**
 * Sprint 17 US-141 — shown once after an auto-update installs a version that
 * has a curated entry in the main process's CHANGELOG map (see
 * app-handlers.ts). Deliberately not the full technical changelog — a short
 * user-facing highlight list, or nothing at all for versions with no entry.
 */
export function WhatsNewPanel() {
  const [entry, setEntry] = useState<{ version: string; items: string[] } | null>(null)

  useEffect(() => {
    window.api.getChangelogEntry().then(setEntry)
  }, [])

  if (!entry) return null

  function dismiss() {
    window.api.ackChangelog(entry!.version)
    setEntry(null)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center">
      <div className="w-[420px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">What's New</h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">Version {entry.version}</p>
        <ul className="flex flex-col gap-2 mb-5">
          {entry.items.map((item) => (
            <li key={item} className="text-sm text-[var(--text-primary)] leading-relaxed flex gap-2">
              <span className="text-indigo-400 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button onClick={dismiss} className="btn-primary text-xs">Got it</button>
        </div>
      </div>
    </div>
  )
}
