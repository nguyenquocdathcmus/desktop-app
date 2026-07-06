import { useEffect, useState } from 'react'

/**
 * Sprint 12 US-099 — non-blocking banner for electron-updater. Downloads
 * happen silently in the background (main process); this only surfaces once
 * a downloaded update is actually ready to install, so it never interrupts
 * an in-progress recording/export with a modal.
 */
export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const unsub = window.api.onUpdateDownloaded(({ version }) => setVersion(version))
    return unsub
  }, [])

  if (!version) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl px-4 py-2.5">
      <span className="text-[12px] text-[var(--text-primary)]">
        Version {version} is ready to install
      </span>
      <button
        onClick={() => { setInstalling(true); window.api.installUpdate() }}
        disabled={installing}
        className="text-[12px] font-medium text-white bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 px-3 py-1 rounded-lg transition-colors"
      >
        {installing ? 'Restarting…' : 'Restart & Update'}
      </button>
      <button
        onClick={() => setVersion(null)}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm leading-none"
        title="Dismiss for now"
        aria-label="Dismiss update notification"
      >
        ×
      </button>
    </div>
  )
}
