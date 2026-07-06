import { IpcMain, BrowserWindow } from 'electron'
import { authService, type AuthStatus } from '../auth/AuthService'
import { invalidateEntitlements } from '../billing/entitlements'

/** Sprint 28 US-212/214 — auth IPC surface. All Supabase calls happen in
 *  AuthService (main process); renderer only ever sees AuthStatus, mirroring
 *  how RecordingStatus is broadcast for recording state. */
export function registerAuthHandlers(ipcMain: IpcMain, getEditorWindow: () => BrowserWindow | null): void {
  ipcMain.handle('auth:get-status', (): AuthStatus => authService.status)

  ipcMain.handle('auth:sign-up', (_, { email, password }: { email: string; password: string }) =>
    authService.signUpWithPassword(email, password)
  )

  ipcMain.handle('auth:sign-in', (_, { email, password }: { email: string; password: string }) =>
    authService.signInWithPassword(email, password)
  )

  ipcMain.handle('auth:sign-in-oauth', async (_, { provider }: { provider: 'google' | 'github' }) => {
    const result = await authService.buildOAuthUrl(provider)
    if (!result.ok) return result
    const { shell } = await import('electron')
    shell.openExternal(result.url)
    return { ok: true as const }
  })

  ipcMain.handle('auth:sign-out', async () => {
    await authService.signOut()
    return { ok: true }
  })

  authService.onStatusChange((status) => {
    // Sprint 30 US-220 — plan follows the signed-in user; don't let a Pro
    // user's cached entitlements survive into the next (or no) session.
    invalidateEntitlements()
    getEditorWindow()?.webContents.send('auth:status-changed', status)
  })
}
