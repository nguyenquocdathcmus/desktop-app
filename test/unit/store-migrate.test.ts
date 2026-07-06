import { describe, it, expect } from 'vitest'
import { migrateProjectState } from '../../src/renderer/src/store/useProjectStore'
import type { ProjectState, SessionManifest } from '../../src/shared/project-types'
import { DEFAULT_PROJECT_STATE } from '../../src/shared/project-types'

function manifest(overrides: Partial<SessionManifest> = {}): SessionManifest {
  return {
    id: 'm1', version: 1, createdAt: 0, updatedAt: 0,
    videoPath: '/tmp/capture.mov', cursorPath: '', hasSystemAudio: false,
    displayId: 1, displayBounds: { x: 0, y: 0, width: 1920, height: 1080 },
    fps: 60, duration: 30, width: 1920, height: 1080,
    ...overrides
  }
}

describe('migrateProjectState', () => {
  it('is a no-op when segments already exist', () => {
    const state: ProjectState = {
      manifest: manifest(),
      ...DEFAULT_PROJECT_STATE,
      segments: [{ id: 'seg-0', start: 1, end: 5 }]
    }
    const migrated = migrateProjectState(state)
    expect(migrated).toBe(state) // same reference — genuinely a no-op
  })

  it('converts legacy inPoint/outPoint into a single segment', () => {
    const state = {
      manifest: manifest({ duration: 30 }),
      ...DEFAULT_PROJECT_STATE,
      segments: [],
      inPoint: 2,
      outPoint: 10
    } as unknown as ProjectState
    const migrated = migrateProjectState(state)
    expect(migrated.segments).toHaveLength(1)
    expect(migrated.segments[0].start).toBe(2)
    expect(migrated.segments[0].end).toBe(10)
  })

  it('falls back to the full manifest duration when outPoint is unset/zero', () => {
    const state = {
      manifest: manifest({ duration: 45 }),
      ...DEFAULT_PROJECT_STATE,
      segments: [],
      inPoint: 0,
      outPoint: 0
    } as unknown as ProjectState
    const migrated = migrateProjectState(state)
    expect(migrated.segments[0]).toMatchObject({ start: 0, end: 45 })
  })

  it('defaults inPoint to 0 when entirely absent (very old project)', () => {
    const state = {
      manifest: manifest({ duration: 20 }),
      ...DEFAULT_PROJECT_STATE,
      segments: []
    } as unknown as ProjectState
    const migrated = migrateProjectState(state)
    expect(migrated.segments[0]).toMatchObject({ start: 0, end: 20 })
  })
})
