import { create } from 'zustand'

/**
 * Sprint 17 US-139 — contextual first-use hints. Backed by a small JSON file
 * in userData (main process), so a dismissal is permanent across all
 * projects, not just the one open when the user dismissed it.
 */
interface HintsState {
  dismissed: Set<string>
  loaded: boolean
  load: () => Promise<void>
  dismiss: (id: string) => void
  isDismissed: (id: string) => boolean
}

export const useHintsStore = create<HintsState>((set, get) => ({
  dismissed: new Set(),
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      const { dismissed } = await window.api.getHintsState()
      set({ dismissed: new Set(dismissed), loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  dismiss: (id) => {
    set((s) => ({ dismissed: new Set(s.dismissed).add(id) }))
    window.api.dismissHint(id)
  },
  isDismissed: (id) => get().dismissed.has(id)
}))
