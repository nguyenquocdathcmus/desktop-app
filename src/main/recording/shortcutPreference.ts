import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Sprint 23 US-180 — the global start/stop shortcut is opt-in and empty by
 * default (no accelerator registered) rather than a preset combination,
 * since any hardcoded default risks colliding with a shortcut the user
 * already relies on in another app. Persisted the same way as pill-position.
 */
function shortcutPrefPath(): string {
  return join(app.getPath('userData'), 'recording-shortcut.json')
}

export function readShortcutPreference(): string | null {
  try {
    const raw = JSON.parse(readFileSync(shortcutPrefPath(), 'utf-8'))
    return typeof raw.accelerator === 'string' ? raw.accelerator : null
  } catch {
    return null
  }
}

export function writeShortcutPreference(accelerator: string | null): void {
  try {
    if (accelerator === null) {
      if (existsSync(shortcutPrefPath())) writeFileSync(shortcutPrefPath(), JSON.stringify({ accelerator: null }))
      return
    }
    writeFileSync(shortcutPrefPath(), JSON.stringify({ accelerator }))
  } catch { /* best effort */ }
}
