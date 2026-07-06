import { IpcMain, dialog, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { binPath } from '../binPath'
import { getEntitlements } from '../billing/entitlements'

export interface TranscriptWord {
  word: string
  startTime: number
  endTime: number
  confidence: number
}

interface TranscriptCache {
  audioMtimeMs: number
  words: TranscriptWord[]
}

function cacheFile(audioPath: string): string {
  return join(dirname(audioPath), 'transcript.cache.json')
}

/**
 * Sprint 24 US-183 — runs the `transcriber` Swift binary (on-device
 * SFSpeechRecognizer, see swift/transcriber/Sources/transcriber/main.swift)
 * over a recording's audio track and returns per-word timestamps. Cached
 * next to the source file by mtime, same pattern as face-detector.
 *
 * The binary aborts via TCC if run outside a bundle carrying
 * NSSpeechRecognitionUsageDescription (electron-builder.yml) — as a child
 * process of the signed, packaged app it inherits that authorization the
 * same way cursor-tracker inherits Accessibility permission.
 */
export function registerTranscriptHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'transcript:generate',
    async (_, { audioPath, locale }: { audioPath: string; locale?: string }): Promise<
      { ok: true; words: TranscriptWord[] } | { ok: false; error: string }
    > => {
      if (!audioPath || !existsSync(audioPath)) return { ok: false, error: 'Audio file not found' }

      // Sprint 30 US-220 — on-device transcript is a Pro feature (pricing pro4).
      const ent = await getEntitlements()
      if (!ent.limits.transcriptAllowed) {
        return { ok: false, error: 'Transcript là tính năng Pro — nâng cấp trong panel Tài khoản để dùng.' }
      }

      const cache = cacheFile(audioPath)
      const stat = statSync(audioPath)
      try {
        const cached: TranscriptCache = JSON.parse(readFileSync(cache, 'utf-8'))
        if (cached.audioMtimeMs === stat.mtimeMs) return { ok: true, words: cached.words }
      } catch { /* no cache */ }

      const binary = binPath('transcriber')
      if (!existsSync(binary)) {
        return { ok: false, error: 'Transcript feature unavailable — transcriber binary not found' }
      }

      const args = ['--input', audioPath]
      if (locale) args.push('--locale', locale)

      const result = await new Promise<{ ok: true; words: TranscriptWord[] } | { ok: false; error: string }>((resolve) => {
        const proc = spawn(binary, args, { env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } })
        const words: TranscriptWord[] = []
        let buffer = ''
        let stderr = ''
        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const e = JSON.parse(line)
              if (typeof e.word === 'string' && typeof e.startTime === 'number') {
                words.push({ word: e.word, startTime: e.startTime, endTime: e.endTime, confidence: e.confidence ?? 0 })
              }
            } catch { /* not JSON */ }
          }
        })
        proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
        proc.on('close', (code) => {
          if (code !== 0 && words.length === 0) {
            resolve({ ok: false, error: stderr.trim() || `transcriber exited with code ${code}` })
          } else {
            resolve({ ok: true, words })
          }
        })
        proc.on('error', (err) => resolve({ ok: false, error: err.message }))
        setTimeout(() => proc.kill(), 600_000)
      })

      if (result.ok) {
        try {
          writeFileSync(cache, JSON.stringify({ audioMtimeMs: stat.mtimeMs, words: result.words } satisfies TranscriptCache))
        } catch { /* non-fatal */ }
      }
      return result
    }
  )

  // Sprint 24 US-187 — export the transcript as a real .srt file (not just
  // clipboard text like the chapter list, since subtitle files need to sit
  // next to the video on disk to be loaded by a player).
  ipcMain.handle(
    'transcript:export-srt',
    async (_, { srtContent, suggestedName }: { srtContent: string; suggestedName: string }): Promise<{ ok: boolean; path?: string }> => {
      const win = BrowserWindow.getFocusedWindow() ?? undefined
      const result = await dialog.showSaveDialog(win as any, {
        defaultPath: suggestedName,
        filters: [{ name: 'SubRip Subtitle', extensions: ['srt'] }]
      })
      if (result.canceled || !result.filePath) return { ok: false }
      writeFileSync(result.filePath, srtContent, 'utf-8')
      return { ok: true, path: result.filePath }
    }
  )
}
