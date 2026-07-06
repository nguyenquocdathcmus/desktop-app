import { Tray, Menu, BrowserWindow, globalShortcut, app } from 'electron'
import { session } from './recording/RecordingSession'
import { createTrayIcon } from './trayIcon'

let tray: Tray | null = null

function getControlsWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().includes('#controls'))
}

function requestToggle(): void {
  const win = getControlsWindow()
  if (!win) return
  win.show()
  win.focus()
  win.webContents.send('recording:toggle-requested')
}

function buildMenu(): Menu {
  const isRecording = session.status.state === 'recording' || session.status.state === 'paused'
  return Menu.buildFromTemplate([
    {
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      click: requestToggle
    },
    { type: 'separator' },
    {
      label: 'Open Screen Studio',
      click: () => {
        const win = getControlsWindow()
        win?.show()
        win?.focus()
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
}

/**
 * Sprint 23 US-179 — a persistent menu bar item so the app doesn't require
 * hunting for the controls window every time; also gives a quick-start path
 * without opening the full panel first. Click toggles the tray context menu
 * (standard macOS tray behavior); no separate "click vs right-click" split
 * since a single unified menu is simpler and matches most macOS menu bar apps.
 */
export function createTray(): void {
  if (tray) return
  tray = new Tray(createTrayIcon(false))
  tray.setToolTip('Screen Studio')
  tray.setContextMenu(buildMenu())

  session.onStatusChange((status) => {
    if (!tray) return
    const recording = status.state === 'recording'
    tray.setImage(createTrayIcon(recording))
    tray.setContextMenu(buildMenu())
  })
}

/**
 * Sprint 23 US-180 — global start/stop shortcut, registered only while no
 * other app owns the combination (Electron silently no-ops registration
 * conflicts, so we verify and report back rather than pretending it worked).
 */
export function registerGlobalRecordingShortcut(accelerator: string): { ok: boolean } {
  globalShortcut.unregisterAll()
  const ok = globalShortcut.register(accelerator, requestToggle)
  return { ok }
}

export function unregisterGlobalRecordingShortcut(): void {
  globalShortcut.unregisterAll()
}
