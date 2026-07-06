/**
 * Sprint 13 US-112 — i18n foundation, originally for one language only.
 * Sprint 27 US-206/207/208 made this the base/reference/fallback locale for
 * 13 languages (see strings/index.ts) — every other locale file must have
 * the exact same shape as this one; useT() falls back to this file's value
 * for any key missing from the active locale.
 */
export const en = {
  controlBar: {
    undo: 'Undo',
    redo: 'Redo',
    play: 'Play',
    pause: 'Pause',
    seek: 'Seek'
  },
  recording: {
    startRecording: 'Start Recording',
    stop: 'Stop',
    resume: 'Resume',
    pauseAction: 'Pause',
    cancel: 'Cancel',
    savedOpeningEditor: 'Saved — opening editor…',
    statusReady: 'Ready to record',
    statusRecording: 'Recording',
    statusPaused: 'Recording paused',
    statusSaving: 'Saving recording',
    statusSaved: 'Recording saved'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Text',
    addScene: '+ Scene',
    detectSilences: 'Detect silences',
    detecting: 'Detecting…',
    splitAt: 'Split at'
  },
  exportModal: {
    title: 'Export',
    cancel: 'Cancel',
    exporting: 'Exporting…',
    copyFile: 'Copy file',
    copied: 'Copied ✓',
    drag: 'Drag',
    showInFinder: 'Show in Finder'
  },
  homeScreen: {
    title: 'Recent Recordings',
    searchPlaceholder: 'Search by name or date…',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortLongest: 'Longest',
    sortLargest: 'Largest',
    gridView: 'Grid view',
    listView: 'List view',
    showRecordingControls: 'Show recording controls',
    hideRecordingControls: 'Hide recording controls',
    recordingCountOne: '1 recording',
    recordingCountOther: '{count} recordings',
    recordingCountOf: '{shown} of {total}',
    emptyTitle: 'No recordings yet',
    emptyBody: 'Use the controls window to start your first screen recording.',
    untitledRecording: 'Untitled Recording',
    showInFinder: 'Show in Finder',
    deleteRecording: 'Delete recording',
    renameHint: 'Double-click to rename',
    loadMore: 'Load more',
    loading: 'Loading…',
    recoveryFound: 'Found unsaved work from a previous session',
    recoveryRecover: 'Recover',
    recoveryDiscard: 'Discard'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageHint: 'Applies immediately across the app.',
    theme: 'Appearance',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    analyticsToggle: 'Share anonymous usage data',
    analyticsHint: 'Which features you use and export config — never video content, annotation text, or real file paths.',
    publishDestinations: 'Publish destinations',
    connect: 'Connect',
    disconnect: 'Disconnect',
    shortcutTitle: 'Global start/stop shortcut',
    shortcutHint: "Works even when Screen Studio isn't focused.",
    shortcutSet: 'Set',
    shortcutChange: 'Change',
    shortcutClear: 'Clear',
    shortcutNotSet: 'Not set',
    shortcutRecording: 'Press any key combination… (Esc to cancel)'
  }
} as const

export type Strings = typeof en
