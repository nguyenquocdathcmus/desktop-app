import { IpcMain, app, dialog, BrowserWindow } from 'electron'
import { statfs, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'

const statfsAsync = promisify(statfs)

function unsavedFlagPath(): string {
  return join(app.getPath('userData'), 'unsaved-project.flag')
}

/**
 * Crash recovery (Sprint 12 US-104): whenever a project becomes dirty, the
 * renderer writes its path to a small flag file; a clean save or close clears
 * it. If the app is force-quit mid-edit, the flag survives and the next
 * launch can offer to reopen that project.
 */
export function markProjectDirty(projectPath: string): void {
  try { writeFileSync(unsavedFlagPath(), projectPath) } catch { /* best effort */ }
}

export function clearProjectDirtyFlag(): void {
  try { if (existsSync(unsavedFlagPath())) unlinkSync(unsavedFlagPath()) } catch { /* best effort */ }
}

function onboardedFlagPath(): string {
  return join(app.getPath('userData'), 'onboarded.flag')
}

function hintsFlagPath(): string {
  return join(app.getPath('userData'), 'dismissed-hints.json')
}

function readDismissedHints(): string[] {
  try {
    return JSON.parse(readFileSync(hintsFlagPath(), 'utf-8'))
  } catch {
    return []
  }
}

/**
 * "What's New" panel (Sprint 17 US-141) — a small hand-authored list of
 * user-facing highlights per version, NOT the full technical changelog.
 * Only versions with an entry here trigger the panel; skipped versions are
 * silently no-ops so we don't have to backfill history for every sprint.
 */
const CHANGELOG: Record<string, string[]> = {
  '0.1.0': [
    'Proxy preview for smooth scrubbing on large 4K recordings',
    'Chapter markers and a shareable timestamp link',
    'Project templates to reuse a structure across a video series'
  ]
}

function changelogAckPath(): string {
  return join(app.getPath('userData'), 'changelog-seen.flag')
}

export function registerAppHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('app:get-version', () => app.getVersion())

  // Sprint 12 US-102 — first-run onboarding shown once, before any permission
  // prompts fire, so the user knows *why* each TCC dialog is about to appear.
  ipcMain.handle('app:is-onboarded', () => existsSync(onboardedFlagPath()))
  ipcMain.on('app:set-onboarded', () => {
    try { writeFileSync(onboardedFlagPath(), '1') } catch { /* best effort */ }
  })

  ipcMain.handle('app:check-disk-space', async (): Promise<{ freeGB: number; low: boolean }> => {
    try {
      const stats = await statfsAsync(app.getPath('documents'))
      const freeBytes = stats.bsize * stats.bavail
      const freeGB = freeBytes / 1024 ** 3
      return { freeGB, low: freeGB < 2 }
    } catch {
      // If we can't determine free space, don't block recording over it.
      return { freeGB: Infinity, low: false }
    }
  })

  ipcMain.handle('app:get-unsaved-flag', (): string | null => {
    try {
      if (!existsSync(unsavedFlagPath())) return null
      const path = readFileSync(unsavedFlagPath(), 'utf-8').trim()
      return path || null
    } catch {
      return null
    }
  })

  ipcMain.on('app:clear-unsaved-flag', () => clearProjectDirtyFlag())

  // Sprint 17 US-139 — contextual first-use hints, dismissed once and never
  // shown again (across all projects, since the file lives in userData not
  // any single project's save file).
  ipcMain.handle('hints:get', (): { dismissed: string[] } => ({ dismissed: readDismissedHints() }))
  ipcMain.on('hints:dismiss', (_, { id }: { id: string }) => {
    try {
      const dismissed = readDismissedHints()
      if (!dismissed.includes(id)) writeFileSync(hintsFlagPath(), JSON.stringify([...dismissed, id]))
    } catch { /* best effort */ }
  })

  // Sprint 17 US-141 — "What's New" shown once per version after an update.
  ipcMain.handle('changelog:get-unseen', (): { version: string; items: string[] } | null => {
    const version = app.getVersion()
    const entry = CHANGELOG[version]
    if (!entry) return null
    try {
      const lastSeen = existsSync(changelogAckPath()) ? readFileSync(changelogAckPath(), 'utf-8').trim() : ''
      if (lastSeen === version) return null
    } catch { /* fall through and show it */ }
    return { version, items: entry }
  })
  ipcMain.on('changelog:ack', (_, { version }: { version: string }) => {
    try { writeFileSync(changelogAckPath(), version) } catch { /* best effort */ }
  })
}

/** Confirms quitting while an export is in-flight (US-106) — call from the
 *  app 'before-quit' handler, passing whether an export is currently running. */
export async function confirmQuitDuringExport(isExporting: boolean): Promise<boolean> {
  if (!isExporting) return true
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = await dialog.showMessageBox(win ?? undefined as any, {
    type: 'warning',
    buttons: ['Cancel', 'Quit Anyway'],
    defaultId: 0,
    cancelId: 0,
    message: 'Export is still in progress',
    detail: 'Quitting now will stop the export and the file will be incomplete. Quit anyway?'
  })
  return result.response === 1
}
