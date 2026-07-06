import type { CursorEvent, ZoomEvent } from '../../../shared/project-types'

function uuid(): string {
  return crypto.randomUUID()
}

const SETTLE_VELOCITY_THRESHOLD = 50   // px/s — cursor "parked"
const SETTLE_MIN_DURATION = 0.4        // seconds of stillness to trigger zoom
const ZOOM_OUT_DELAY = 0.8             // seconds after cursor moves to zoom out
const DEFAULT_ZOOM_LEVEL = 2.0
const ZOOM_MARGIN = 0.15               // normalized margin from edge before clamping

export interface ZoomFrame {
  t: number           // seconds
  zoom: number        // 1.0 = no zoom
  cx: number          // 0.0-1.0 center X normalized
  cy: number          // 0.0-1.0 center Y normalized
}

/**
 * Generate zoom events from the raw cursor event log.
 *
 * Algorithm:
 * 1. Smooth cursor positions (moving average)
 * 2. Detect "settle" periods: cursor velocity < threshold for > SETTLE_MIN_DURATION
 * 3. Generate zoom-in event at each settle center
 * 4. Generate zoom-out event when cursor velocity spikes back up
 */
export function generateZoomEvents(
  cursorEvents: CursorEvent[],
  videoDuration: number,
  videoWidth: number,
  videoHeight: number,
  recordingStartMs?: number  // manifest.createdAt — cursor timestamps relative to this
): ZoomEvent[] {
  if (cursorEvents.length < 2) return []

  // Use recordingStartMs to normalize, or fall back to first event
  const originMs = recordingStartMs ?? cursorEvents.find(e => e.type === 'move' || e.type === 'click')?.t ?? 0

  // Convert to seconds relative to recording start, normalize positions
  const events = cursorEvents
    .filter((e) => (e.type === 'move' || e.type === 'click') && e.t >= originMs - 500)
    .map((e) => ({
      t: Math.max(0, (e.t - originMs) / 1000),
      x: (e.x ?? 0) / videoWidth,
      y: (e.y ?? 0) / videoHeight,
      isClick: e.type === 'click'
    }))
    .filter((e) => e.t <= videoDuration + 0.5)

  if (events.length < 2) return []

  const tStart = events[0].t

  // Smooth positions with moving average (window = 8 samples)
  const smoothed = smoothPositions(events, 8)

  // Calculate velocity at each point
  const withVelocity = smoothed.map((p, i) => {
    if (i === 0) return { ...p, v: 0 }
    const prev = smoothed[i - 1]
    const dt = Math.max(0.001, p.t - prev.t)
    const dx = (p.x - prev.x) * videoWidth
    const dy = (p.y - prev.y) * videoHeight
    return { ...p, v: Math.sqrt(dx * dx + dy * dy) / dt }
  })

  // Find settle periods
  const zoomEvents: ZoomEvent[] = []
  let settleStart: number | null = null
  let settleX = 0
  let settleY = 0
  let settleSamples = 0
  let lastZoomedOut = -Infinity

  for (let i = 0; i < withVelocity.length; i++) {
    const { t, x, y, v, isClick } = withVelocity[i]

    if (v < SETTLE_VELOCITY_THRESHOLD || isClick) {
      if (settleStart === null) {
        settleStart = t
        settleX = x
        settleY = y
        settleSamples = 1
      } else {
        settleX = (settleX * settleSamples + x) / (settleSamples + 1)
        settleY = (settleY * settleSamples + y) / (settleSamples + 1)
        settleSamples++
      }

      // Trigger zoom if settled long enough and not recently zoomed
      const settleDuration = t - settleStart
      if (settleDuration >= SETTLE_MIN_DURATION && t - lastZoomedOut > 1.0) {
        const cx = clamp(settleX, ZOOM_MARGIN, 1 - ZOOM_MARGIN)
        const cy = clamp(settleY, ZOOM_MARGIN, 1 - ZOOM_MARGIN)

        // Zoom-in event
        const zoomInTime = settleStart + 0.1
        zoomEvents.push({
          id: uuid(),
          startTime: zoomInTime,
          endTime: t + ZOOM_OUT_DELAY,
          zoomLevel: isClick ? DEFAULT_ZOOM_LEVEL * 1.2 : DEFAULT_ZOOM_LEVEL,
          centerX: cx,
          centerY: cy,
          easing: 'spring',
          isAuto: true
        })
      }
    } else {
      // Cursor moving — end settle
      if (settleStart !== null) {
        lastZoomedOut = t
        settleStart = null
        settleSamples = 0
      }
    }
  }

  // Merge overlapping events and sort
  return mergeOverlapping(zoomEvents).sort((a, b) => a.startTime - b.startTime)
}

// --- Helpers ---

function smoothPositions<T extends { t: number; x: number; y: number }>(
  points: T[],
  window: number
): T[] {
  return points.map((p, i) => {
    const half = Math.floor(window / 2)
    const start = Math.max(0, i - half)
    const end = Math.min(points.length - 1, i + half)
    let sx = 0, sy = 0, count = 0
    for (let j = start; j <= end; j++) {
      sx += points[j].x
      sy += points[j].y
      count++
    }
    return { ...p, x: sx / count, y: sy / count }
  })
}

function mergeOverlapping(events: ZoomEvent[]): ZoomEvent[] {
  if (events.length === 0) return []
  const sorted = [...events].sort((a, b) => a.startTime - b.startTime)
  const merged: ZoomEvent[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = sorted[i]
    if (curr.startTime < prev.endTime) {
      // Overlap — extend the previous event
      prev.endTime = Math.max(prev.endTime, curr.endTime)
    } else {
      merged.push(curr)
    }
  }
  return merged
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Get zoom state at a given time by interpolating between events */
export function getZoomAtTime(
  events: ZoomEvent[],
  t: number
): { zoom: number; cx: number; cy: number } {
  const active = events.find((e) => t >= e.startTime && t <= e.endTime)
  if (!active) return { zoom: 1, cx: 0.5, cy: 0.5 }

  const progress = (t - active.startTime) / Math.max(0.001, active.endTime - active.startTime)
  const ease = easeInOut(progress)

  return {
    zoom: 1 + (active.zoomLevel - 1) * ease,
    cx: active.centerX,
    cy: active.centerY
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
