import { useProjectStore } from '../../store/useProjectStore'

/**
 * Sprint 26 US-198 — shown instead of silently overwriting when the project
 * file changed on disk since this app instance last opened/saved it (e.g. a
 * colleague's edited copy synced back via Drive/Dropbox). Modeled after
 * UpdateBanner's non-blocking bottom banner, but this one needs an explicit
 * choice rather than a dismiss — accidentally losing a colleague's edits is
 * worse than an update banner staying up.
 */
export function SaveConflictBanner() {
  const { saveConflict, resolveSaveConflict } = useProjectStore()

  if (!saveConflict) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 bg-[var(--bg-secondary)] border border-amber-500/40 rounded-xl shadow-2xl px-4 py-3 max-w-md">
      <p className="text-[12px] text-amber-300 font-medium">
        This project changed on disk since you opened it
      </p>
      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
        Someone (or another sync) modified this project's file elsewhere. Choose how to proceed — your current edits are still safe in memory.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => resolveSaveConflict('mergeComments')}
          className="flex-1 text-[11px] font-medium text-white bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          Keep both — merge comments
        </button>
        <button
          onClick={() => resolveSaveConflict('overwrite')}
          className="text-[11px] text-[var(--text-primary)] bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          Overwrite with mine
        </button>
        <button
          onClick={() => resolveSaveConflict('discardMine')}
          className="text-[11px] text-[var(--text-secondary)] hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          Discard mine, reload theirs
        </button>
      </div>
    </div>
  )
}
