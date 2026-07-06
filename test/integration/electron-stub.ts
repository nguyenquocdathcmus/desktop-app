import { vi } from 'vitest'
import { resolve } from 'path'

/**
 * Minimal `electron` stub so `binPath()` (which calls `app.isPackaged` /
 * `app.getAppPath()`) resolves to the real, bundled ffmpeg binary when
 * `Exporter.ts` is imported outside a running Electron process. This is the
 * only thing standing between "call exportVideo() directly in a test" and
 * "need a whole Electron app running" — everything else Exporter.ts touches
 * is plain Node (fs/path).
 */
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => resolve(__dirname, '../..')
  }
}))
