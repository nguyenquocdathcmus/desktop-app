export const APP_NAME = 'Record Screen'
export const APP_VERSION = '0.1.0'
export const PROJECT_EXTENSION = '.recordscreen'
export const RECORDINGS_DIR = 'Record Screen Recordings'

export const EXPORT_RESOLUTIONS = [
  { width: 1280, height: 720, label: '720p HD' },
  { width: 1920, height: 1080, label: '1080p Full HD' },
  { width: 2560, height: 1440, label: '1440p QHD' },
  { width: 3840, height: 2160, label: '4K UHD' }
] as const

export const EXPORT_PRESETS = [
  { name: 'Twitter / X', width: 1280, height: 720, fps: 30 as const, format: 'mp4' as const },
  { name: 'YouTube', width: 1920, height: 1080, fps: 60 as const, format: 'mp4' as const },
  { name: 'LinkedIn', width: 1280, height: 720, fps: 30 as const, format: 'mp4' as const },
  { name: 'Slack / Discord', width: 800, height: 450, fps: 24 as const, format: 'gif' as const }
] as const

export const IPC = {
  RECORDING_GET_DISPLAYS: 'recording:get-displays',
  RECORDING_GET_WINDOWS: 'recording:get-windows',
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_PAUSE: 'recording:pause',
  RECORDING_RESUME: 'recording:resume',
  RECORDING_GET_STATUS: 'recording:get-status',
  RECORDING_STATUS: 'recording:status',
  EXPORT_START: 'export:start',
  EXPORT_CANCEL: 'export:cancel',
  EXPORT_PROGRESS: 'export:progress',
  EXPORT_DONE: 'export:done',
  EXPORT_ERROR: 'export:error',
  PROJECT_SAVE: 'project:save',
  PROJECT_OPEN: 'project:open',
  PROJECT_GET_RECENT: 'project:get-recent',
  APP_OPEN_PROJECT: 'app:open-project',
  PING: 'ping'
} as const
