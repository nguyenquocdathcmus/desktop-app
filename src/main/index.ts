import { app, BrowserWindow, ipcMain, shell, screen, protocol, net, Menu } from 'electron'
import { pathToFileURL } from 'url'

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([{
  scheme: 'safe-file',
  privileges: { bypassCSP: true, supportFetchAPI: true, stream: true, secure: true }
}])
import { join } from 'path'
import { registerRecordingHandlers } from './ipc/recording-handlers'
import { registerProjectHandlers } from './ipc/project-handlers'
import { registerExportHandlers } from './ipc/export-handlers'
import { registerRecordingsListHandler } from './ipc/recordings-list-handler'
import { registerProxyHandlers } from './ipc/proxy-handlers'
import { registerAnalyticsHandlers } from './ipc/analytics-handlers'
import { registerPublishHandlers } from './ipc/publish-handlers'
import { registerAudioHandlers } from './ipc/audio-handlers'
import { registerPresetsHandlers, registerShareHandlers, registerTemplatesHandlers } from './ipc/presets-handlers'
import { registerFaceHandlers } from './ipc/face-handlers'
import { registerNotificationDetectHandlers } from './ipc/notification-detect-handlers'
import { registerTranscriptHandlers } from './ipc/transcript-handlers'
import { registerReviewPageHandlers } from './ipc/review-page-handlers'
import { registerLocaleHandlers } from './ipc/locale-handlers'
import { registerThemeHandlers } from './ipc/theme-handlers'
import { registerUpdateHandlers } from './ipc/update-handlers'
import { registerAppHandlers, confirmQuitDuringExport } from './ipc/app-handlers'
import { readPillPosition, writePillPosition } from './recording/pillPosition'
import { createTray, registerGlobalRecordingShortcut, unregisterGlobalRecordingShortcut } from './tray'
import { readShortcutPreference, writeShortcutPreference } from './recording/shortcutPreference'
import { killExportOnQuit, isExportInProgress } from './ipc/export-handlers'
import { session as recordingSession } from './recording/RecordingSession'
import { registerAuthHandlers } from './ipc/auth-handlers'
import { authService } from './auth/AuthService'
import { registerBillingHandlers } from './ipc/billing-handlers'
import { IPC } from '../shared/constants'

const isDev = process.env.NODE_ENV === 'development'

// Sprint 15 US-127 — "Copy timestamp link" registers a custom protocol so a
// colleague with the same app + access to the same project path (shared over
// a network drive/cloud sync, not a real server) can click a link and land on
// the exact playhead position instead of opening the file and scrubbing by
// hand. Deliberately not real collaboration infra — see SPRINT_15.md.
if (!isDev) app.setAsDefaultProtocolClient('recordscreen')

let pendingDeepLink: { projectPath: string; t: number } | null = null

function parseDeepLink(url: string): { projectPath: string; t: number } | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'recordscreen:') return null
    const projectPath = parsed.searchParams.get('path')
    const t = parseFloat(parsed.searchParams.get('t') ?? '0')
    if (!projectPath) return null
    return { projectPath, t: Number.isFinite(t) ? t : 0 }
  } catch {
    return null
  }
}

/** Sprint 28 US-213 — Supabase's OAuth authorize endpoint redirects the
 *  system browser back here with `?code=...` after the user completes
 *  sign-in with the provider. Checked before parseDeepLink's project-link
 *  parsing since it's a different link shape (host, not a path/t pair). */
function handleAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'recordscreen:' || parsed.hostname !== 'auth-callback') return false
    const code = parsed.searchParams.get('code')
    if (!code) return false
    authService.completeOAuthFromCallback(code).then((result) => {
      if (!result.ok) console.error('[auth] OAuth callback failed:', result.error)
      editorWindow?.show()
      editorWindow?.focus()
    })
    return true
  } catch {
    return false
  }
}

function handleDeepLink(url: string): void {
  if (handleAuthCallback(url)) return
  const link = parseDeepLink(url)
  if (!link) return
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.webContents.send('app:open-deep-link', link)
    editorWindow.show()
    editorWindow.focus()
  } else {
    pendingDeepLink = link
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

let editorWindow: BrowserWindow | null = null
let controlsWindow: BrowserWindow | null = null
// Sprint 23 US-178 — only persist window `moved` events to disk while the
// controls window is actually in pill shape; the full panel's centered
// position isn't something we want to remember/restore (it should always
// re-center, only the pill's dragged spot is a real user preference).
let controlsIsPill = false
let webcamWindow: BrowserWindow | null = null

function createWebcamWindow(deviceId?: string): void {
  if (webcamWindow && !webcamWindow.isDestroyed()) {
    webcamWindow.focus()
    return
  }

  const primary = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = primary.workAreaSize
  const SIZE = 180

  webcamWindow = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    x: sw - SIZE - 24,
    y: sh - SIZE - 24,
    resizable: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    hasShadow: true,
    show: false,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Allow camera access in this window
  webcamWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') callback(true)
    else callback(false)
  })

  webcamWindow.setAspectRatio(1)
  webcamWindow.on('ready-to-show', () => webcamWindow?.show())
  webcamWindow.on('closed', () => { webcamWindow = null })

  const hash = `webcam${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''}`
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    webcamWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    webcamWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function createEditorWindow(): void {
  editorWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev  // allow file:// & custom protocols in dev (localhost origin)
    }
  })

  editorWindow.on('ready-to-show', () => {
    editorWindow?.show()
    if (isDev) editorWindow?.webContents.openDevTools({ mode: 'detach' })
    if (pendingDeepLink) {
      editorWindow?.webContents.send('app:open-deep-link', pendingDeepLink)
      pendingDeepLink = null
    }
  })

  editorWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // The controls window and webcam float are helper windows for the editor —
  // closing Home (the main window) with them left open stranded two windows
  // with no way back to Home to reopen them. Bring them down together,
  // unless a recording is actually in progress (that window owns the only
  // Stop button — closing everything mid-recording would strand it running
  // with no UI to stop it, same guard as the HomeScreen show/hide toggle).
  editorWindow.on('close', (event) => {
    if (recordingSession.status.state === 'recording' || recordingSession.status.state === 'paused') {
      event.preventDefault()
      controlsWindow?.show()
      controlsWindow?.focus()
      return
    }
    if (controlsWindow && !controlsWindow.isDestroyed()) controlsWindow.close()
    if (webcamWindow && !webcamWindow.isDestroyed()) webcamWindow.close()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    editorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    editorWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createControlsWindow(): void {
  controlsWindow = new BrowserWindow({
    width: 380,
    height: 452,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    show: false,
    transparent: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  controlsWindow.on('ready-to-show', () => {
    controlsWindow?.show()
  })

  controlsWindow.on('closed', () => { controlsWindow = null })

  // Sprint 23 US-178 — save the pill's dragged position as the user moves it.
  // Debounced with a trailing timer since `move` fires continuously during a
  // drag; we only care about where it ends up, not every intermediate frame.
  let moveSaveTimer: ReturnType<typeof setTimeout> | null = null
  controlsWindow.on('moved', () => {
    if (!controlsIsPill || !controlsWindow) return
    if (moveSaveTimer) clearTimeout(moveSaveTimer)
    moveSaveTimer = setTimeout(() => {
      if (!controlsWindow || controlsWindow.isDestroyed()) return
      const { x, y } = controlsWindow.getBounds()
      writePillPosition({ x, y })
    }, 300)
  })

  const controlsUrl = isDev && process.env['ELECTRON_RENDERER_URL']
    ? `${process.env['ELECTRON_RENDERER_URL']}#/controls`
    : join(__dirname, '../renderer/index.html')

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    controlsWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#controls`)
  } else {
    controlsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'controls' })
  }
}

/** Standard macOS app menu (Sprint 12 US-106) — Cmd+N new recording (focuses the
 *  controls window, which already owns the Start button), Cmd+, no-op placeholder
 *  for a future Settings window, plus the usual Edit/Window/Help menus Electron
 *  doesn't provide unless you build them yourself. */
function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => editorWindow?.webContents.send('app:open-settings')
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Recording',
          accelerator: 'CmdOrCtrl+N',
          click: () => { controlsWindow?.show(); controlsWindow?.focus() }
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ role: 'front' as const }] : [])]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => editorWindow?.webContents.send('app:open-shortcuts-overlay')
        },
        {
          label: 'Show Tour Again',
          click: () => editorWindow?.webContents.send('app:restart-tour')
        },
        { type: 'separator' },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('mailto:feedback@example.com?subject=Record%20Screen%20Feedback')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Serve local files via safe-file:// protocol (bypasses CSP/web security)
  protocol.handle('safe-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('safe-file://', ''))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Register all IPC handlers
  registerRecordingHandlers(ipcMain)
  registerProjectHandlers(ipcMain)
  registerExportHandlers(ipcMain)
  registerRecordingsListHandler(ipcMain)
  registerProxyHandlers(ipcMain)
  registerAnalyticsHandlers(ipcMain)
  registerPublishHandlers(ipcMain)
  registerAudioHandlers(ipcMain)
  registerPresetsHandlers(ipcMain)
  registerShareHandlers(ipcMain)
  registerTemplatesHandlers(ipcMain)
  registerFaceHandlers(ipcMain)
  registerNotificationDetectHandlers(ipcMain)
  registerTranscriptHandlers(ipcMain)
  registerReviewPageHandlers(ipcMain)
  registerLocaleHandlers(ipcMain)
  registerThemeHandlers(ipcMain)
  registerUpdateHandlers(ipcMain)
  registerAppHandlers(ipcMain)
  registerAuthHandlers(ipcMain, () => editorWindow)
  registerBillingHandlers(ipcMain)
  authService.restoreSession().catch((err) => console.error('[auth] restoreSession failed:', err))
  buildAppMenu()

  // Ping/pong for dev testing
  ipcMain.handle(IPC.PING, () => 'pong')

  // Focus editor window (called after recording stops)
  ipcMain.on('editor:focus', () => {
    editorWindow?.show()
    editorWindow?.focus()
  })

  // Sprint 27 follow-up — Settings was only reachable via the app menu
  // (Cmd+, or "Screen Studio > Settings…"), with no button anywhere in the
  // UI itself, which is exactly the discoverability gap the user hit. This
  // lets a UI button (HomeScreen toolbar) trigger the same open-settings
  // event the menu item already sends, instead of duplicating that logic.
  ipcMain.on('settings:request-open', () => {
    editorWindow?.webContents.send('app:open-settings')
  })

  // Reveal file in Finder
  ipcMain.on('shell:showInFolder', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // Webcam float window
  ipcMain.on('webcam:open', (_, { deviceId }: { deviceId?: string }) => {
    createWebcamWindow(deviceId)
  })
  ipcMain.on('webcam:close', () => {
    if (webcamWindow && !webcamWindow.isDestroyed()) webcamWindow.close()
    webcamWindow = null
  })

  // Sprint 27 follow-up — HomeScreen's toolbar toggle to show/hide the
  // recording controls window on demand, instead of it being permanently
  // visible from app launch with no way to dismiss it. Hides rather than
  // closes/destroys so its React state (selected source, devices, etc.)
  // survives being toggled off and back on. Refuses to hide mid-recording —
  // that window owns the only Stop button, so hiding it would strand an
  // active recording with no way to end it from the UI.
  ipcMain.handle('controls:setVisible', (_, visible: boolean) => {
    if (!controlsWindow || controlsWindow.isDestroyed()) return false
    if (!visible && (recordingSession.status.state === 'recording' || recordingSession.status.state === 'paused')) {
      return false
    }
    if (visible) {
      controlsWindow.show()
      controlsWindow.focus()
    } else {
      controlsWindow.hide()
    }
    return true
  })
  ipcMain.handle('controls:isVisible', () => {
    return !!controlsWindow && !controlsWindow.isDestroyed() && controlsWindow.isVisible()
  })

  // Controls window shape — the recorder collapses from the full source-picker
  // panel down to a small QuickTime-style pill once recording/countdown starts,
  // and grows back when stopped. Resize happens in main since only it can
  // resize a BrowserWindow; renderer just declares which mode it's in.
  ipcMain.on('controls:setMode', (_, mode: 'panel' | 'pill') => {
    if (!controlsWindow || controlsWindow.isDestroyed()) return
    const bounds = controlsWindow.getBounds()
    if (mode === 'pill') {
      const pillWidth = 232
      const pillHeight = 44
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
      const { x: wx, y: wy, width: ww, height: wh } = display.workArea

      // Sprint 23 US-178 — restore the last dragged spot if one was saved,
      // clamped into the current display's work area (handles the display
      // having changed resolution, or a secondary monitor disappearing,
      // since the last time the pill was moved).
      const saved = readPillPosition()
      const x = saved
        ? Math.min(Math.max(saved.x, wx), wx + ww - pillWidth)
        : wx + Math.round((ww - pillWidth) / 2)
      const y = saved
        ? Math.min(Math.max(saved.y, wy), wy + wh - pillHeight)
        : wy + 14

      controlsWindow.setResizable(true)
      controlsWindow.setBounds({ x, y, width: pillWidth, height: pillHeight })
      controlsWindow.setResizable(false)
      controlsIsPill = true
    } else {
      const panelWidth = 380
      const panelHeight = 452
      const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
      const { x: wx, y: wy, width: ww, height: wh } = display.workArea
      controlsIsPill = false
      controlsWindow.setResizable(true)
      controlsWindow.setBounds({
        x: wx + Math.round((ww - panelWidth) / 2),
        y: wy + Math.round((wh - panelHeight) / 2),
        width: panelWidth,
        height: panelHeight
      })
      controlsWindow.setResizable(false)
    }
  })

  createEditorWindow()
  createControlsWindow()
  createTray()

  // Sprint 23 US-180 — restore a previously-set global shortcut, if any. No
  // default accelerator is registered otherwise (see shortcutPreference.ts).
  const savedShortcut = readShortcutPreference()
  if (savedShortcut) registerGlobalRecordingShortcut(savedShortcut)

  ipcMain.handle('recording:get-shortcut', () => readShortcutPreference())
  ipcMain.handle('recording:set-shortcut', (_, accelerator: string | null) => {
    unregisterGlobalRecordingShortcut()
    if (!accelerator) {
      writeShortcutPreference(null)
      return { ok: true as const }
    }
    const { ok } = registerGlobalRecordingShortcut(accelerator)
    if (ok) writeShortcutPreference(accelerator)
    else writeShortcutPreference(null)
    return { ok }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createEditorWindow()
      createControlsWindow()
    }
  })
})

app.on('will-quit', () => {
  unregisterGlobalRecordingShortcut()
  // Never let a capture/cursor-tracker child process outlive the app. Real
  // bug found: RecordingSession.start() spawns `capture` before it can ever
  // emit 'started' (waiting on ScreenCaptureKit's TCC permission dialog, or
  // killed mid-dev-reload); nothing previously killed that child on quit —
  // `stop()` only acts from the recording/paused states, so a process stuck
  // during the 'ready' window was orphaned forever, then blocked every future
  // recording attempt since ScreenCaptureKit allows only one active session
  // AND session.start() itself refuses to run again while state != 'idle'.
  // Fire-and-forget is fine here (unlike RECORDING_START's await) — will-quit
  // just needs the SIGTERM sent before the app process itself exits, not to
  // block quitting on the child's teardown.
  recordingSession.reset().catch(() => {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Never let an export ffmpeg process outlive the app — a stuck/slow filter
// (e.g. per-pixel geq masks) can otherwise keep consuming CPU/GPU indefinitely
// in the background, which has been observed to corrupt the VideoToolbox
// hardware encoder session and break subsequent recordings.
//
// Sprint 12 US-106: if an export is in flight, confirm before killing it —
// quitting silently mid-export used to just produce a truncated, unusable file.
let quitConfirmed = false
app.on('before-quit', (event) => {
  if (quitConfirmed) return
  if (!isExportInProgress()) {
    killExportOnQuit()
    return
  }
  event.preventDefault()
  confirmQuitDuringExport(true).then((proceed) => {
    if (!proceed) return
    quitConfirmed = true
    killExportOnQuit()
    app.quit()
  })
})

// editorWindow and controlsWindow are module-level singletons — accessed via getters if needed
