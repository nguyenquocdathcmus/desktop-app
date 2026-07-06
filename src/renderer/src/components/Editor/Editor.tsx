import { useState, useEffect } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { usePlaybackStore } from '../../store/usePlaybackStore'
import { PreviewCanvas } from './PreviewCanvas'
import { Sidebar } from './Sidebar/Sidebar'
import { ControlBar } from './ControlBar'
import { ExportModal } from '../Export/ExportModal'
import { Timeline } from '../Timeline/Timeline'
import { HomeScreen } from './HomeScreen'
import { ErrorBoundary } from '../ErrorBoundary'
import { registerCommands } from '../../commands'
import { Hint } from '../Common/Hint'
import { trackEvent } from '../../analytics'

export function Editor() {
  const { project, closeProject, undo, redo, detectSilences } = useProjectStore()
  const { togglePlay } = usePlaybackStore()
  const [exportOpen, setExportOpen] = useState(false)

  // Sprint 13 US-115 — register the actions this screen owns with the command
  // palette. Re-registers whenever `project` presence flips so commands that
  // need an open project (undo/export/detect silences) aren't offered on Home.
  useEffect(() => {
    if (!project) return
    trackEvent('editor_opened')
    return registerCommands([
      { id: 'export', label: 'Export…', group: 'Export', run: () => setExportOpen(true) },
      { id: 'undo', label: 'Undo', group: 'Editing', run: undo, keys: '⌘Z' },
      { id: 'redo', label: 'Redo', group: 'Editing', run: redo, keys: '⌘⇧Z' },
      { id: 'play-pause', label: 'Play/Pause', group: 'Playback', run: togglePlay, keys: 'Space' },
      { id: 'detect-silences', label: 'Detect Silences', group: 'Timeline', run: () => { detectSilences() } },
      { id: 'back-home', label: 'Back to Home', group: 'Editing', run: closeProject }
    ])
  }, [project, undo, redo, togglePlay, detectSilences, closeProject])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* macOS titlebar drag area */}
      <div className="h-10 titlebar-drag flex items-center px-4 shrink-0">
        <div className="ml-16 flex items-center gap-2 titlebar-no-drag">
          {project && (
            <button
              onClick={closeProject}
              className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-md hover:bg-white/5"
              title="Back to home"
            >
              ← Home
            </button>
          )}
          <span className="text-sm text-[var(--text-primary)] font-medium">
            {project ? 'Untitled Recording' : 'Record Screen'}
          </span>
        </div>
        {project && (
          <div className="ml-auto titlebar-no-drag pr-2 flex items-center gap-2">
            <button
              onClick={() => window.api.showInFolder(project.manifest.videoPath)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-md hover:bg-white/5"
              title="Show in Finder"
            >
              📁 Show in Finder
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Export ↑
            </button>
          </div>
        )}
      </div>

      {project ? (
        <ErrorBoundary name="Editor">
          <div className="flex flex-1 overflow-hidden">
            {/* Main preview area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <Hint id="command-palette-exists" active className="mx-4 mt-2">
                Tip: press ⌘K anytime to jump to any action — export, undo, detect silences, and more. Press ⌘/ for the full shortcuts list.
              </Hint>
              <PreviewCanvas />
              <ControlBar />
              <Timeline />
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="Home">
          <HomeScreen />
        </ErrorBoundary>
      )}

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}

