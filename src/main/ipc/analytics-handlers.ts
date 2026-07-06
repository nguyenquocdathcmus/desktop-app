import { IpcMain, app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID, createHash } from 'crypto'
import { sink, readAllEvents, type AnalyticsEvent } from '../analytics/sink'

function consentPath(): string {
  return join(app.getPath('userData'), 'analytics-consent.json')
}

function anonIdPath(): string {
  return join(app.getPath('userData'), 'analytics-anon-id.txt')
}

function lastOpenPath(): string {
  return join(app.getPath('userData'), 'last-open.json')
}

function getConsent(): boolean {
  try {
    return JSON.parse(readFileSync(consentPath(), 'utf-8')).enabled === true
  } catch {
    return false
  }
}

function getAnonId(): string {
  try {
    return readFileSync(anonIdPath(), 'utf-8').trim()
  } catch {
    const id = randomUUID()
    try { writeFileSync(anonIdPath(), id) } catch { /* best effort */ }
    return id
  }
}

/**
 * Sprint 18 US-150 — stable bucket assignment: the same anonymous install
 * always lands in the same bucket for a given flag, so a user doesn't flip
 * in and out of a variant across sessions. No server round-trip; rollout
 * percentages are bundled with the app for now (see FLAGS below).
 */
const FLAGS: Record<string, number> = {
  // exampleFeature: 10 — 10% rollout example; no real experimental features
  // exist yet to gate, this documents the mechanism for when one does.
}

function bucketPercent(anonId: string, flagName: string): number {
  const hash = createHash('sha256').update(`${anonId}:${flagName}`).digest()
  return hash.readUInt16BE(0) / 65536 * 100
}

export function registerAnalyticsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('analytics:get-consent', (): boolean => getConsent())
  ipcMain.on('analytics:set-consent', (_, enabled: boolean) => {
    try { writeFileSync(consentPath(), JSON.stringify({ enabled })) } catch { /* best effort */ }
  })

  ipcMain.on('analytics:track', (_, { name, props }: { name: string; props?: Record<string, string | number | boolean> }) => {
    if (!getConsent()) return
    sink({ name, props: props ?? {}, t: Date.now() })
  })

  ipcMain.handle('analytics:get-flag', (_, { flagName }: { flagName: string }): boolean => {
    const rollout = FLAGS[flagName]
    if (rollout === undefined) return false
    return bucketPercent(getAnonId(), flagName) < rollout
  })

  // Sprint 18 US-151 — retention: how many days since this install was last
  // opened. No account needed — the anon UUID + a local timestamp is enough
  // to answer "does anyone come back" without any server component.
  ipcMain.handle('analytics:get-retention-signal', (): { daysSinceLastOpen: number | null } => {
    try {
      const prev = existsSync(lastOpenPath()) ? JSON.parse(readFileSync(lastOpenPath(), 'utf-8')).lastOpenMs : null
      const now = Date.now()
      writeFileSync(lastOpenPath(), JSON.stringify({ lastOpenMs: now }))
      if (!prev) return { daysSinceLastOpen: null }
      return { daysSinceLastOpen: Math.round((now - prev) / 86_400_000) }
    } catch {
      return { daysSinceLastOpen: null }
    }
  })
}

export { readAllEvents }
export type { AnalyticsEvent }
