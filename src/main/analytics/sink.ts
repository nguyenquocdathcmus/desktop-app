import { app } from 'electron'
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Sprint 18 US-146 — the only place a real PostHog (or similar) integration
 * would plug in. No external analytics account exists in this environment,
 * so events are appended to a local JSONL file instead of sent anywhere.
 * Every other piece of the analytics feature (consent, instrumentation,
 * funnel, feature flags, query script) is real and works against this file —
 * swapping `sink()` for a PostHog client call is the only change needed
 * later, no call site above this module needs to move.
 */
export interface AnalyticsEvent {
  name: string
  props: Record<string, string | number | boolean>
  t: number
}

function eventsPath(): string {
  return join(app.getPath('userData'), 'analytics-events.jsonl')
}

export function sink(event: AnalyticsEvent): void {
  try {
    mkdirSync(dirname(eventsPath()), { recursive: true })
    appendFileSync(eventsPath(), JSON.stringify(event) + '\n')
  } catch {
    // Analytics must never break the app it's observing.
  }
}

export function readAllEvents(): AnalyticsEvent[] {
  try {
    if (!existsSync(eventsPath())) return []
    return readFileSync(eventsPath(), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
  } catch {
    return []
  }
}
