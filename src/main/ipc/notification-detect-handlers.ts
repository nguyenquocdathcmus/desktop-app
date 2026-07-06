import { IpcMain } from 'electron'
import { existsSync } from 'fs'
import { NotificationDetector, NotificationCandidate } from '../notification-detect/NotificationDetector'

/**
 * Sprint 22 US-174 — surfaces NotificationDetector as an explicit,
 * user-triggered action (never automatic) so a suggestion is always followed
 * by a 1-click confirm in the Timeline, per the Sprint 19 US-154 spec. See
 * test/RESULTS/sprint-22-notification-heuristic.md for the measured
 * precision/recall this is gated on.
 */
export function registerNotificationDetectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'notifications:detect',
    async (_, { videoPath }: { videoPath: string }): Promise<NotificationCandidate[]> => {
      if (!videoPath || !existsSync(videoPath)) return []
      const detector = new NotificationDetector()
      try {
        return await detector.detect(videoPath)
      } catch (err) {
        console.warn('[notifications] detection failed:', err)
        return []
      }
    }
  )
}
