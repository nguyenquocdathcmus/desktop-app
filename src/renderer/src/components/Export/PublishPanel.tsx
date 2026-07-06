import { useEffect, useState } from 'react'
import { formatChapterList } from '../../chapterListFormat'
import type { Chapter, ReviewComment } from '../../../../shared/project-types'

type PublishProvider = 'youtube' | 'googleDrive' | 'dropbox'

const PROVIDER_LABELS: Record<PublishProvider, string> = {
  youtube: 'YouTube',
  googleDrive: 'Google Drive',
  dropbox: 'Dropbox'
}

interface Props {
  exportedFilePath: string
  recordingTitle: string
  chapters: Chapter[]
  reviewComments?: ReviewComment[]
}

/**
 * Sprint 21 US-168 — publish panel, shown once export completes. Separate
 * from export progress on purpose (US-168's design note): export is
 * CPU-bound (ffmpeg) and already done by the time this renders; publish is
 * network-bound and starts fresh, so they never share a progress bar.
 *
 * OAuth/upload are BLOCKED pending real API credentials (providers.ts) — this
 * panel is fully wired and will start working the moment those are set,
 * without any renderer-side changes.
 */
export function PublishPanel({ exportedFilePath, recordingTitle, chapters, reviewComments = [] }: Props) {
  const [connected, setConnected] = useState<PublishProvider[]>([])
  const [uploading, setUploading] = useState<PublishProvider | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [results, setResults] = useState<Record<string, { url?: string; error?: string }>>({})
  // Sprint 26 US-195 — off by default; a comment left for yourself while
  // editing ("fix this later") shouldn't automatically go out with the file.
  const [includeComments, setIncludeComments] = useState(false)
  const [reviewPageStatus, setReviewPageStatus] = useState<string | null>(null)

  useEffect(() => {
    window.api.listPublishConnections().then(setConnected)
  }, [])

  useEffect(() => window.api.onPublishProgress(({ provider, percent }) => {
    if (provider === uploading) setProgress(percent)
  }), [uploading])

  async function handlePublish(provider: PublishProvider) {
    setUploading(provider)
    setProgress(0)
    setResults((r) => ({ ...r, [provider]: {} }))

    const description = chapters.length > 0 ? formatChapterList(chapters) : ''
    const result = await window.api.uploadToPublishDestination(provider, exportedFilePath, recordingTitle, description)

    setUploading(null)
    setResults((r) => ({
      ...r,
      [provider]: result.ok ? { url: result.url } : { error: result.error }
    }))

    // Sprint 26 US-195 — write the comments sidecar next to the video only
    // after a successful upload, using the exported (local) file's path —
    // the sidecar travels with whatever the user does with the video next
    // (e.g. also dragging it into Drive manually), not tied to any one provider.
    if (result.ok && includeComments && reviewComments.length > 0) {
      await window.api.exportCommentsJson(exportedFilePath, reviewComments)
    }
  }

  async function handleExportReviewPage() {
    setReviewPageStatus(null)
    const youtubeResult = results['youtube']
    const driveResult = results['googleDrive']
    const result = await window.api.exportReviewPage({
      title: recordingTitle,
      comments: reviewComments,
      youtubeUrl: youtubeResult?.url,
      // Drive share URLs are of the form .../d/<id>/view — extract the id.
      driveFileId: driveResult?.url?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1],
      suggestedName: `${recordingTitle}-review.html`
    })
    setReviewPageStatus(result.ok ? `Saved to ${result.path}` : 'Cancelled')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Publish</p>

      {connected.length === 0 ? (
        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
          No publish destinations connected yet — connect YouTube, Google Drive, or Dropbox in Settings (⌘,) to publish straight from here.
        </p>
      ) : (
        <>
          {reviewComments.length > 0 && (
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="accent-indigo-500"
              />
              Include {reviewComments.length} review comment{reviewComments.length > 1 ? 's' : ''} as a sidecar file
            </label>
          )}
          {connected.map((provider) => {
            const res = results[provider]
            return (
              <div key={provider} className="flex items-center gap-2">
                <button
                  onClick={() => handlePublish(provider)}
                  disabled={uploading !== null}
                  className="shrink-0 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[var(--text-primary)] text-[11px] font-medium transition-colors disabled:opacity-40"
                >
                  {uploading === provider ? `Uploading… ${progress}%` : `Publish to ${PROVIDER_LABELS[provider]}`}
                </button>
                {res?.url && (
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 truncate"
                    title={res.url}
                  >
                    {res.url}
                  </a>
                )}
                {res?.error && (
                  <span className="text-[10px] text-amber-400/90 truncate" title={res.error}>{res.error}</span>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Sprint 26 US-196 — works even without a publish connection: the page
          just shows "no video link" until one exists, still useful for
          sharing comments alone or after a manual upload elsewhere. */}
      <div className="pt-1 border-t border-white/5 mt-1">
        <button
          onClick={handleExportReviewPage}
          className="text-[10px] text-[var(--text-secondary)] hover:text-indigo-300 transition-colors"
        >
          Export shareable review page (no app required to view)
        </button>
        {reviewPageStatus && (
          <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate" title={reviewPageStatus}>{reviewPageStatus}</p>
        )}
      </div>
    </div>
  )
}
