import { useAccountPanelStore } from '../../../store/useAccountPanelStore'

/** Sprint 30 follow-up — placeholder shown instead of a sidebar panel whose
 *  feature is Pro-only on the current plan. One shared look so every locked
 *  panel reads the same and funnels to the same upgrade path. */
export function ProLockedPanel({ title, description }: { title: string; description: string }) {
  const openAccountPanel = useAccountPanelStore((s) => s.openPanel)

  return (
    <div className="panel">
      <p className="label mb-2">{title}</p>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-4 text-center">
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">🔒 {description}</p>
        <button
          onClick={openAccountPanel}
          className="mt-3 w-full text-xs font-medium bg-indigo-500 hover:bg-indigo-400 text-white rounded-md px-3 py-1.5 transition-colors"
        >
          Nâng cấp lên Pro
        </button>
      </div>
    </div>
  )
}
