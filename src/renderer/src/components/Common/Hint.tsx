import { useEffect } from 'react'
import { useHintsStore } from '../../store/useHintsStore'

interface Props {
  id: string
  /** Whether the triggering condition for this hint is currently true. */
  active: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Sprint 17 US-139 — a one-time "did you know" popover. Renders only while
 * `active` is true AND the hint hasn't been dismissed before (in this project
 * or any other — dismissal is global, see useHintsStore).
 */
export function Hint({ id, active, children, className }: Props) {
  const { loaded, load, dismiss, isDismissed } = useHintsStore()

  useEffect(() => { load() }, [load])

  if (!loaded || !active || isDismissed(id)) return null

  return (
    <div
      role="status"
      className={`flex items-start gap-2 text-[11px] text-indigo-200 bg-indigo-500/10 border border-indigo-500/25 rounded-lg px-2.5 py-2 ${className ?? ''}`}
    >
      <span className="flex-1">{children}</span>
      <button
        onClick={() => dismiss(id)}
        aria-label="Dismiss tip"
        className="shrink-0 text-indigo-300/70 hover:text-indigo-100 transition-colors"
      >
        ✕
      </button>
    </div>
  )
}
