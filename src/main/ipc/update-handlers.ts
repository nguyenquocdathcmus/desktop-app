import { IpcMain, BrowserWindow, app } from 'electron'

/**
 * electron-updater integration (Sprint 12 US-099). GitHub Releases is the
 * publish target (configured in electron-builder.yml `publish:` — not added
 * here since it needs the real repo owner/name filled in before release).
 *
 * Checks are a no-op in dev (unpackaged) builds — there is no signed release
 * to compare against, and autoUpdater throws immediately outside a packaged app.
 */
export function registerUpdateHandlers(ipcMain: IpcMain): void {
  if (!app.isPackaged) {
    // Still answer the renderer's status query so the UI doesn't hang waiting.
    ipcMain.handle('update:check', async () => ({ status: 'dev-skipped' as const }))
    ipcMain.handle('update:install', () => {})
    return
  }

  // Lazy import: electron-updater touches app paths at module load time that
  // aren't valid until the app is packaged.
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  const broadcast = (channel: string, payload?: unknown) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(channel, payload)
    })
  }

  autoUpdater.on('update-available', (info: { version: string }) => {
    broadcast('update:available', { version: info.version })
    autoUpdater.downloadUpdate().catch((err: Error) => {
      console.error('[update] download failed:', err)
    })
  })

  autoUpdater.on('update-downloaded', (info: { version: string }) => {
    broadcast('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err: Error) => {
    console.error('[update] error:', err)
  })

  ipcMain.handle('update:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
      return { status: 'checked' as const }
    } catch (err) {
      return { status: 'error' as const, message: String(err) }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Check once shortly after launch — not blocking startup, and staggered so
  // it doesn't compete with initial window paint.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: Error) => console.error('[update] initial check failed:', err))
  }, 10_000)
}
