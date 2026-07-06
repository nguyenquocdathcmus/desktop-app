import { IpcMain, app, screen, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { IPC } from '../../shared/constants'
import { binPath } from '../binPath'
import { session } from '../recording/RecordingSession'
import { generateProxyInBackground } from './proxy-handlers'
import {
  checkAndRequestRecordingPermissions,
  requestAccessibilityPermission,
  requestMicrophonePermission,
  requestCameraPermission,
  getScreenRecordingStatus,
  requestScreenRecordingPermission
} from '../permissions'
import type { StartOptions, DisplayInfo, WindowInfo } from '../../shared/ipc-types'

// Broadcast recording status to ALL windows (Editor + Controls share same event)
function broadcastStatus() {
  session.onStatusChange((status) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(IPC.RECORDING_STATUS, status)
    })
  })
}

function getEditorWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find((w) => {
    if (w.isDestroyed()) return false
    const url = w.webContents.getURL()
    return !url.includes('#controls') && !url.includes('#webcam')
  })
}

export function registerRecordingHandlers(ipcMain: IpcMain): void {
  // Register status broadcaster immediately — not just on first RECORDING_START
  broadcastStatus()

  // Window list comes from the capture binary's --list-windows mode (SCShareableContent),
  // NOT Electron's desktopCapturer — its "window:ID:..." ids don't reliably match the
  // CGWindowIDs ScreenCaptureKit captures by, which made window-mode silently record
  // the full screen when the lookup missed.
  ipcMain.handle(IPC.RECORDING_GET_WINDOWS, (): Promise<WindowInfo[]> => {
    return new Promise((resolve) => {
      const proc = spawn(binPath('capture'), ['--list-windows'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined }
      })
      let out = ''
      proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
      proc.on('close', () => {
        try {
          for (const line of out.split('\n')) {
            if (!line.trim()) continue
            const e = JSON.parse(line)
            if (e.event === 'windows' && Array.isArray(e.windows)) {
              resolve((e.windows as WindowInfo[]).filter((w) => w.appName !== 'Electron'))
              return
            }
          }
        } catch { /* fall through */ }
        resolve([])
      })
      proc.on('error', () => resolve([]))
      setTimeout(() => proc.kill(), 8_000)
    })
  })

  ipcMain.handle(IPC.RECORDING_GET_DISPLAYS, (): DisplayInfo[] => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      name: d.label || `Display ${d.id}`,
      width: d.bounds.width,
      height: d.bounds.height,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === screen.getPrimaryDisplay().id,
      x: d.bounds.x,
      y: d.bounds.y,
      refreshRate: Math.round(d.displayFrequency || 60),
      supportsHDR: d.depthPerComponent >= 10
    }))
  })

  ipcMain.handle('permissions:check', async () => {
    return checkAndRequestRecordingPermissions()
  })

  ipcMain.handle('permissions:request-accessibility', async () => {
    return requestAccessibilityPermission()
  })

  ipcMain.handle('permissions:request-camera', async () => {
    return requestCameraPermission()
  })

  const PRIVACY_PANES: Record<string, string> = {
    microphone: 'Privacy_Microphone',
    camera: 'Privacy_Camera',
    screen: 'Privacy_ScreenCapture'
  }
  ipcMain.on('permissions:open-settings', (_, pane: 'microphone' | 'camera' | 'screen') => {
    shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${PRIVACY_PANES[pane] ?? PRIVACY_PANES.screen}`)
  })

  ipcMain.handle(IPC.RECORDING_START, async (_, opts: StartOptions) => {
    // Real bug fixed here: this used to only reset from 'done'/'idle', so any
    // session stuck in 'ready' (start() spawned the capture binary but it
    // never emitted 'started' — e.g. because it's blocked waiting on the
    // ScreenCaptureKit permission dialog, or was orphaned by a dev/HMR
    // reload) permanently refused every future start() call with "Cannot
    // start: session is ready", with no way to recover short of quitting the
    // whole app. A genuine new start request always means "abandon whatever
    // came before" — reset from ANY non-idle state, not just done/idle.
    if (session.status.state !== 'idle') {
      await session.reset()
    }

    // Real bug fixed here: if Screen Recording permission was explicitly
    // denied, spawning the capture binary anyway means ScreenCaptureKit's
    // SCShareableContent call fails/hangs deep inside the Swift process with
    // no way for the user to fix it short of quitting the app — fail fast
    // with a clear, actionable message instead. ('not-determined' is left to
    // proceed as before: Electron has no API to await the screen-recording
    // prompt itself (askForMediaAccess only covers microphone/camera), so the
    // capture binary triggering ScreenCaptureKit's own prompt is still the
    // only way to ask — but RecordingSession.start()'s timeout + reset() above
    // now reliably recovers if the user doesn't respond to it in time.)
    if (getScreenRecordingStatus() === 'denied') {
      await requestScreenRecordingPermission()
      return { ok: false, error: 'Screen Recording permission is required — enable it in System Settings → Privacy & Security → Screen Recording, then try again.' }
    }

    // Mic is captured separately in the renderer regardless of system-audio capture mode,
    // so always request microphone permission up front rather than gating on captureAudio.
    await requestMicrophonePermission()

    if (opts.webcamEnabled) await requestCameraPermission()

    const hasAccessibility = await requestAccessibilityPermission()
    if (!hasAccessibility) {
      console.warn('Accessibility not granted — cursor tracking disabled')
    }

    // Synthetic cursor (Sprint 10): only hide the system cursor from the capture
    // when cursor tracking will actually work — otherwise the video would have
    // no cursor at all and nothing to redraw it from.
    return session.start({ ...opts, hideCursor: hasAccessibility })
  })

  ipcMain.handle(IPC.RECORDING_STOP, async () => {
    const result = await session.stop()

    if (result.ok) {
      const { manifest } = result
      console.log('[STOP] manifest:', manifest.videoPath, 'duration:', manifest.duration.toFixed(1) + 's')

      // Sprint 16 US-131 — kick off proxy generation now; it renders in the
      // background and does not block the editor from opening with the original.
      generateProxyInBackground(manifest.videoPath)

      // Give renderer time to process the 'done' broadcast before stealing focus
      setTimeout(() => {
        const editor = getEditorWindow()
        console.log('[STOP] editor window found:', !!editor, editor?.webContents.getURL())
        if (editor) {
          app.focus({ steal: true })
          editor.show()
          editor.focus()
          // Re-send 'done' status directly to editor in case broadcast was missed
          editor.webContents.send(IPC.RECORDING_STATUS, { state: 'done', manifest })
        }
      }, 300)
    } else {
      console.error('[STOP] failed:', result.error)
    }

    return result
  })

  ipcMain.handle(IPC.RECORDING_PAUSE, () => session.pause())
  ipcMain.handle(IPC.RECORDING_RESUME, () => session.resume())

  ipcMain.handle(IPC.RECORDING_GET_STATUS, () => session.status)

  // Save mic audio blob from renderer → disk (called before stopRecording).
  // leadMs is how much earlier the mic MediaRecorder started vs. the Swift capture
  // binary — trimmed off during mux so mic doesn't drift ahead of video.
  ipcMain.handle('recording:save-mic-audio', async (_, data: Uint8Array, leadMs: number) => {
    try {
      session.saveMicAudio(Buffer.from(data), leadMs)
    } catch (e) {
      console.error('[mic] save failed:', e)
    }
  })

  // Save webcam video blob from the webcam window → disk (recorded in lockstep with capture)
  ipcMain.handle('recording:save-webcam-video', async (_, data: Uint8Array) => {
    try {
      session.saveWebcamVideo(Buffer.from(data))
    } catch (e) {
      console.error('[webcam] save failed:', e)
    }
  })
}
