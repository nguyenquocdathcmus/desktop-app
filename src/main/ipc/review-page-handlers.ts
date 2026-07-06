import { IpcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { generateReviewPageHtml, type ReviewPageComment } from '../export/reviewPageTemplate'

/**
 * Sprint 26 US-195/US-196 — comments-alongside-publish and the shareable
 * review page. Both are plain file writes (JSON sidecar, static HTML) with
 * no new server/backend, matching the architecture kept throughout the
 * project (Sprint 21 explicitly rejected self-hosting video for the same
 * reason).
 */
export function registerReviewPageHandlers(ipcMain: IpcMain): void {
  // US-195 — comments sidecar written next to the exported video when
  // "Include comments" is checked in the publish flow.
  ipcMain.handle(
    'review:export-comments-json',
    async (_, { videoPath, comments }: { videoPath: string; comments: ReviewPageComment[] }): Promise<{ ok: boolean; path?: string }> => {
      try {
        const sidecarPath = videoPath.replace(/\.[^.]+$/, '') + '.comments.json'
        writeFileSync(sidecarPath, JSON.stringify(comments, null, 2), 'utf-8')
        return { ok: true, path: sidecarPath }
      } catch {
        return { ok: false }
      }
    }
  )

  // US-196 — generate the self-contained HTML review page and let the user
  // choose where to save it (next to the video by default would be the more
  // "automatic" choice, but a save dialog is more honest about this being a
  // file the user will actively share, not an export artifact).
  ipcMain.handle(
    'review:export-page',
    async (_, { title, comments, youtubeUrl, driveFileId, suggestedName }: {
      title: string
      comments: ReviewPageComment[]
      youtubeUrl?: string
      driveFileId?: string
      suggestedName: string
    }): Promise<{ ok: boolean; path?: string }> => {
      const win = BrowserWindow.getFocusedWindow() ?? undefined
      const result = await dialog.showSaveDialog(win as any, {
        defaultPath: suggestedName,
        filters: [{ name: 'Web Page', extensions: ['html'] }]
      })
      if (result.canceled || !result.filePath) return { ok: false }
      const html = generateReviewPageHtml({ title, comments, youtubeUrl, driveFileId })
      writeFileSync(result.filePath, html, 'utf-8')
      return { ok: true, path: result.filePath }
    }
  )

  // US-197 — import comments exported from the review page's "Download
  // comments as JSON" button back into the project.
  ipcMain.handle(
    'review:import-comments-json',
    async (): Promise<{ ok: boolean; comments?: ReviewPageComment[] }> => {
      const win = BrowserWindow.getFocusedWindow() ?? undefined
      const result = await dialog.showOpenDialog(win as any, {
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false }
      try {
        if (!existsSync(result.filePaths[0])) return { ok: false }
        const raw = JSON.parse(readFileSync(result.filePaths[0], 'utf-8'))
        if (!Array.isArray(raw)) return { ok: false }
        const comments: ReviewPageComment[] = raw
          .filter((c) => typeof c.t === 'number' && typeof c.text === 'string')
          .map((c) => ({ id: String(c.id ?? `imported-${Date.now()}-${Math.random()}`), t: c.t, text: c.text, author: c.author }))
        return { ok: true, comments }
      } catch {
        return { ok: false }
      }
    }
  )
}
