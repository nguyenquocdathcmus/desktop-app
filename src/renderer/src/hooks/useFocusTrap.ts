import { useEffect, useRef } from 'react'

/**
 * Sprint 13 US-108 — traps Tab/Shift+Tab focus inside a modal while it's open,
 * and restores focus to whatever triggered it on close. Before this, Tab could
 * escape ExportModal into the underlying editor, and closing it left focus on
 * whatever the mouse happened to be over (or nowhere), which is disorienting
 * for keyboard/screen-reader users.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean): void {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusables = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      )

    // Focus the first focusable element once the modal is mounted.
    const first = focusables()[0]
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus()
    }
  }, [active, containerRef])
}
