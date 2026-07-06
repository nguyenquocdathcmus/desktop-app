import { describe, it, expect } from 'vitest'
import { formatTranscriptSrt } from '../../src/renderer/src/transcriptSrtFormat'

describe('formatTranscriptSrt', () => {
  it('returns empty string for no words', () => {
    expect(formatTranscriptSrt([])).toBe('')
  })

  it('groups a short run of words into a single cue with correct SRT timing', () => {
    const words = [
      { word: 'Hello', startTime: 0, endTime: 0.3, confidence: 0.9 },
      { word: 'world', startTime: 0.3, endTime: 0.6, confidence: 0.9 }
    ]
    const srt = formatTranscriptSrt(words)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,600\nHello world\n')
  })

  it('breaks a new cue on a pause longer than 0.6s', () => {
    const words = [
      { word: 'First', startTime: 0, endTime: 0.3, confidence: 0.9 },
      { word: 'sentence.', startTime: 0.3, endTime: 0.6, confidence: 0.9 },
      { word: 'Second', startTime: 2.0, endTime: 2.3, confidence: 0.9 },
      { word: 'sentence.', startTime: 2.3, endTime: 2.6, confidence: 0.9 }
    ]
    const srt = formatTranscriptSrt(words)
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,600\nFirst sentence.\n')
    expect(srt).toContain('2\n00:00:02,000 --> 00:00:02,600\nSecond sentence.\n')
  })

  it('breaks a new cue after 8 words even with no pause', () => {
    const words = Array.from({ length: 10 }, (_, i) => ({
      word: `w${i}`, startTime: i * 0.2, endTime: i * 0.2 + 0.15, confidence: 0.9
    }))
    const srt = formatTranscriptSrt(words)
    const cueCount = srt.trim().split('\n\n').length
    expect(cueCount).toBe(2)
  })

  it('formats hour-scale timestamps correctly', () => {
    const words = [{ word: 'late', startTime: 3661.5, endTime: 3662.0, confidence: 0.9 }]
    const srt = formatTranscriptSrt(words)
    expect(srt).toContain('01:01:01,500 --> 01:01:02,000')
  })
})
