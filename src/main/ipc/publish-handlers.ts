import { IpcMain, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import {
  connectProvider, uploadToYouTube, uploadToGoogleDrive, uploadToDropbox,
  ProviderNotConfiguredError, type UploadProgress
} from '../publish/providers'
import { saveToken, readToken, removeToken, listConnectedProviders, type PublishProvider } from '../publish/tokenStore'

export interface PublishRecord {
  provider: PublishProvider
  url: string
  publishedAt: number
}

/** History is stored once per recording directory (not per individual export
 *  file) — the HomeScreen card (US-170) only needs "has this recording been
 *  published, and where", regardless of which export (MP4/GIF/9:16 variant)
 *  was actually uploaded. */
function historyPath(recordingDir: string): string {
  return join(recordingDir, 'publish-history.json')
}

function readHistory(recordingDir: string): PublishRecord[] {
  try {
    const p = historyPath(recordingDir)
    if (!existsSync(p)) return []
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return []
  }
}

function appendHistory(recordingDir: string, record: PublishRecord): void {
  const history = readHistory(recordingDir)
  history.push(record)
  writeFileSync(historyPath(recordingDir), JSON.stringify(history))
}

/** Sprint 21 — publish destinations (YouTube/Drive/Dropbox). OAuth and the
 *  actual upload calls are BLOCKED pending real API credentials (see
 *  src/main/publish/providers.ts) — this registers the real, working parts:
 *  connection state (US-169), and publish history per exported file (US-170).
 *  The IPC surface is stable so wiring in real credentials later doesn't
 *  require renderer-side changes, only providers.ts implementations. */
export function registerPublishHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('publish:list-connections', (): PublishProvider[] => {
    return listConnectedProviders()
  })

  ipcMain.handle('publish:connect', async (_, { provider }: { provider: PublishProvider }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      const { accountLabel } = await connectProvider(provider)
      saveToken(provider, { accessToken: '', accountLabel })
      return { ok: true }
    } catch (err) {
      const message = err instanceof ProviderNotConfiguredError
        ? err.message
        : `Failed to connect ${provider}: ${err instanceof Error ? err.message : String(err)}`
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('publish:disconnect', (_, { provider }: { provider: PublishProvider }): { ok: true } => {
    removeToken(provider)
    return { ok: true }
  })

  ipcMain.handle('publish:get-connection-label', (_, { provider }: { provider: PublishProvider }): string | null => {
    return readToken(provider)?.accountLabel ?? null
  })

  ipcMain.handle('publish:get-history', (_, { recordingDir }: { recordingDir: string }): PublishRecord[] => {
    return readHistory(recordingDir)
  })

  ipcMain.handle('publish:upload', async (
    event,
    { provider, filePath, title, description }: { provider: PublishProvider; filePath: string; title: string; description: string }
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    const sender = BrowserWindow.fromWebContents(event.sender)
    const onProgress = (p: UploadProgress) => {
      sender?.webContents.send('publish:progress', { provider, percent: p.totalBytes > 0 ? Math.round((p.bytesSent / p.totalBytes) * 100) : 0 })
    }

    try {
      const result = provider === 'youtube'
        ? await uploadToYouTube(filePath, { title, description }, onProgress)
        : provider === 'googleDrive'
          ? await uploadToGoogleDrive(filePath, onProgress)
          : await uploadToDropbox(filePath, onProgress)

      appendHistory(dirname(filePath), { provider, url: result.url, publishedAt: Date.now() })
      return { ok: true, url: result.url }
    } catch (err) {
      const message = err instanceof ProviderNotConfiguredError
        ? err.message
        : `Upload failed: ${err instanceof Error ? err.message : String(err)}`
      return { ok: false, error: message }
    }
  })
}

// Re-exported for recordings-list-handler.ts to surface publish badges on
// HomeScreen cards (US-170) without duplicating the file-path convention.
export { readHistory as readPublishHistory }
