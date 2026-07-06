import type { Chapter } from '../../shared/project-types'

/**
 * Sprint 15 US-129 — chapter list as YouTube-description-ready text.
 * Extracted so Sprint 21's Publish panel (YouTube upload description, US-165)
 * reuses the exact same formatting instead of a second implementation that
 * could drift from the "Copy chapter list" button in Timeline.tsx.
 */
export function formatChapterList(chapters: Chapter[]): string {
  const formatChapterTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
  return [...chapters]
    .sort((a, b) => a.t - b.t)
    .map((c) => `${formatChapterTime(c.t)} ${c.title}`)
    .join('\n')
}
