import { create } from 'zustand'
import type { LocaleCode } from '../../../shared/locales'

/**
 * Sprint 27 US-206/207 — the active UI language. Persisted in main
 * (locale-handlers.ts) so it's consistent across the Editor and Controls
 * windows without each one independently reading/writing a file. Defaults
 * to 'en' until `initLocale()` resolves — App.tsx calls this once at boot,
 * same pattern as other main-backed one-shot startup reads in this codebase.
 */
interface LocaleStore {
  locale: LocaleCode
  ready: boolean
  setLocale: (locale: LocaleCode) => void
  initLocale: () => Promise<void>
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: 'en',
  ready: false,

  setLocale: (locale) => {
    set({ locale })
    window.api.setLocale(locale)
  },

  initLocale: async () => {
    try {
      const locale = await window.api.getLocale()
      set({ locale, ready: true })
    } catch {
      set({ ready: true }) // fall back to 'en', already the default
    }
  }
}))
