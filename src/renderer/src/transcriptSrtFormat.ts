import type { TranscriptWord } from './store/useProjectStore'

/**
 * Sprint 24 US-187 — groups recognized words into subtitle-length cues (~8
 * words or a natural pause > 0.6s, whichever comes first) and formats as
 * standard SRT. Not a 1-word-per-cue dump — that's unreadable as subtitles.
 */
export function formatTranscriptSrt(words: TranscriptWord[]): string {
  if (words.length === 0) return ''

  const MAX_WORDS_PER_CUE = 8
  const PAUSE_BREAK_S = 0.6

  const cues: TranscriptWord[][] = []
  let current: TranscriptWord[] = []
  for (const w of words) {
    const prev = current[current.length - 1]
    const brokeOnPause = prev && w.startTime - prev.endTime > PAUSE_BREAK_S
    if (brokeOnPause || current.length >= MAX_WORDS_PER_CUE) {
      cues.push(current)
      current = []
    }
    current.push(w)
  }
  if (current.length > 0) cues.push(current)

  const srtTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.round((s - Math.floor(s)) * 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
  }

  return cues
    .map((cue, i) => {
      const start = srtTime(cue[0].startTime)
      const end = srtTime(cue[cue.length - 1].endTime)
      const text = cue.map((w) => w.word).join(' ')
      return `${i + 1}\n${start} --> ${end}\n${text}\n`
    })
    .join('\n')
}
