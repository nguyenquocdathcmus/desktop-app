import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { useT } from '../../hooks/useT'
import { useAuthStore } from '../../store/useAuthStore'
import { useAccountPanelStore } from '../../store/useAccountPanelStore'
import type { RecordingMeta } from '../../../../main/ipc/recordings-list-handler'
import type { SessionManifest } from '../../../../shared/project-types'

type SortKey = 'newest' | 'oldest' | 'longest' | 'largest'
type ViewMode = 'grid' | 'list'

function formatDuration(s: number) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

// Sprint 27 US-204/US-206 — was hardcoded to 'vi-VN' regardless of the
// user's actual language; now follows whatever locale the OS/browser
// reports (same source the i18n language picker defaults from), so a card's
// date format actually matches the rest of the UI's language.
function formatDate(ms: number) {
  const d = new Date(ms)
  return d.toLocaleDateString(navigator.language || 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Sprint 27 US-204 — small "codec/fps" detail line for the card info block,
 *  giving a professional-feeling amount of technical detail at a glance
 *  (mirrors what QuickTime/Screen Studio show) without cluttering the
 *  primary duration/resolution/size line. */
function formatFps(fps: number): string {
  return fps > 0 ? `${Math.round(fps)}fps` : ''
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="2.5" width="13" height="2.5" rx="0.8" fill="currentColor" />
      <rect x="1.5" y="6.75" width="13" height="2.5" rx="0.8" fill="currentColor" />
      <rect x="1.5" y="11" width="13" height="2.5" rx="0.8" fill="currentColor" />
    </svg>
  )
}

/** Sprint 27 follow-up — Settings was previously only reachable via the app
 *  menu (Cmd+,), with no button in the UI itself — this is the button. A
 *  proper gear (Heroicons-style cog outline), not the 8-point-star lookalike
 *  the first version drew. */
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.34 2.5a1.5 1.5 0 0 1 3.32 0l.1.35a1.5 1.5 0 0 0 2.24.9l.32-.19a1.5 1.5 0 0 1 2.06 2.06l-.19.32a1.5 1.5 0 0 0 .9 2.24l.35.1a1.5 1.5 0 0 1 0 3.32l-.35.1a1.5 1.5 0 0 0-.9 2.24l.19.32a1.5 1.5 0 0 1-2.06 2.06l-.32-.19a1.5 1.5 0 0 0-2.24.9l-.1.35a1.5 1.5 0 0 1-3.32 0l-.1-.35a1.5 1.5 0 0 0-2.24-.9l-.32.19a1.5 1.5 0 0 1-2.06-2.06l.19-.32a1.5 1.5 0 0 0-.9-2.24l-.35-.1a1.5 1.5 0 0 1 0-3.32l.35-.1a1.5 1.5 0 0 0 .9-2.24l-.19-.32A1.5 1.5 0 0 1 5.68 3.56l.32.19a1.5 1.5 0 0 0 2.24-.9l.1-.35Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

/** Sprint 28 follow-up — separate Profile/Account toolbar button (distinct
 *  from the Settings gear) so bumping into it always surfaces sign-in
 *  state immediately, per user feedback that bundling account status under
 *  a general gear icon made it too easy to miss. The small dot badge
 *  (rendered by the caller) marks "not signed in", mirroring how the
 *  recording-controls dot marks "visible". */
function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="6.75" r="3.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.75 16.5c0-3.176 2.798-5.75 6.25-5.75s6.25 2.574 6.25 5.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** Sprint 27 follow-up — toolbar toggle for showing/hiding the recording
 *  controls window; filled red dot when the controls window is visible,
 *  outlined when hidden, so the button doubles as a status indicator. */
function RecordDotIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="10" r="2.75" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} strokeWidth="1.3" />
    </svg>
  )
}

function SkeletonCard({ delayMs }: { delayMs: number }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)] opacity-0 animate-fadeInUp"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="aspect-video bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-tertiary)] to-[var(--bg-primary)] bg-[length:200%_100%] animate-shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-24 rounded bg-[var(--bg-tertiary)]" />
        <div className="h-2.5 w-32 rounded bg-[var(--bg-tertiary)]" />
      </div>
    </div>
  )
}

function RecordingThumbnail({ r }: { r: RecordingMeta }) {
  const [thumb, setThumb] = useState<string | null>(r.thumbnailDataUrl)

  useEffect(() => {
    if (thumb) return
    let active = true
    window.api.getThumbnail(r.id).then((url) => {
      if (active && url) setThumb(url)
    }).catch(() => {})
    return () => { active = false }
  }, [r.id, thumb])

  if (!thumb) {
    return <div className="w-full h-full bg-gradient-to-r from-[var(--bg-primary)] via-[var(--bg-tertiary)] to-[var(--bg-primary)] bg-[length:200%_100%] animate-shimmer" />
  }

  return (
    <img
      src={thumb}
      alt="Recording thumbnail"
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 opacity-0 animate-fadeIn"
    />
  )
}

// Sprint 27 US-203 — page size chosen to fill a first screenful at common
// grid widths (3-4 columns × several rows) without over-fetching.
const PAGE_SIZE = 24

export function HomeScreen() {
  const t = useT()
  const { status: authStatus } = useAuthStore()
  const { openPanel: openAccountPanel } = useAccountPanelStore()
  const SORT_LABELS: Record<SortKey, string> = {
    newest: t('homeScreen.sortNewest'),
    oldest: t('homeScreen.sortOldest'),
    longest: t('homeScreen.sortLongest'),
    largest: t('homeScreen.sortLargest')
  }
  const [recordings, setRecordings] = useState<RecordingMeta[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [controlsVisible, setControlsVisible] = useState(true)

  useEffect(() => {
    window.api.isRecordingControlsVisible().then(setControlsVisible).catch(() => {})
  }, [])

  async function toggleRecordingControls() {
    const ok = await window.api.setRecordingControlsVisible(!controlsVisible)
    if (ok) setControlsVisible(!controlsVisible)
  }

  async function commitRename(id: string) {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    await window.api.renameRecording(id, title)
    setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)))
  }
  const { newProjectFromManifest, openProject } = useProjectStore()
  const [unsavedPath, setUnsavedPath] = useState<string | null>(null)

  // Sprint 27 US-203 — first page loads via the normal loading skeleton;
  // "Load more" appends subsequent pages without re-fetching what's already shown.
  function load() {
    window.api.listRecordings({ limit: PAGE_SIZE, offset: 0 }).then(({ items, total: t, hasMore: more }) => {
      setRecordings(items)
      setTotal(t)
      setHasMore(more)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { items, total: t, hasMore: more } = await window.api.listRecordings({ limit: PAGE_SIZE, offset: recordings.length })
      setRecordings((prev) => [...prev, ...items])
      setTotal(t)
      setHasMore(more)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { load() }, [])

  // Sprint 12 US-104 — a project marked dirty right before the app was force-quit
  // (before the debounced autosave landed) surfaces once here so the edit isn't
  // silently lost.
  useEffect(() => {
    window.api.getUnsavedProjectFlag().then((path) => { if (path) setUnsavedPath(path) })
  }, [])

  async function handleRecoverProject() {
    if (!unsavedPath) return
    const path = unsavedPath
    setUnsavedPath(null)
    await openProject(path)
    window.api.clearUnsavedProjectFlag()
  }

  function handleDismissRecovery() {
    setUnsavedPath(null)
    window.api.clearUnsavedProjectFlag()
  }

  // Reload list when window regains focus (e.g. after returning from editor)
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    setDeleting(id)
    await window.api.deleteRecording(id)
    setDeleting(null)
    load()
  }

  function openRecording(r: RecordingMeta) {
    const manifest: SessionManifest = {
      id: r.id,
      version: 1,
      createdAt: r.createdAt,
      updatedAt: r.createdAt,
      videoPath: r.videoPath,
      cursorPath: r.videoPath.replace('capture.mov', 'cursor.json'),
      hasSystemAudio: false,
      displayId: 0,
      displayBounds: { x: 0, y: 0, width: r.width / 2, height: r.height / 2 },
      fps: 60,
      duration: r.duration,
      width: r.width,
      height: r.height
    }
    newProjectFromManifest(manifest).catch(console.error)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = recordings
    if (q) {
      list = list.filter((r) => (r.title ?? '').toLowerCase().includes(q) || formatDate(r.createdAt).toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    }
    const sorted = [...list]
    switch (sortKey) {
      case 'oldest': sorted.sort((a, b) => a.createdAt - b.createdAt); break
      case 'longest': sorted.sort((a, b) => b.duration - a.duration); break
      case 'largest': sorted.sort((a, b) => b.fileSize - a.fileSize); break
      default: sorted.sort((a, b) => b.createdAt - a.createdAt)
    }
    return sorted
  }, [recordings, query, sortKey])

  const recoveryBanner = unsavedPath && (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-[var(--bg-secondary)] border border-amber-500/30 rounded-xl shadow-2xl px-4 py-2.5">
      <span className="text-[12px] text-[var(--text-secondary)]">
        {t('homeScreen.recoveryFound')}
      </span>
      <button
        onClick={handleRecoverProject}
        className="text-[12px] font-medium text-white bg-amber-500 hover:bg-amber-400 px-3 py-1 rounded-lg transition-colors"
      >
        {t('homeScreen.recoveryRecover')}
      </button>
      <button
        onClick={handleDismissRecovery}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm leading-none"
        title={t('homeScreen.recoveryDiscard')}
        aria-label={t('homeScreen.recoveryDiscard')}
      >
        ×
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        {recoveryBanner}
        <div className="h-14 flex items-center mb-5">
          <div className="h-3 w-40 rounded bg-[var(--bg-secondary)]" />
        </div>
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} delayMs={Math.min(i, 9) * 30} />
          ))}
        </div>
      </div>
    )
  }

  if (recordings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8">
        {recoveryBanner}
        <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-4xl">
          🎬
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{t('homeScreen.emptyTitle')}</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs">
            {t('homeScreen.emptyBody')}
          </p>
        </div>
      </div>
    )
  }

  const countLabel = query.trim() || total === recordings.length
    ? (visible.length === 1 ? t('homeScreen.recordingCountOne') : t('homeScreen.recordingCountOther', { count: visible.length }))
    : t('homeScreen.recordingCountOf', { shown: recordings.length, total })

  return (
    <div className="flex-1 overflow-y-auto" onClick={() => setShowSortMenu(false)}>
      {recoveryBanner}
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border)] h-14 px-6 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] shrink-0">{t('homeScreen.title')}</h2>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('homeScreen.searchPlaceholder')}
          className="h-8 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all w-56"
        />

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu) }}
            className="h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
          >
            {SORT_LABELS[sortKey]}
            <span className="opacity-50">▾</span>
          </button>
          {showSortMenu && (
            <div
              className="absolute top-full mt-1 left-0 w-32 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => { setSortKey(k); setShowSortMenu(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${sortKey === k ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                >
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            title={t('homeScreen.gridView')}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <GridIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title={t('homeScreen.listView')}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-xs text-[var(--text-secondary)] shrink-0">
          {countLabel}
        </span>

        <div className="flex-1" />

        <button
          onClick={toggleRecordingControls}
          title={controlsVisible ? t('homeScreen.hideRecordingControls') : t('homeScreen.showRecordingControls')}
          aria-label={controlsVisible ? t('homeScreen.hideRecordingControls') : t('homeScreen.showRecordingControls')}
          aria-pressed={controlsVisible}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
            controlsVisible
              ? 'text-red-400 hover:bg-[var(--bg-hover)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <RecordDotIcon className="w-4 h-4" filled={controlsVisible} />
        </button>

        <button
          onClick={openAccountPanel}
          title={authStatus.state === 'signedIn' ? authStatus.user.email : 'Tài khoản — chưa đăng nhập'}
          aria-label="Tài khoản"
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        >
          <ProfileIcon className="w-4 h-4" />
          {authStatus.state !== 'signedIn' && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </button>

        <button
          onClick={() => window.api.openSettings()}
          title={t('settings.title')}
          aria-label={t('settings.title')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="p-6 grid grid-cols-3 xl:grid-cols-4 gap-5">
          {visible.map((r, i) => (
            <div
              key={r.id}
              className="group relative rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-indigo-500/50 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/40 transition-[transform,border-color,box-shadow] duration-200 cursor-pointer opacity-0 animate-fadeInUp"
              style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}
              onClick={() => openRecording(r)}
            >
              {/* Thumbnail — always dark, regardless of theme (it's a video preview, not UI chrome) */}
              <div className="relative aspect-video bg-black overflow-hidden">
                <RecordingThumbnail r={r} />
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                  {formatDuration(r.duration)}
                </div>
                {/* Sprint 26 US-199 — unresolved comment count, so it's clear
                    at a glance which recordings still need follow-up before
                    they're safe to publish/consider done. */}
                {r.unresolvedCommentCount > 0 && (
                  <div
                    className="absolute top-2 left-2 bg-amber-500/90 text-black text-[9px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
                    title={`${r.unresolvedCommentCount} unresolved review comment${r.unresolvedCommentCount > 1 ? 's' : ''}`}
                  >
                    💬 {r.unresolvedCommentCount}
                  </div>
                )}
                {/* Publish badges (Sprint 21 US-170) — where this recording has
                    already been sent, so it's obvious at a glance without
                    reopening the export modal to check. */}
                {r.publishHistory.length > 0 && (
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    {[...new Set(r.publishHistory.map((p) => p.provider))].map((provider) => (
                      <span
                        key={provider}
                        onClick={(e) => {
                          e.stopPropagation()
                          const latest = [...r.publishHistory].reverse().find((p) => p.provider === provider)
                          if (latest) window.open(latest.url, '_blank')
                        }}
                        title={`Published to ${provider}`}
                        className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-sm cursor-pointer hover:bg-indigo-500/80 transition-colors"
                      >
                        {provider === 'youtube' ? '▶ YouTube' : provider === 'googleDrive' ? '📁 Drive' : '📦 Dropbox'}
                      </span>
                    ))}
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors duration-200 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/0 group-hover:bg-white/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100">
                    <span className="text-white text-lg ml-0.5">▶</span>
                  </div>
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(e, r.id)}
                  disabled={deleting === r.id}
                  className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/60 hover:bg-red-500/90 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm z-10"
                  title={t('homeScreen.deleteRecording')}
                aria-label={t('homeScreen.deleteRecording')}
                >
                  {deleting === r.id ? '…' : '✕'}
                </button>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {r.title ?? t('homeScreen.untitledRecording')}
                  </p>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono shrink-0">
                    {formatDuration(r.duration)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                    <span>{formatDate(r.createdAt)}</span>
                    <span className="opacity-50">·</span>
                    <span>{r.width > 0 ? `${Math.round(r.width / 2)}×${Math.round(r.height / 2)}` : '—'}</span>
                    {formatFps(r.fps) && (
                      <>
                        <span className="opacity-50">·</span>
                        <span>{formatFps(r.fps)}</span>
                      </>
                    )}
                    <span className="opacity-50">·</span>
                    <span>{formatSize(r.fileSize)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.api.showInFolder(r.videoPath) }}
                    className="w-6 h-6 rounded-md text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-[var(--bg-hover)]"
                    title={t('homeScreen.showInFinder')}
                  aria-label={t('homeScreen.showInFinder')}
                  >
                    📁
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 flex flex-col gap-2">
          {visible.map((r, i) => (
            <div
              key={r.id}
              className="group flex items-center gap-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-indigo-500/50 hover:bg-[var(--bg-tertiary)] transition-colors duration-150 cursor-pointer opacity-0 animate-fadeInUp p-2"
              style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}
              onClick={() => openRecording(r)}
            >
              <div className="relative w-28 aspect-video rounded-md bg-black overflow-hidden shrink-0">
                <RecordingThumbnail r={r} />
                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 rounded backdrop-blur-sm">
                  {formatDuration(r.duration)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {renamingId === r.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(r.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => commitRename(r.id)}
                    className="w-full h-6 px-1.5 rounded bg-[var(--bg-primary)] border border-indigo-500/50 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-xs font-medium text-[var(--text-primary)] truncate"
                      title={t('homeScreen.renameHint')}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setRenamingId(r.id)
                        setRenameValue(r.title ?? '')
                      }}
                    >
                      {r.title ?? t('homeScreen.untitledRecording')}
                    </p>
                    <span className="text-[10px] text-[var(--text-secondary)] font-mono shrink-0">
                      {formatDuration(r.duration)}
                    </span>
                  </div>
                )}
                {/* Sprint 27 US-205 — the timestamp used to only appear here
                    as a stand-in for a missing title, which reads as "this
                    row's date" sitting where a name belongs. Moved to its own
                    line alongside the other info (resolution/fps/size) so it
                    reads as metadata, not identity, regardless of whether the
                    recording has a title. */}
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mt-0.5">
                  <span>{formatDate(r.createdAt)}</span>
                  <span className="opacity-50">·</span>
                  <span>{r.width > 0 ? `${Math.round(r.width / 2)}×${Math.round(r.height / 2)}` : '—'}</span>
                  {formatFps(r.fps) && (
                    <>
                      <span className="opacity-50">·</span>
                      <span>{formatFps(r.fps)}</span>
                    </>
                  )}
                  <span className="opacity-50">·</span>
                  <span>{formatSize(r.fileSize)}</span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); window.api.showInFolder(r.videoPath) }}
                className="w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-[var(--bg-hover)] shrink-0"
                title={t('homeScreen.showInFinder')}
                  aria-label={t('homeScreen.showInFinder')}
              >
                📁
              </button>
              <button
                onClick={(e) => handleDelete(e, r.id)}
                disabled={deleting === r.id}
                className="w-7 h-7 rounded-md text-[var(--text-secondary)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-[var(--bg-hover)] shrink-0"
                title={t('homeScreen.deleteRecording')}
                aria-label={t('homeScreen.deleteRecording')}
              >
                {deleting === r.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sprint 27 US-203 — hidden while searching: search only covers
          already-loaded pages, so "load more" during a search would silently
          fetch items that still won't match until they're paged in, which
          reads as broken rather than as "load more unfiltered results." */}
      {hasMore && !query.trim() && (
        <div className="flex justify-center pb-8">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="h-9 px-5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-indigo-500/50 text-sm text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            {loadingMore ? t('homeScreen.loading') : t('homeScreen.loadMore')}
          </button>
        </div>
      )}
    </div>
  )
}
