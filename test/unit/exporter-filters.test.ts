import { describe, it, expect } from 'vitest'
import {
  buildZExpr, buildXExpr, buildYExpr, buildCropXExpr,
  buildConcatFilter, remapRangeEvents, remapPointEvents,
  atempoChain, conceptualDuration,
  type Segment
} from '../../src/main/export/Exporter'
import type { ZoomEvent } from '../../src/shared/project-types'

function zoomEvent(overrides: Partial<ZoomEvent> = {}): ZoomEvent {
  return {
    id: 'z1', startTime: 1, endTime: 2, zoomLevel: 2,
    centerX: 0.5, centerY: 0.5, easing: 'spring', isAuto: true,
    ...overrides
  }
}

describe('buildZExpr / buildXExpr / buildYExpr', () => {
  it('returns identity (no zoom) for empty events', () => {
    expect(buildZExpr([])).toBe('1')
    expect(buildXExpr([])).toBe('0')
    expect(buildYExpr([])).toBe('0')
  })

  it('embeds the event window as a between() clause using zoompan\'s `time` variable, not `t`', () => {
    // Sprint 25 US-193 — zoompan's eval context exposes the current output
    // time as `time`, not the generic ffmpeg `t` used by crop/drawtext/geq.
    // `between(t,...)` inside a zoompan z/x/y expression is rejected by
    // ffmpeg at filter-graph construction ("Unknown function") — confirmed
    // by running the expression through the real bundled ffmpeg binary (see
    // test/RESULTS/sprint-25-hdr-fps-verification.md). This assertion would
    // have caught that bug immediately; the previous version of this test
    // asserted the buggy `between(t,...)` shape as correct, which is why it
    // shipped unnoticed.
    const expr = buildZExpr([zoomEvent({ startTime: 1.5, endTime: 3.25 })])
    expect(expr).toContain('between(time,1.500,3.250)')
    expect(expr).not.toMatch(/between\(t,/)
  })

  it('includes a between() clause for every event, regardless of order', () => {
    // buildZExpr builds nested if/else by iterating events.reverse(), so the
    // FIRST array element ends up as the innermost (last-checked) `if` — this
    // just confirms both windows are present in the final expression string.
    const early = zoomEvent({ id: 'a', startTime: 0, endTime: 1 })
    const late = zoomEvent({ id: 'b', startTime: 5, endTime: 6, zoomLevel: 3 })
    const expr = buildZExpr([early, late])
    expect(expr).toContain('between(time,5.000,6.000)')
    expect(expr).toContain('between(time,0.000,1.000)')
  })

  it('buildCropXExpr centers on the zoom focal point within crop bounds', () => {
    const expr = buildCropXExpr([zoomEvent({ centerX: 0.25 })], 1920, 1080)
    expect(expr).toContain('0.2500*1920')
    expect(expr).toContain('between(t,1.000,2.000)')
  })

  it('buildCropXExpr falls back to center-crop with no events', () => {
    const expr = buildCropXExpr([], 1920, 1080)
    expect(expr).toBe('(1920-1080)/2')
  })
})

describe('atempoChain', () => {
  it('passes through speeds within the 0.5-2.0 range unchanged', () => {
    expect(atempoChain(1.5)).toBe('atempo=1.5000')
  })

  it('chains atempo=2.0 for 4x (ffmpeg atempo caps at 2.0 per instance)', () => {
    // 4 / 2.0 = 2.0, which is not > 2.0, so the loop stops after one chain step.
    const chain = atempoChain(4)
    expect(chain).toBe('atempo=2.0,atempo=2.0000')
  })

  it('chains twice for speeds requiring more than one 2.0 step', () => {
    // 5 / 2.0 = 2.5 (still > 2.0) / 2.0 = 1.25 — two chain steps needed.
    const chain = atempoChain(5)
    expect(chain).toBe('atempo=2.0,atempo=2.0,atempo=1.2500')
  })

  it('chains down for speeds below 0.5', () => {
    const chain = atempoChain(0.25)
    expect(chain).toBe('atempo=0.5,atempo=0.5000')
  })
})

describe('conceptualDuration', () => {
  it('sums plain segment durations with no speed', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 10, end: 12 }]
    expect(conceptualDuration(segments)).toBe(7)
  })

  it('divides duration by speed for sped-up segments', () => {
    const segments: Segment[] = [{ start: 0, end: 10, speed: 2 }]
    expect(conceptualDuration(segments)).toBe(5)
  })
})

describe('buildConcatFilter', () => {
  it('builds one trim+setpts filter per segment plus a final concat', () => {
    const segments: Segment[] = [{ start: 0, end: 2 }, { start: 4, end: 6 }]
    const { parts, videoOut, audioOut } = buildConcatFilter(segments, '[0:v]', false)
    expect(parts).toHaveLength(3) // 2 trims + 1 concat
    expect(parts[0]).toContain('trim=start=0.000:end=2.000')
    expect(parts[1]).toContain('trim=start=4.000:end=6.000')
    expect(parts[2]).toContain('concat=n=2:v=1:a=0')
    expect(videoOut).toBe('spliced')
    expect(audioOut).toBeNull()
  })

  it('interleaves video+audio labels into concat when audio is present', () => {
    const segments: Segment[] = [{ start: 0, end: 2 }]
    const { parts, audioOut } = buildConcatFilter(segments, '[0:v]', true)
    // 1 video trim + 1 audio atrim + 1 concat
    expect(parts).toHaveLength(3)
    expect(parts.some((p) => p.includes('atrim'))).toBe(true)
    expect(audioOut).toBe('splicedaud')
  })

  it('applies setpts/atempo speed adjustment per segment', () => {
    const segments: Segment[] = [{ start: 0, end: 2, speed: 2 }]
    const { parts } = buildConcatFilter(segments, '[0:v]', true)
    expect(parts[0]).toContain('setpts=PTS/2.0000')
    expect(parts.find((p) => p.includes('atrim'))).toContain('atempo=2.0000')
  })
})

describe('remapRangeEvents', () => {
  it('shifts an event fully inside a single segment by the segment offset', () => {
    const segments: Segment[] = [{ start: 10, end: 20 }]
    const events = [{ startTime: 12, endTime: 14 }]
    const [remapped] = remapRangeEvents(events, segments)
    expect(remapped.startTime).toBeCloseTo(2)
    expect(remapped.endTime).toBeCloseTo(4)
  })

  it('drops an event that falls entirely inside a removed (non-listed) region', () => {
    // Segment list simulates ripple-delete: [0-5] kept, [5-8] removed, [8-12] kept
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 8, end: 12 }]
    const events = [{ startTime: 6, endTime: 7 }] // lives entirely in the deleted gap
    expect(remapRangeEvents(events, segments)).toHaveLength(0)
  })

  it('accumulates offset across multiple segments', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 8, end: 12 }]
    const events = [{ startTime: 9, endTime: 10 }] // in the second kept segment
    const [remapped] = remapRangeEvents(events, segments)
    // offset after segment 1 = 5; event starts 1s into segment 2 => 5 + 1 = 6
    expect(remapped.startTime).toBeCloseTo(6)
    expect(remapped.endTime).toBeCloseTo(7)
  })

  it('divides the remapped time by segment speed', () => {
    const segments: Segment[] = [{ start: 0, end: 10, speed: 2 }]
    const events = [{ startTime: 4, endTime: 6 }]
    const [remapped] = remapRangeEvents(events, segments)
    expect(remapped.startTime).toBeCloseTo(2) // 4/2
    expect(remapped.endTime).toBeCloseTo(3)   // 6/2
  })

  it('clips an event that spans a segment boundary to the overlapping part', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }]
    const events = [{ startTime: 3, endTime: 8 }] // extends past the segment end
    const [remapped] = remapRangeEvents(events, segments)
    expect(remapped.startTime).toBeCloseTo(3)
    expect(remapped.endTime).toBeCloseTo(5) // clipped to segment end
  })
})

describe('remapPointEvents', () => {
  it('drops a point event inside a removed region', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 8, end: 12 }]
    const events = [{ t: 6.5 }]
    expect(remapPointEvents(events, segments)).toHaveLength(0)
  })

  it('keeps and remaps a point event inside a kept segment', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 8, end: 12 }]
    const events = [{ t: 9 }]
    const [remapped] = remapPointEvents(events, segments)
    expect(remapped.t).toBeCloseTo(6) // offset 5 + (9-8)
  })

  // Sprint 29 (round 2) BUG-08 — splitSegmentAt() produces exactly this
  // shape: two adjacent kept segments sharing one boundary value. A point
  // event sitting exactly on that shared boundary used to match both
  // segments' inclusive range and be emitted twice.
  it('emits a point event exactly on a shared segment boundary only once', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 5, end: 10 }]
    const events = [{ t: 5 }]
    const remapped = remapPointEvents(events, segments)
    expect(remapped).toHaveLength(1)
    // Boundary point belongs to the segment it opens (the second one, since
    // the first segment's range is now the half-open [0, 5)) — offset for
    // the second segment is 5 (the first segment's full length), plus
    // (5 - 5) = 0 within it, landing at output time 5.
    expect(remapped[0].t).toBeCloseTo(5)
  })

  it('still keeps a point event exactly at the end of the very last segment', () => {
    const segments: Segment[] = [{ start: 0, end: 5 }, { start: 5, end: 10 }]
    const events = [{ t: 10 }]
    const remapped = remapPointEvents(events, segments)
    expect(remapped).toHaveLength(1)
    expect(remapped[0].t).toBeCloseTo(10)
  })
})
