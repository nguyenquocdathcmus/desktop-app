import { create } from 'zustand'

/** Sprint 28 follow-up — open/close state for the Account/Profile panel.
 *  Unlike SettingsPanel (which also opens via the app menu / Cmd+, from
 *  main process, so it needs the 'app:open-settings' IPC round trip), the
 *  Account panel only ever opens from the HomeScreen toolbar button, so a
 *  plain renderer-local store is enough — no IPC needed. */
interface AccountPanelStore {
  open: boolean
  openPanel: () => void
  closePanel: () => void
}

export const useAccountPanelStore = create<AccountPanelStore>((set) => ({
  open: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false })
}))
