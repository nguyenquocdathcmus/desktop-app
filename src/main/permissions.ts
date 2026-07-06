import { systemPreferences, dialog, shell, app } from 'electron'

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

// ─── Screen Recording ─────────────────────────────────────────────────────────

export function getScreenRecordingStatus(): PermissionStatus {
  // macOS 10.15+ only
  if (process.platform !== 'darwin') return 'granted'
  return systemPreferences.getMediaAccessStatus('screen') as PermissionStatus
}

/**
 * Trigger the Screen Recording permission prompt from the main Electron process.
 * This makes "Screen Studio" (or "Electron" in dev) appear in System Settings,
 * NOT the "capture" binary.
 *
 * ScreenCaptureKit will also trigger a prompt when the binary first runs, but
 * requesting here first gives a better UX and shows the correct app name.
 */
export async function requestScreenRecordingPermission(): Promise<boolean> {
  const status = getScreenRecordingStatus()

  // Already granted — silent
  if (status === 'granted') return true

  // Explicitly denied by user — show dialog to guide them to System Settings
  if (status === 'denied') {
    await showPermissionDeniedDialog(
      'Screen Recording Denied',
      'Screen Recording was denied. Please enable it in:\nSystem Settings → Privacy & Security → Screen Recording → enable Screen Studio (or Electron in dev mode).'
    )
    return false
  }

  // 'not-determined' — the capture binary will trigger the system prompt
  // automatically via ScreenCaptureKit. Don't show our own dialog.
  return false
}

// ─── Accessibility ────────────────────────────────────────────────────────────

/**
 * Check + request Accessibility permission from the Electron main process.
 * This shows "Screen Studio" in System Settings instead of "cursor-tracker".
 */
export function getAccessibilityStatus(): boolean {
  if (process.platform !== 'darwin') return true
  // isTrustedAccessibilityClient(false) = check only, no prompt
  return systemPreferences.isTrustedAccessibilityClient(false)
}

export async function requestAccessibilityPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true

  // Already granted — silent return, don't show any dialog
  if (systemPreferences.isTrustedAccessibilityClient(false)) return true

  // Not granted yet — calling with `true` opens System Settings automatically.
  // macOS handles the UI; we don't need to show our own dialog on top.
  systemPreferences.isTrustedAccessibilityClient(true)

  // Return false — recording will still proceed, cursor tracking just disabled
  return false
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export async function requestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'granted') return true
  if (status === 'not-determined') {
    return systemPreferences.askForMediaAccess('microphone')
  }
  if (status === 'denied') {
    await showPermissionDeniedDialog(
      'Microphone Access Denied',
      'Microphone access was denied. Please enable it in:\nSystem Settings → Privacy & Security → Microphone → enable Screen Studio (or Electron in dev mode).',
      'Privacy_Microphone'
    )
  }
  return false
}

// ─── Camera ───────────────────────────────────────────────────────────────────

export function getCameraStatus(): PermissionStatus {
  if (process.platform !== 'darwin') return 'granted'
  return systemPreferences.getMediaAccessStatus('camera') as PermissionStatus
}

export async function requestCameraPermission(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const status = systemPreferences.getMediaAccessStatus('camera')
  if (status === 'granted') return true
  if (status === 'not-determined') {
    return systemPreferences.askForMediaAccess('camera')
  }
  if (status === 'denied') {
    await showPermissionDeniedDialog(
      'Camera Access Denied',
      'Camera access was denied. Please enable it in:\nSystem Settings → Privacy & Security → Camera → enable Screen Studio (or Electron in dev mode).',
      'Privacy_Camera'
    )
  }
  return false
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function showPermissionDeniedDialog(
  title: string,
  message: string,
  pane: string = 'Privacy_ScreenCapture'
): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title,
    message,
    buttons: ['Open System Settings', 'Cancel'],
    defaultId: 0,
    cancelId: 1
  })

  if (response === 0) {
    // Deep-link to the correct pane on macOS 13+
    shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
  }
}

// ─── Pre-flight check before recording starts ─────────────────────────────────

export async function checkAndRequestRecordingPermissions(): Promise<{
  screen: boolean
  accessibility: boolean
  microphone: boolean
  camera: boolean
}> {
  const screen = getScreenRecordingStatus() === 'granted'
  const accessibility = getAccessibilityStatus()
  const microphone = systemPreferences.getMediaAccessStatus('microphone') === 'granted'
  const camera = getCameraStatus() === 'granted'

  return { screen, accessibility, microphone, camera }
}
