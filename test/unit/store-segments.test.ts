import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '../../src/renderer/src/store/useProjectStore'
import type { ProjectState, SessionManifest } from '../../src/shared/project-types'
import { DEFAULT_PROJECT_STATE } from '../../src/shared/project-types'

function manifest(overrides: Partial<SessionManifest> = {}): SessionManifest {
  return {
    id: 'm1', version: 1, createdAt: 0, updatedAt: 0,
    videoPath: '/tmp/capture.mov', cursorPath: '', hasSystemAudio: false,
    displayId: 1, displayBounds: { x: 0, y: 0, width: 1920, height: 1080 },
    fps: 60, duration: 20, width: 1920, height: 1080,
    ...overrides
  }
}

function seedProject(segments: ProjectState['segments']) {
  useProjectStore.setState({
    project: { manifest: manifest(), ...DEFAULT_PROJECT_STATE, segments } as ProjectState,
    isDirty: false,
    silenceRegions: []
  })
}

describe('useProjectStore — segment editing (Sprint 8/9 logic)', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, silenceRegions: [] })
  })

  describe('splitSegmentAt', () => {
    it('splits a single segment into two at the given time', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 10 }])
      useProjectStore.getState().splitSegmentAt(4)
      const segs = useProjectStore.getState().project!.segments
      expect(segs).toHaveLength(2)
      expect(segs[0]).toMatchObject({ start: 0, end: 4 })
      expect(segs[1]).toMatchObject({ start: 4, end: 10 })
    })

    it('is a no-op when the split point is too close to a segment edge (0.05s guard)', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 10 }])
      useProjectStore.getState().splitSegmentAt(0.02)
      expect(useProjectStore.getState().project!.segments).toHaveLength(1)
    })

    it('is a no-op when the time falls outside every segment (already-removed gap)', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 5 }, { id: 'seg-1', start: 8, end: 10 }])
      useProjectStore.getState().splitSegmentAt(6.5) // in the gap between segments
      expect(useProjectStore.getState().project!.segments).toHaveLength(2)
    })
  })

  describe('removeSegment', () => {
    it('removes the given segment when more than one remains', () => {
      seedProject([{ id: 'a', start: 0, end: 5 }, { id: 'b', start: 5, end: 10 }])
      useProjectStore.getState().removeSegment('a')
      const segs = useProjectStore.getState().project!.segments
      expect(segs).toHaveLength(1)
      expect(segs[0].id).toBe('b')
    })

    it('refuses to remove the last remaining segment (a project needs at least one)', () => {
      seedProject([{ id: 'only', start: 0, end: 10 }])
      useProjectStore.getState().removeSegment('only')
      expect(useProjectStore.getState().project!.segments).toHaveLength(1)
    })
  })

  describe('applyRemoveSilences', () => {
    it('ripple-deletes a selected silence region, shrunk by the 0.15s margin', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 20 }])
      useProjectStore.setState({
        silenceRegions: [{ start: 8, end: 12, selected: true }]
      })

      useProjectStore.getState().applyRemoveSilences()

      const segs = useProjectStore.getState().project!.segments
      // Splits at 8.15 and 11.85 (margin-shrunk), then removes the middle piece.
      expect(segs).toHaveLength(2)
      expect(segs[0]).toMatchObject({ start: 0, end: 8.15 })
      expect(segs[1]).toMatchObject({ start: 11.85, end: 20 })
    })

    it('ignores unselected silence regions', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 20 }])
      useProjectStore.setState({
        silenceRegions: [{ start: 8, end: 12, selected: false }]
      })

      useProjectStore.getState().applyRemoveSilences()
      expect(useProjectStore.getState().project!.segments).toHaveLength(1)
    })

    it('processes multiple regions back-to-front without corrupting earlier segments', () => {
      // This is the exact ordering guarantee applyRemoveSilences relies on:
      // source-time-based segments mean later (higher-time) regions must be
      // applied first, or an earlier split would invalidate the still-pending
      // region's coordinates.
      seedProject([{ id: 'seg-0', start: 0, end: 30 }])
      useProjectStore.setState({
        silenceRegions: [
          { start: 5, end: 7, selected: true },
          { start: 20, end: 22, selected: true }
        ]
      })

      useProjectStore.getState().applyRemoveSilences()

      const segs = [...useProjectStore.getState().project!.segments].sort((a, b) => a.start - b.start)
      expect(segs).toHaveLength(3)
      expect(segs[0]).toMatchObject({ start: 0, end: 5.15 })
      expect(segs[1]).toMatchObject({ start: 6.85, end: 20.15 })
      expect(segs[2]).toMatchObject({ start: 21.85, end: 30 })
    })

    it('clears silenceRegions after applying', () => {
      seedProject([{ id: 'seg-0', start: 0, end: 20 }])
      useProjectStore.setState({ silenceRegions: [{ start: 8, end: 12, selected: true }] })
      useProjectStore.getState().applyRemoveSilences()
      expect(useProjectStore.getState().silenceRegions).toHaveLength(0)
    })
  })
})
