import type { ProjectTemplate } from './store/useProjectStore'

/**
 * Sprint 15 US-130 — a couple of built-in structural starting points, distinct
 * from user-saved templates (which capture an existing project's real edit
 * history). These are hand-authored fractional layouts meant as examples/
 * starting points for common recording shapes, not derived from any project.
 */
export const TEMPLATE_GALLERY: { name: string; description: string; template: ProjectTemplate }[] = [
  {
    name: 'Intro + Demo + Outro',
    description: 'Title card for the first few seconds, then straight into the demo.',
    template: {
      background: { type: 'gradient', stops: [{ color: '#1a1a2e', position: 0 }, { color: '#16213e', position: 1 }], angle: 135 },
      padding: 60,
      cornerRadius: 12,
      deviceFrame: 'none',
      cursorSettings: {
        visible: true, highlight: true, highlightColor: '#FFD700', highlightRadius: 30,
        highlightOpacity: 0.35, clickAnimation: true, smooth: true, smoothSamples: 8
      },
      segments: [{ start: 0, end: 1 }],
      zoomEvents: [],
      annotations: [],
      scenes: [
        { id: '', startTime: 0, endTime: 0.06, layout: 'title-card', text: 'My Recording' },
        { id: '', startTime: 0.06, endTime: 1, layout: 'pip' }
      ]
    }
  },
  {
    name: 'Bug Report: Before/After',
    description: 'First half of the recording full-screen, second half with camera visible for narration.',
    template: {
      background: { type: 'solid', color: '#141414' },
      padding: 48,
      cornerRadius: 10,
      deviceFrame: 'none',
      cursorSettings: {
        visible: true, highlight: true, highlightColor: '#FF4444', highlightRadius: 28,
        highlightOpacity: 0.4, clickAnimation: true, smooth: true, smoothSamples: 8
      },
      segments: [{ start: 0, end: 1 }],
      zoomEvents: [],
      annotations: [
        { id: '', text: 'Before', startTime: 0.02, endTime: 0.12, x: 0.5, y: 0.1, style: 'pill', color: '#ffffff' },
        { id: '', text: 'After', startTime: 0.52, endTime: 0.62, x: 0.5, y: 0.1, style: 'pill', color: '#ffffff' }
      ],
      scenes: [
        { id: '', startTime: 0, endTime: 0.5, layout: 'screen-only' },
        { id: '', startTime: 0.5, endTime: 1, layout: 'pip' }
      ]
    }
  }
]
