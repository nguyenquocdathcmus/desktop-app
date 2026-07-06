import type { CursorEvent } from '../../../shared/project-types'

/**
 * Apply moving average smoothing to cursor positions.
 * Removes jitter while preserving intentional movement.
 */
export function smoothCursorEvents(events: CursorEvent[], windowSize = 8): CursorEvent[] {
  const moveEvents = events.filter((e) => e.type === 'move' || e.type === 'click')
  const half = Math.floor(windowSize / 2)

  return moveEvents.map((e, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(moveEvents.length - 1, i + half)
    let sx = 0, sy = 0, count = 0

    for (let j = start; j <= end; j++) {
      const ev = moveEvents[j]
      if (ev.x != null) sx += ev.x
      if (ev.y != null) sy += ev.y
      count++
    }

    return count > 0 ? { ...e, x: sx / count, y: sy / count } : e
  })
}

/** Find the cursor position at a specific timestamp (ms) via binary search */
export function getCursorAtTime(events: CursorEvent[], tMs: number): { x: number; y: number } | null {
  if (events.length === 0) return null

  let lo = 0
  let hi = events.length - 1

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (events[mid].t < tMs) lo = mid + 1
    else hi = mid
  }

  const e = events[lo]
  return e.x != null && e.y != null ? { x: e.x, y: e.y } : null
}

/** Get all click events between two timestamps (ms) */
export function getClicksInRange(events: CursorEvent[], t0Ms: number, t1Ms: number): CursorEvent[] {
  return events.filter((e) => e.type === 'click' && e.t >= t0Ms && e.t <= t1Ms)
}
