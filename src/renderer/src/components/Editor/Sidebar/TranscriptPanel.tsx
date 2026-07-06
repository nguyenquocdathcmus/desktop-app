import { useState } from 'react'
import { useProjectStore, isFillerWord } from '../../../store/useProjectStore'
import { usePlaybackStore } from '../../../store/usePlaybackStore'
import { formatTranscriptSrt } from '../../../transcriptSrtFormat'

/**
 * Sprint 24 US-184/185/186/187 — read-and-edit transcript panel. Click a word
 * to seek; click-drag to select a range and delete it (ripple-deletes the
 * matching video range via deleteTranscriptRange, Sprint 9's split/remove
 * pattern); one-click bulk-remove flagged filler words; export SRT.
 */
export function TranscriptPanel() {
  const { project, transcript, generatingTranscript, transcriptError, generateTranscript, deleteTranscriptRange } = useProjectStore()
  const { seek } = usePlaybackStore()
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  if (!project) return null

  const fillerCount = transcript.filter((w) => isFillerWord(w.word)).length
  const hasSelection = selStart !== null && selEnd !== null && selEnd > selStart

  function wordIndexAt(i: number) {
    return i >= (selStart ?? Infinity) && i <= (selEnd ?? -Infinity)
  }

  function handleWordMouseDown(i: number) {
    setDragging(true)
    setSelStart(i)
    setSelEnd(i)
  }

  function handleWordMouseEnter(i: number) {
    if (!dragging || selStart === null) return
    setSelEnd(i < selStart ? selStart : i)
    if (i < selStart) setSelStart(i)
  }

  function handleWordClick(i: number, t: number) {
    if (dragging && hasSelection) return // was a drag, not a plain click
    seek(t)
  }

  function clearSelection() {
    setSelStart(null)
    setSelEnd(null)
  }

  function handleDeleteSelection() {
    if (selStart === null || selEnd === null) return
    const start = transcript[selStart].startTime
    const end = transcript[selEnd].endTime
    deleteTranscriptRange(start, end)
    clearSelection()
  }

  function handleRemoveFillerWords() {
    const flagged = transcript.filter((w) => isFillerWord(w.word)).sort((a, b) => b.startTime - a.startTime)
    for (const w of flagged) deleteTranscriptRange(w.startTime, w.endTime)
  }

  async function handleExportSrt() {
    const srt = formatTranscriptSrt(transcript)
    const base = project!.manifest.videoPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'transcript'
    await window.api.exportTranscriptSrt(srt, `${base}.srt`)
  }

  return (
    <div className="panel" onMouseUp={() => setDragging(false)}>
      <div className="flex items-center justify-between mb-3">
        <p className="label">Transcript</p>
        {transcript.length > 0 && (
          <button
            onClick={handleExportSrt}
            className="text-[10px] text-[var(--text-secondary)] hover:text-indigo-300 transition-colors"
          >
            Export SRT
          </button>
        )}
      </div>

      {transcript.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            Transcribes on-device (Speech framework) — audio never leaves this Mac. Click a word to jump to it; drag to select a range and delete it.
          </p>
          <button
            onClick={generateTranscript}
            disabled={generatingTranscript}
            className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-300 rounded-md px-3 py-1.5 transition-colors"
          >
            {generatingTranscript ? 'Transcribing…' : 'Generate transcript'}
          </button>
          {transcriptError && (
            <p className="text-[10px] text-amber-400/90 leading-relaxed">{transcriptError}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {fillerCount > 0 && (
            <button
              onClick={handleRemoveFillerWords}
              className="text-[10px] text-left bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-md px-2 py-1.5 transition-colors"
            >
              Remove {fillerCount} filler word{fillerCount > 1 ? 's' : ''} (um, uh, like…)
            </button>
          )}

          <div className="max-h-64 overflow-y-auto text-[12px] leading-relaxed select-none">
            {transcript.map((w, i) => (
              <span
                key={i}
                onMouseDown={() => handleWordMouseDown(i)}
                onMouseEnter={() => handleWordMouseEnter(i)}
                onClick={() => handleWordClick(i, w.startTime)}
                className={`cursor-pointer rounded px-0.5 transition-colors ${
                  wordIndexAt(i)
                    ? 'bg-indigo-500/40 text-white'
                    : isFillerWord(w.word)
                      ? 'text-amber-400/70 hover:bg-white/10'
                      : 'text-[var(--text-primary)] hover:bg-white/10'
                }`}
              >
                {w.word}{' '}
              </span>
            ))}
          </div>

          {hasSelection && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteSelection}
                className="text-[10px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-md px-2 py-1 transition-colors"
              >
                Delete selection
              </button>
              <button
                onClick={clearSelection}
                className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={generateTranscript}
            disabled={generatingTranscript}
            className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors self-start"
          >
            {generatingTranscript ? 'Re-transcribing…' : 'Regenerate'}
          </button>
        </div>
      )}
    </div>
  )
}
