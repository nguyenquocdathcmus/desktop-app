import { create } from 'zustand'

export type AuthStatus =
  | { state: 'signedOut' }
  | { state: 'signedIn'; user: { id: string; email: string } }

/** Sprint 28 US-214 — mirrors useThemeStore/useLocaleStore's init pattern:
 *  read once at boot, then kept live via main's 'auth:status-changed' push
 *  (needed here, unlike theme/locale, because sign-in can complete
 *  asynchronously via the system-browser OAuth round trip while this window
 *  is already open — a one-shot read at boot would miss it). */
interface AuthStore {
  status: AuthStatus
  ready: boolean
  busy: boolean
  error: string | null
  _unsubscribeStatusChanged: (() => void) | null
  initAuth: () => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: { state: 'signedOut' },
  ready: false,
  busy: false,
  error: null,
  _unsubscribeStatusChanged: null,

  initAuth: async () => {
    try {
      const status = await window.api.getAuthStatus()
      set({ status, ready: true })
    } catch {
      set({ ready: true })
    }
    // Sprint 29 BUG-05 — onAuthStatusChanged() registers a new ipcRenderer
    // listener and returns an unsubscribe function; this used to be
    // discarded, so a repeat initAuth() call (HMR in dev, or any future
    // remount) would leak one listener per call, each still firing forever.
    // Unsubscribe any previous listener before registering a new one so at
    // most one is ever live regardless of how many times this runs.
    get()._unsubscribeStatusChanged?.()
    const unsubscribe = window.api.onAuthStatusChanged((status) => set({ status, busy: false }))
    set({ _unsubscribeStatusChanged: unsubscribe })
  },

  signUp: async (email, password) => {
    set({ busy: true, error: null })
    const result = await window.api.authSignUp(email, password)
    if (!result.ok) set({ busy: false, error: result.error })
    else set({ busy: false })
  },

  signIn: async (email, password) => {
    set({ busy: true, error: null })
    const result = await window.api.authSignIn(email, password)
    if (!result.ok) set({ busy: false, error: result.error })
    else set({ busy: false })
  },

  signInWithOAuth: async (provider) => {
    set({ busy: true, error: null })
    const result = await window.api.authSignInWithOAuth(provider)
    if (!result.ok) set({ busy: false, error: result.error })
    // else: stays busy until the system browser round trip finishes and
    // 'auth:status-changed' arrives (see initAuth's listener above).
  },

  signOut: async () => {
    set({ busy: true })
    await window.api.authSignOut()
    set({ busy: false })
  },

  clearError: () => set({ error: null })
}))
