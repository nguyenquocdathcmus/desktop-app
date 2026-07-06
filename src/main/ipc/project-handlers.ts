import { IpcMain, app } from 'electron'
import { IPC } from '../../shared/constants'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import type { ProjectState, CursorEvent } from '../../shared/project-types'
import { markProjectDirty, clearProjectDirtyFlag } from './app-handlers'
import { recordKnownMtime, hasExternalChange } from '../project/conflictTracker'

// Lazy — app.getPath() only valid after app is ready
const getRecentProjectsPath = () => join(app.getPath('userData'), 'recent-projects.json')

function getRecentProjects(): string[] {
  try {
    if (!existsSync(getRecentProjectsPath())) return []
    return JSON.parse(readFileSync(getRecentProjectsPath(), 'utf-8'))
  } catch {
    return []
  }
}

function addRecentProject(projectPath: string): void {
  const recent = getRecentProjects().filter((p) => p !== projectPath)
  recent.unshift(projectPath)
  writeFileSync(getRecentProjectsPath(), JSON.stringify(recent.slice(0, 10)))
}

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.PROJECT_SAVE, (_, { projectPath, state, force }: { projectPath: string; state: ProjectState; force?: boolean }) => {
    try {
      const manifestPath = join(projectPath, 'manifest.json')
      // Sprint 26 US-198 — refuse to silently overwrite a manifest that
      // changed on disk since this app instance last opened/saved it (e.g.
      // a colleague's copy synced back via Drive), unless the caller
      // explicitly confirms (force) after being warned by the renderer.
      if (!force && existsSync(manifestPath)) {
        const beforeStat = statSync(manifestPath)
        if (hasExternalChange(projectPath, beforeStat.mtimeMs, beforeStat.size)) {
          return { ok: false, conflict: true as const }
        }
      }
      mkdirSync(dirname(projectPath), { recursive: true })
      writeFileSync(manifestPath, JSON.stringify(state, null, 2))
      const afterStat = statSync(manifestPath)
      recordKnownMtime(projectPath, afterStat.mtimeMs, afterStat.size)
      addRecentProject(projectPath)
      clearProjectDirtyFlag()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  // Sprint 12 US-104 — the renderer calls this whenever an edit marks the
  // project dirty, ahead of the (debounced) autosave actually running. If the
  // app is force-quit before the autosave lands, this flag survives and the
  // next launch can offer to reopen the project that had unsaved work.
  ipcMain.on('project:mark-dirty', (_, { projectPath }: { projectPath: string }) => {
    markProjectDirty(projectPath)
  })

  ipcMain.handle(IPC.PROJECT_OPEN, (_, { projectPath }: { projectPath: string }): ProjectState | null => {
    try {
      const manifestPath = join(projectPath, 'manifest.json')
      if (!existsSync(manifestPath)) return null
      const state = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ProjectState
      addRecentProject(projectPath)
      // Sprint 26 US-198 — record what this app instance saw on open, so a
      // later save can detect if the file changed elsewhere in between.
      const openStat = statSync(manifestPath)
      recordKnownMtime(projectPath, openStat.mtimeMs, openStat.size)
      return state
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.PROJECT_GET_RECENT, () => getRecentProjects())

  // Sprint 26 US-198 — reads the on-disk manifest without marking it as
  // "seen" the way PROJECT_OPEN does, so the renderer can show what changed
  // externally (e.g. diff review comments) before the user decides how to
  // resolve the conflict, without that read itself clearing the conflict flag.
  ipcMain.handle('project:peek-on-disk', (_, { projectPath }: { projectPath: string }): ProjectState | null => {
    try {
      const manifestPath = join(projectPath, 'manifest.json')
      if (!existsSync(manifestPath)) return null
      return JSON.parse(readFileSync(manifestPath, 'utf-8')) as ProjectState
    } catch {
      return null
    }
  })

  ipcMain.handle('cursor:read', (_, { cursorPath }: { cursorPath: string }): CursorEvent[] => {
    try {
      if (!cursorPath || !existsSync(cursorPath)) return []
      const raw = readFileSync(cursorPath, 'utf-8').trim()
      if (!raw || raw === '[]' || raw === '[\n]') return []
      return JSON.parse(raw) as CursorEvent[]
    } catch {
      return []
    }
  })
}
