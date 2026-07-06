import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { fetchSubscription } from './subscription'

/**
 * Sprint 30 US-220 — single source of truth for what the current user is
 * allowed to do, resolved in the MAIN process. The renderer only ever uses
 * this to draw locks/hints; every enforcement point (recording:start,
 * export:start, transcript:generate, the mic/webcam sidecar saves) re-checks
 * here, so a tampered renderer cannot grant itself Pro features.
 *
 * Limits mirror the landing page's pricing promises exactly:
 *   Free — 720p export, 5-minute recordings, no mic/system-audio/webcam,
 *          no transcript. Pro — everything.
 */

export interface EntitlementLimits {
  /** Exports whose min(width,height) exceeds this are rejected. min() rather
   *  than height so a 9:16 vertical 1080×1920 counts as 1080p, not 1920p. */
  maxExportShortSide: number
  /** null = unlimited. Enforced by an auto-stop watcher in recording-handlers. */
  maxRecordingSeconds: number | null
  audioAllowed: boolean
  webcamAllowed: boolean
  transcriptAllowed: boolean
}

export interface Entitlements {
  plan: 'free' | 'pro'
  limits: EntitlementLimits
}

const FREE_LIMITS: EntitlementLimits = {
  maxExportShortSide: 720,
  maxRecordingSeconds: 300,
  audioAllowed: false,
  webcamAllowed: false,
  transcriptAllowed: false
}

const PRO_LIMITS: EntitlementLimits = {
  maxExportShortSide: Number.MAX_SAFE_INTEGER,
  maxRecordingSeconds: null,
  audioAllowed: true,
  webcamAllowed: true,
  transcriptAllowed: true
}

export function entitlementsFor(plan: 'free' | 'pro'): Entitlements {
  return { plan, limits: plan === 'pro' ? PRO_LIMITS : FREE_LIMITS }
}

/** Written on every successful subscription fetch so a Pro user who goes
 *  offline (plane, flaky network) keeps Pro across restarts — but only while
 *  their last known billing period (+ grace) hasn't lapsed, so a canceled
 *  card can't ride the cache forever. */
interface DiskCache {
  plan: 'free' | 'pro'
  /** ms epoch of subscription current_period_end, or null if unknown. */
  currentPeriodEnd: number | null
  fetchedAt: number
}

const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000

function cachePath(): string {
  return join(app.getPath('userData'), 'entitlements.cache.json')
}

function readDiskCache(): DiskCache | null {
  try {
    return JSON.parse(readFileSync(cachePath(), 'utf-8'))
  } catch {
    return null
  }
}

function writeDiskCache(cache: DiskCache): void {
  try { writeFileSync(cachePath(), JSON.stringify(cache)) } catch { /* best effort */ }
}

let memory: { ent: Entitlements; at: number } | null = null
const MEMORY_TTL_MS = 60_000

/** Test-only escape hatch, mirroring _resetAuthBillingConfigCacheForTests. */
export function _resetEntitlementsCacheForTests(): void {
  memory = null
}

export async function getEntitlements(): Promise<Entitlements> {
  if (memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.ent

  const sub = await fetchSubscription()

  let plan: 'free' | 'pro' = 'free'
  if (sub.signedIn && 'plan' in sub) {
    plan = sub.plan
    writeDiskCache({
      plan,
      currentPeriodEnd: sub.currentPeriodEnd,
      fetchedAt: Date.now()
    })
  } else if (sub.signedIn && 'error' in sub) {
    // Transient fetch failure (network, stale token): fall back to the last
    // successful answer, but only within its billing period + grace — the
    // same rule fetchSubscription applies to fresh data (US-222).
    const cached = readDiskCache()
    if (cached?.plan === 'pro') {
      const validUntil = (cached.currentPeriodEnd ?? cached.fetchedAt) + OFFLINE_GRACE_MS
      if (Date.now() < validUntil) plan = 'pro'
    }
  }
  // signedOut → free (the app works fully offline on the Free tier).

  const ent = entitlementsFor(plan)
  memory = { ent, at: Date.now() }
  return ent
}

/** Drops the memory cache so the next getEntitlements() refetches — called
 *  right after checkout opens and when auth state changes, so a fresh
 *  payment or sign-in is picked up without waiting out the TTL. */
export function invalidateEntitlements(): void {
  memory = null
}
