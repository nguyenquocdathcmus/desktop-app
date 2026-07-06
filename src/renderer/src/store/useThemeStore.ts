import { create } from 'zustand'

export type ThemePreference = 'dark' | 'light' | 'system'

/**
 * Sprint 27 US-209 — mirrors useLocaleStore's pattern: persisted in main
 * (theme-handlers.ts), read once at boot per-window. `preference` is the
 * user's raw choice (including 'system'); App.tsx stamps `data-theme` on
 * <html> using this value directly — the actual light/dark resolution for
 * 'system' happens in CSS via `@media (prefers-color-scheme)` (globals.css),
 * not here, so it stays in sync if the OS theme changes while the app is open.
 */
interface ThemeStore {
  preference: ThemePreference
  ready: boolean
  setPreference: (preference: ThemePreference) => void
  initTheme: () => Promise<void>
}

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: 'dark',
  ready: false,

  setPreference: (preference) => {
    set({ preference })
    window.api.setThemePreference(preference)
  },

  initTheme: async () => {
    try {
      const preference = await window.api.getThemePreference()
      set({ preference, ready: true })
    } catch {
      set({ ready: true })
    }
  }
}))
