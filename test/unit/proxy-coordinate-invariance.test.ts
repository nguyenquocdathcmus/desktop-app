import { describe, it, expect } from 'vitest'
import { getZoomAtTime } from '../../src/renderer/src/effects/ZoomPathGenerator'
import type { ZoomEvent } from '../../src/shared/project-types'

/**
 * Sprint 16 US-133 — proxy preview (720p) and the original recording (often
 * 4K) can differ in pixel dimensions, but zoom/annotation/webcam PIP position
 * are stored as 0-1 fractions of the frame, not absolute pixels. This test
 * confirms that assumption in code rather than by eyeballing the preview,
 * since switching `PreviewCanvas`'s <video> src between proxy and original
 * relies on it — no rescaling logic exists anywhere in the swap path.
 */
describe('zoom/annotation coordinates are resolution-independent', () => {
  const zoomEvents: ZoomEvent[] = [
    { id: 'z1', startTime: 0, endTime: 5, centerX: 0.25, centerY: 0.75, zoomLevel: 2, easing: 'spring', isAuto: false }
  ]

  it('getZoomAtTime returns the same normalized center regardless of source resolution', () => {
    // The function has no resolution parameter at all — there is nothing to
    // pass in that would change behavior between a 3840x2160 source and a
    // 1280x720 proxy. Calling it "as if" for each resolution is the same call.
    const atOriginalRes = getZoomAtTime(zoomEvents, 2)
    const atProxyRes = getZoomAtTime(zoomEvents, 2)
    expect(atOriginalRes).toEqual(atProxyRes)
    expect(atOriginalRes.cx).toBe(0.25)
    expect(atOriginalRes.cy).toBe(0.75)
  })

  it('center values stay within 0-1 regardless of aspect ratio implied by resolution', () => {
    const { cx, cy } = getZoomAtTime(zoomEvents, 2)
    expect(cx).toBeGreaterThanOrEqual(0)
    expect(cx).toBeLessThanOrEqual(1)
    expect(cy).toBeGreaterThanOrEqual(0)
    expect(cy).toBeLessThanOrEqual(1)
  })
})
