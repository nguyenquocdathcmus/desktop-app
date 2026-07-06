import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getCommands, subscribeCommands } from '../../commands'
import { useFocusTrap } from '../../hooks/useFocusTrap'

/**
 * Sprint 17 US-138 — full shortcuts reference, opened with ⌘/. Reads from the
 * same command registry `⌘K` uses (`commands.ts`) so the two never drift.
 * A handful of Timeline shortcuts are context-dependent (need a playhead
 * position) and aren't meaningfully "runnable" from a palette, so they're
 * listed here as static reference entries alongside the live registry.
 */
const STATIC_SHORTCUTS: { label: string; group: 'Playback' | 'Editing' | 'Export' | 'Timeline'; keys: string }[] = [
  { label: 'Split clip at playhead', group: 'Timeline', keys: 'S' },
  { label: 'Set in point', group: 'Timeline', keys: '[' },
  { label: 'Set out point', group: 'Timeline', keys: ']' },
  { label: 'Step one frame', group: 'Timeline', keys: '← / →' },
  { label: 'Step one second', group: 'Timeline', keys: '⇧← / ⇧→' },
  { label: 'Command palette', group: 'Editing', keys: '⌘K' },
  { label: 'This shortcuts reference', group: 'Editing', keys: '⌘/' }
]

const GROUP_ORDER: Array<'Playback' | 'Editing' | 'Timeline' | 'Export'> = ['Playback', 'Editing', 'Timeline', 'Export']

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const commands = useSyncExternalStore(subscribeCommands, getCommands)

  useFocusTrap(containerRef, open)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Sprint 17 US-143 — Help menu "Keyboard Shortcuts" opens this overlay.
  useEffect(() => window.api.onOpenShortcutsOverlay(() => setOpen(true)), [])

  if (!open) return null

  const withKeys = commands.filter((c) => c.keys).map((c) => ({ label: c.label, group: c.group, keys: c.keys as string }))
  const all = [...withKeys, ...STATIC_SHORTCUTS]
  const byGroup = GROUP_ORDER.map((g) => ({ group: g, items: all.filter((c) => c.group === g) })).filter((g) => g.items.length > 0)

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-[520px] max-h-[70vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm px-1.5 rounded hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          {byGroup.map(({ group, items }) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] mb-1.5">{group}</p>
              <div className="flex flex-col gap-1">
                {items.map((c) => (
                  <div key={`${group}-${c.label}`} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-[var(--text-primary)]">{c.label}</span>
                    <kbd className="shrink-0 font-mono text-[10px] text-[var(--text-secondary)] bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{c.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
