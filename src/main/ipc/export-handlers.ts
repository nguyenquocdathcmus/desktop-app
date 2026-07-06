import { IpcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/constants'
import { exportVideo, exportGif, cancelExport } from '../export/Exporter'
import type { ExportOptions } from '../../shared/ipc-types'

let exporting = false

export function registerExportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.EXPORT_START, async (_, opts: ExportOptions) => {
    if (exporting) return { ok: false, error: 'Export already in progress' }
    exporting = true

    const broadcast = (channel: string, payload: unknown) => {
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(channel, payload))
    }

    try {
      const doExport = opts.format === 'gif' ? exportGif : exportVideo

      const result = await doExport(opts, (percent, eta) => {
        broadcast(IPC.EXPORT_PROGRESS, { percent, eta })
      })

      if (result.ok) {
        broadcast(IPC.EXPORT_DONE, { outputPath: result.outputPath })
      } else {
        broadcast(IPC.EXPORT_ERROR, { message: result.error })
      }

      return result
    } finally {
      exporting = false
    }
  })

  // Sprint 29 BUG-02 — this used to also set `exporting = false` here,
  // immediately on cancel. But EXPORT_START's own `doExport()` call is still
  // in-flight at that point (it only settles once the killed ffmpeg process's
  // promise actually rejects/resolves) — clearing the flag early let a
  // second EXPORT_START slip past the `if (exporting)` guard while the first
  // export was still tearing down, starting a second ffmpeg run against the
  // same shared FFmpegWrapper instance (`currentProc` gets overwritten) before
  // the first one's `finally` block cleared the flag again. Cancel now only
  // kills the process; EXPORT_START's own `finally` is the single place that
  // clears `exporting`, so it's only ever false once doExport() has actually settled.
  ipcMain.on(IPC.EXPORT_CANCEL, () => {
    cancelExport()
  })
}

/** Kills any in-flight export process — call on app quit so it never outlives the app. */
export function killExportOnQuit(): void {
  cancelExport()
}

/** Sprint 12 US-106 — lets the quit handler warn the user before killing an in-flight export. */
export function isExportInProgress(): boolean {
  return exporting
}
