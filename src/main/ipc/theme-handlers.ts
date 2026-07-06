import { IpcMain, app } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'

export type ThemePreference = 'dark' | 'light' | 'system'

function themePath(): string {
  return join(app.getPath('userData'), 'theme.json')
}

/**
 * Sprint 27 US-209 — persisted the same way as locale.json/analytics-consent.json.
 *
 * Temporarily forced to always return 'dark': the Appearance picker is
 * hidden in SettingsPanel.tsx because the light-theme refactor only covers
 * HomeScreen/Settings and a first pass over the Editor, not every surface —
 * exposing Light/System risked the exact "half dark, half light" look this
 * was meant to fix. This also resets anyone who toggled Light/System while
 * it was briefly available back to Dark on next launch, rather than leaving
 * them stuck on an inconsistent theme with no way to get back to it (the
 * picker that would undo it is gone). `theme:set` still writes the file —
 * once the remaining color sweep is done, deleting the two lines below
 * restores whatever preference is on disk.
 */
export function registerThemeHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('theme:get', (): ThemePreference => {
    return 'dark'
  })

  ipcMain.on('theme:set', (_, preference: ThemePreference) => {
    if (preference !== 'dark' && preference !== 'light' && preference !== 'system') return
    try { writeFileSync(themePath(), JSON.stringify({ preference })) } catch { /* best effort */ }
  })
}
