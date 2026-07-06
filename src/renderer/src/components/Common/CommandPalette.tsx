import { useEffect, useState, useSyncExternalStore } from 'react'
import { getCommands, subscribeCommands } from '../../commands'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useRef } from 'react'

/** Sprint 13 US-115 — quick action launcher, ⌘K. Reads from the same command
 *  registry that Sprint 17's shortcuts overlay will use, so the two never
 *  drift out of sync with separate hardcoded lists. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const commands = useSyncExternalStore(subscribeCommands, getCommands)

  useFocusTrap(containerRef, open)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[440px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command…"
          aria-label="Search commands"
          className="w-full h-11 px-4 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none border-b border-[var(--border)]"
        />
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] text-center py-4">No matching commands</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => { c.run(); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-[13px] text-[var(--text-primary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-colors flex items-center justify-between"
              >
                <span>{c.label}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{c.group}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
