import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/constants'
import type {
  StartOptions,
  ExportOptions,
  DisplayInfo,
  WindowInfo,
  RecordingStatus,
  IpcInvokeMap,
  ProjectState,
  SessionManifest
} from '../shared/ipc-types'
import type { CursorEvent } from '../shared/project-types'
import type { RecordingMeta } from '../main/ipc/recordings-list-handler'
import type { LocaleCode } from '../shared/locales'
import type { AuthStatus } from '../main/auth/AuthService'
import type { SubscriptionInfo } from '../main/ipc/billing-handlers'

// Expose typed API to renderer via contextBridge
// renderer accesses via window.api.*
const api = {
  // --- Recording ---
  getDisplays: (): Promise<DisplayInfo[]> =>
    ipcRenderer.invoke(IPC.RECORDING_GET_DISPLAYS),

  getWindows: (): Promise<WindowInfo[]> =>
    ipcRenderer.invoke(IPC.RECORDING_GET_WINDOWS),

  startRecording: (opts: StartOptions): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_START, opts),

  stopRecording: (): Promise<{ ok: true; manifest: SessionManifest } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_STOP),

  pauseRecording: (): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_PAUSE),

  resumeRecording: (): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.RECORDING_RESUME),

  getRecordingStatus: (): Promise<RecordingStatus> =>
    ipcRenderer.invoke(IPC.RECORDING_GET_STATUS),

  onRecordingStatus: (cb: (status: RecordingStatus) => void) => {
    const handler = (_: unknown, payload: RecordingStatus) => cb(payload)
    ipcRenderer.on(IPC.RECORDING_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.RECORDING_STATUS, handler)
  },

  // Sprint 23 US-179/US-180 — menu bar "Start Recording" click and the global
  // keyboard shortcut both funnel through this one event so the controls
  // window's own start/stop logic (countdown, disk-space check, etc.) is the
  // single source of truth instead of duplicating it in main.
  onRecordingToggleRequested: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('recording:toggle-requested', handler)
    return () => ipcRenderer.removeListener('recording:toggle-requested', handler)
  },

  getRecordingShortcut: (): Promise<string | null> => ipcRenderer.invoke('recording:get-shortcut'),
  setRecordingShortcut: (accelerator: string | null): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('recording:set-shortcut', accelerator),

  // --- Export ---
  startExport: (opts: ExportOptions): Promise<{ ok: true; outputPath: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.EXPORT_START, opts),

  cancelExport: (): void => {
    ipcRenderer.send(IPC.EXPORT_CANCEL)
  },

  onExportProgress: (cb: (payload: { percent: number; eta?: number }) => void) => {
    ipcRenderer.on(IPC.EXPORT_PROGRESS, (_, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners(IPC.EXPORT_PROGRESS)
  },

  onExportDone: (cb: (payload: { outputPath: string }) => void) => {
    ipcRenderer.on(IPC.EXPORT_DONE, (_, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners(IPC.EXPORT_DONE)
  },

  onExportError: (cb: (payload: { message: string }) => void) => {
    ipcRenderer.on(IPC.EXPORT_ERROR, (_, payload) => cb(payload))
    return () => ipcRenderer.removeAllListeners(IPC.EXPORT_ERROR)
  },

  // --- Project ---
  saveProject: (projectPath: string, state: ProjectState, force?: boolean): Promise<{ ok: boolean; conflict?: boolean }> =>
    ipcRenderer.invoke(IPC.PROJECT_SAVE, { projectPath, state, force }),
  peekProjectOnDisk: (projectPath: string): Promise<ProjectState | null> =>
    ipcRenderer.invoke('project:peek-on-disk', { projectPath }),

  openProject: (projectPath: string): Promise<ProjectState | null> =>
    ipcRenderer.invoke(IPC.PROJECT_OPEN, { projectPath }),

  getRecentProjects: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC.PROJECT_GET_RECENT),

  markProjectDirty: (projectPath: string): void => {
    ipcRenderer.send('project:mark-dirty', { projectPath })
  },

  // --- Mic audio ---
  saveMicAudio: (data: Uint8Array, leadMs?: number): Promise<void> =>
    ipcRenderer.invoke('recording:save-mic-audio', data, leadMs ?? 0),

  // --- Webcam video ---
  saveWebcamVideo: (data: Uint8Array): Promise<void> =>
    ipcRenderer.invoke('recording:save-webcam-video', data),

  // --- Shell ---
  showInFolder: (filePath: string): void => ipcRenderer.send('shell:showInFolder', filePath),

  // --- Window ---
  focusEditor: (): void => ipcRenderer.send('editor:focus'),
  openWebcamWindow: (deviceId?: string): void => ipcRenderer.send('webcam:open', { deviceId }),
  closeWebcamWindow: (): void => ipcRenderer.send('webcam:close'),
  setControlsMode: (mode: 'panel' | 'pill'): void => ipcRenderer.send('controls:setMode', mode),
  // Sprint 27 follow-up — show/hide the recording controls window from
  // HomeScreen. setRecordingControlsVisible resolves false (and leaves the
  // window shown) if a recording is in progress — see main/index.ts.
  setRecordingControlsVisible: (visible: boolean): Promise<boolean> =>
    ipcRenderer.invoke('controls:setVisible', visible),
  isRecordingControlsVisible: (): Promise<boolean> =>
    ipcRenderer.invoke('controls:isVisible'),

  // --- Notification auto-detect (Sprint 22 US-174) — experimental, always
  // surfaces suggestions for manual confirm, never applies a blur automatically ---
  detectNotifications: (videoPath: string): Promise<Array<{
    startTime: number; endTime: number; x: number; y: number; width: number; height: number; confidence: number
  }>> => ipcRenderer.invoke('notifications:detect', { videoPath }),

  // --- Transcript (Sprint 24 US-183) — on-device only (SFSpeechRecognizer
  // requiresOnDeviceRecognition), audio never leaves the machine ---
  generateTranscript: (audioPath: string, locale?: string): Promise<
    { ok: true; words: Array<{ word: string; startTime: number; endTime: number; confidence: number }> }
    | { ok: false; error: string }
  > => ipcRenderer.invoke('transcript:generate', { audioPath, locale }),
  exportTranscriptSrt: (srtContent: string, suggestedName: string): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke('transcript:export-srt', { srtContent, suggestedName }),

  // --- Review page / comments (Sprint 26 US-195/196/197) ---
  exportCommentsJson: (
    videoPath: string,
    comments: Array<{ id: string; t: number; text: string; author?: string; resolved?: boolean }>
  ): Promise<{ ok: boolean; path?: string }> =>
    ipcRenderer.invoke('review:export-comments-json', { videoPath, comments }),
  exportReviewPage: (opts: {
    title: string
    comments: Array<{ id: string; t: number; text: string; author?: string; resolved?: boolean }>
    youtubeUrl?: string
    driveFileId?: string
    suggestedName: string
  }): Promise<{ ok: boolean; path?: string }> => ipcRenderer.invoke('review:export-page', opts),
  importCommentsJson: (): Promise<{
    ok: boolean
    comments?: Array<{ id: string; t: number; text: string; author?: string }>
  }> => ipcRenderer.invoke('review:import-comments-json'),

  // --- Locale (Sprint 27 US-206/207) ---
  getLocale: (): Promise<LocaleCode> => ipcRenderer.invoke('locale:get'),
  setLocale: (locale: LocaleCode): void => ipcRenderer.send('locale:set', locale),

  // --- Theme (Sprint 27 US-209) ---
  getThemePreference: (): Promise<'dark' | 'light' | 'system'> => ipcRenderer.invoke('theme:get'),
  setThemePreference: (preference: 'dark' | 'light' | 'system'): void => ipcRenderer.send('theme:set', preference),

  // --- Auth (Sprint 28 US-212/213/214) — Supabase, all calls proxied
  // through main; renderer never touches the Supabase client or a raw token ---
  getAuthStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:get-status'),
  authSignUp: (email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('auth:sign-up', { email, password }),
  authSignIn: (email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('auth:sign-in', { email, password }),
  authSignInWithOAuth: (provider: 'google' | 'github'): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('auth:sign-in-oauth', { provider }),
  authSignOut: (): Promise<{ ok: true }> => ipcRenderer.invoke('auth:sign-out'),
  onAuthStatusChanged: (cb: (status: AuthStatus) => void) => {
    const handler = (_: unknown, status: AuthStatus) => cb(status)
    ipcRenderer.on('auth:status-changed', handler)
    return () => ipcRenderer.removeListener('auth:status-changed', handler)
  },

  // --- Billing (Sprint 28 US-215/216/217) — Paddle ---
  getSubscriptionStatus: (): Promise<SubscriptionInfo> => ipcRenderer.invoke('billing:get-subscription'),
  createCheckoutUrl: (): Promise<{ ok: true; url: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('billing:create-checkout-url'),
  openBillingPortal: (): Promise<{ ok: true; url: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('billing:open-portal'),

  // --- Recordings list ---
  // Sprint 27 US-203 — paginated; omit opts to get everything in one call
  // (back-compat for any caller that doesn't care about paging).
  listRecordings: (opts?: { limit?: number; offset?: number }): Promise<{
    items: RecordingMeta[]
    total: number
    hasMore: boolean
  }> => ipcRenderer.invoke('recordings:list', opts),
  deleteRecording: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke('recordings:delete', { id }),
  getThumbnail: (id: string): Promise<string | null> => ipcRenderer.invoke('recordings:get-thumbnail', { id }),

  // --- Permissions ---
  checkPermissions: (): Promise<{ screen: boolean; accessibility: boolean; microphone: boolean; camera: boolean }> =>
    ipcRenderer.invoke('permissions:check'),

  requestCameraPermission: (): Promise<boolean> =>
    ipcRenderer.invoke('permissions:request-camera'),

  openPrivacySettings: (pane: 'microphone' | 'camera' | 'screen'): void =>
    ipcRenderer.send('permissions:open-settings', pane),

  // --- Cursor data ---
  readCursorData: (cursorPath: string): Promise<CursorEvent[]> =>
    ipcRenderer.invoke('cursor:read', { cursorPath }),

  // --- Audio analysis (Sprint 9) ---
  detectSilence: (videoPath: string, opts?: { noiseDb?: number; minDuration?: number }): Promise<{ start: number; end: number }[]> =>
    ipcRenderer.invoke('audio:detect-silence', { videoPath, ...opts }),

  fileExists: (path: string): Promise<boolean> =>
    ipcRenderer.invoke('file:exists', { path }),

  // --- Style presets (Sprint 10) ---
  listPresets: (): Promise<{ presets: { name: string; state: unknown }[]; defaultName: string | null }> =>
    ipcRenderer.invoke('presets:list'),
  savePreset: (name: string, state: unknown): Promise<void> =>
    ipcRenderer.invoke('presets:save', { name, state }),
  deletePreset: (name: string): Promise<void> =>
    ipcRenderer.invoke('presets:delete', { name }),
  setDefaultPreset: (name: string | null): Promise<void> =>
    ipcRenderer.invoke('presets:set-default', { name }),

  // --- Templates (Sprint 15) ---
  listTemplates: (): Promise<{ templates: { name: string; template: unknown }[] }> =>
    ipcRenderer.invoke('templates:list'),
  saveTemplate: (name: string, template: unknown): Promise<void> =>
    ipcRenderer.invoke('templates:save', { name, template }),
  deleteTemplate: (name: string): Promise<void> =>
    ipcRenderer.invoke('templates:delete', { name }),

  // --- Deep link / timestamp share (Sprint 15 US-127) ---
  onOpenDeepLink: (cb: (link: { projectPath: string; t: number }) => void) => {
    const handler = (_: unknown, payload: { projectPath: string; t: number }) => cb(payload)
    ipcRenderer.on('app:open-deep-link', handler)
    return () => ipcRenderer.removeListener('app:open-deep-link', handler)
  },

  // --- Recording rename (Sprint 10) ---
  renameRecording: (id: string, title: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('recordings:rename', { id, title }),

  // --- Quick share (Sprint 10) ---
  copyFileToClipboard: (path: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('share:copy-file', { path }),
  startFileDrag: (path: string): void =>
    ipcRenderer.send('share:start-drag', { path }),

  // --- Face detection (Sprint 11) ---
  detectFaces: (webcamPath: string): Promise<{ t: number; cx: number; cy: number }[]> =>
    ipcRenderer.invoke('webcam:detect-faces', { webcamPath }),

  // --- Auto-update (Sprint 12) ---
  checkForUpdate: (): Promise<{ status: 'checked' | 'dev-skipped' | 'error'; message?: string }> =>
    ipcRenderer.invoke('update:check'),
  installUpdate: (): void => { ipcRenderer.invoke('update:install') },
  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    const handler = (_: unknown, payload: { version: string }) => cb(payload)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    const handler = (_: unknown, payload: { version: string }) => cb(payload)
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.removeListener('update:downloaded', handler)
  },

  // --- App info / crash recovery (Sprint 12) ---
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  checkDiskSpace: (): Promise<{ freeGB: number; low: boolean }> => ipcRenderer.invoke('app:check-disk-space'),
  getUnsavedProjectFlag: (): Promise<string | null> => ipcRenderer.invoke('app:get-unsaved-flag'),
  clearUnsavedProjectFlag: (): void => { ipcRenderer.send('app:clear-unsaved-flag') },
  isOnboarded: (): Promise<boolean> => ipcRenderer.invoke('app:is-onboarded'),
  setOnboarded: (): void => { ipcRenderer.send('app:set-onboarded') },

  // --- Proxy preview (Sprint 16) ---
  getProxyStatus: (videoPath: string): Promise<{ ready: boolean; proxyPath: string | null }> =>
    ipcRenderer.invoke('proxy:get-status', { videoPath }),
  generateProxy: (videoPath: string): Promise<{ started: boolean }> =>
    ipcRenderer.invoke('proxy:generate', { videoPath }),
  onProxyProgress: (cb: (payload: { videoPath: string; percent: number }) => void) => {
    const handler = (_: unknown, payload: { videoPath: string; percent: number }) => cb(payload)
    ipcRenderer.on('proxy:progress', handler)
    return () => ipcRenderer.removeListener('proxy:progress', handler)
  },
  onProxyReady: (cb: (payload: { videoPath: string; proxyPath: string }) => void) => {
    const handler = (_: unknown, payload: { videoPath: string; proxyPath: string }) => cb(payload)
    ipcRenderer.on('proxy:ready', handler)
    return () => ipcRenderer.removeListener('proxy:ready', handler)
  },

  // --- Discoverability (Sprint 17) ---
  onOpenShortcutsOverlay: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:open-shortcuts-overlay', handler)
    return () => ipcRenderer.removeListener('app:open-shortcuts-overlay', handler)
  },
  onRestartTour: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:restart-tour', handler)
    return () => ipcRenderer.removeListener('app:restart-tour', handler)
  },
  getHintsState: (): Promise<{ dismissed: string[] }> => ipcRenderer.invoke('hints:get'),
  dismissHint: (id: string): void => { ipcRenderer.send('hints:dismiss', { id }) },
  getChangelogEntry: (): Promise<{ version: string; items: string[] } | null> =>
    ipcRenderer.invoke('changelog:get-unseen'),
  ackChangelog: (version: string): void => { ipcRenderer.send('changelog:ack', { version }) },

  onOpenSettings: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:open-settings', handler)
    return () => ipcRenderer.removeListener('app:open-settings', handler)
  },
  openSettings: (): void => ipcRenderer.send('settings:request-open'),

  // --- Publish destinations (Sprint 21) — OAuth/upload BLOCKED pending real
  // API credentials (see src/main/publish/providers.ts); connection state,
  // token storage, and publish history are real and work today. ---
  listPublishConnections: (): Promise<('youtube' | 'googleDrive' | 'dropbox')[]> =>
    ipcRenderer.invoke('publish:list-connections'),
  connectPublishProvider: (provider: 'youtube' | 'googleDrive' | 'dropbox'): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('publish:connect', { provider }),
  disconnectPublishProvider: (provider: 'youtube' | 'googleDrive' | 'dropbox'): Promise<{ ok: true }> =>
    ipcRenderer.invoke('publish:disconnect', { provider }),
  getPublishConnectionLabel: (provider: 'youtube' | 'googleDrive' | 'dropbox'): Promise<string | null> =>
    ipcRenderer.invoke('publish:get-connection-label', { provider }),
  getPublishHistory: (recordingDir: string): Promise<{ provider: string; url: string; publishedAt: number }[]> =>
    ipcRenderer.invoke('publish:get-history', { recordingDir }),
  uploadToPublishDestination: (
    provider: 'youtube' | 'googleDrive' | 'dropbox', filePath: string, title: string, description: string
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('publish:upload', { provider, filePath, title, description }),
  onPublishProgress: (cb: (payload: { provider: string; percent: number }) => void) => {
    const handler = (_: unknown, payload: { provider: string; percent: number }) => cb(payload)
    ipcRenderer.on('publish:progress', handler)
    return () => ipcRenderer.removeListener('publish:progress', handler)
  },

  // --- Analytics (Sprint 18) — no-op unless the user has opted in ---
  getAnalyticsConsent: (): Promise<boolean> => ipcRenderer.invoke('analytics:get-consent'),
  setAnalyticsConsent: (enabled: boolean): void => { ipcRenderer.send('analytics:set-consent', enabled) },
  trackEvent: (name: string, props?: Record<string, string | number | boolean>): void => {
    ipcRenderer.send('analytics:track', { name, props })
  },
  getFeatureFlag: (flagName: string): Promise<boolean> => ipcRenderer.invoke('analytics:get-flag', { flagName }),
  getRetentionSignal: (): Promise<{ daysSinceLastOpen: number | null }> =>
    ipcRenderer.invoke('analytics:get-retention-signal'),

  // --- Dev utils ---
  ping: (): Promise<'pong'> => ipcRenderer.invoke(IPC.PING)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
