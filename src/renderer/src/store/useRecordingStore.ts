import { create } from 'zustand'
import type { RecordingStatus, DisplayInfo, WindowInfo, StartOptions } from '../../../shared/ipc-types'
import { useToastStore } from './useToastStore'
import { trackEvent } from '../analytics'

type CaptureMode = 'display' | 'window'

interface RecordingStore {
  status: RecordingStatus
  displays: DisplayInfo[]
  windows: WindowInfo[]
  selectedDisplayId: number | null
  selectedWindowId: number | null
  captureMode: CaptureMode

  // Mic MediaRecorder (runs in renderer)
  _micRecorder: MediaRecorder | null
  _micChunks: Blob[]
  _micStartedAt: number | null

  // Webcam
  webcamEnabled: boolean
  webcamDeviceId: string | null
  webcamDevices: MediaDeviceInfo[]

  // Microphone
  micEnabled: boolean
  micDeviceId: string | null
  micDevices: MediaDeviceInfo[]

  /** Sprint 25 US-189 — defaults to 60; only offered above 60 when the
   *  selected display's real refresh rate supports it (see DisplayInfo.refreshRate). */
  selectedFps: 30 | 60 | 90 | 120
  setSelectedFps: (fps: 30 | 60 | 90 | 120) => void

  /** Sprint 25 US-190 — opt-in only, default off; only meaningful when the
   *  selected display's DisplayInfo.supportsHDR is true. */
  hdrEnabled: boolean
  setHdrEnabled: (enabled: boolean) => void

  setStatus: (status: RecordingStatus) => void
  setDisplays: (displays: DisplayInfo[]) => void
  setWindows: (windows: WindowInfo[]) => void
  selectDisplay: (id: number) => void
  selectWindow: (id: number) => void
  setCaptureMode: (mode: CaptureMode) => void
  setWebcamEnabled: (enabled: boolean) => void
  setWebcamDeviceId: (id: string | null) => void
  setWebcamDevices: (devices: MediaDeviceInfo[]) => void
  setMicEnabled: (enabled: boolean) => void
  setMicDeviceId: (id: string | null) => void
  setMicDevices: (devices: MediaDeviceInfo[]) => void

  fetchDisplays: () => Promise<void>
  fetchWindows: () => Promise<void>
  fetchMediaDevices: () => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  pauseRecording: () => Promise<void>
  resumeRecording: () => Promise<void>
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  status: { state: 'idle' },
  displays: [],
  windows: [],
  selectedDisplayId: null,
  selectedWindowId: null,
  captureMode: 'display',

  _micRecorder: null,
  _micChunks: [],
  _micStartedAt: null,

  webcamEnabled: false,
  webcamDeviceId: null,
  webcamDevices: [],

  micEnabled: true,
  micDeviceId: null,
  micDevices: [],

  selectedFps: 60,
  setSelectedFps: (fps) => set({ selectedFps: fps }),

  hdrEnabled: false,
  setHdrEnabled: (enabled) => set({ hdrEnabled: enabled }),

  setStatus: (status) => set({ status }),
  setDisplays: (displays) => set({ displays }),
  setWindows: (windows) => set({ windows }),
  // Sprint 25 US-189 — switching to a display with a lower refresh rate must
  // clamp the fps selection down; otherwise a leftover 120fps choice from a
  // ProMotion display would silently request more than the new display can
  // produce (SCStreamConfiguration doesn't error, it just duplicates frames).
  selectDisplay: (id) => set((s) => {
    const display = s.displays.find((d) => d.id === id)
    const maxFps = display?.refreshRate ?? 60
    return {
      selectedDisplayId: id,
      selectedFps: s.selectedFps > maxFps ? (maxFps >= 60 ? 60 : 30) : s.selectedFps,
      hdrEnabled: s.hdrEnabled && !!display?.supportsHDR
    }
  }),
  selectWindow: (id) => set({ selectedWindowId: id }),
  setCaptureMode: (mode) => set({ captureMode: mode }),
  setWebcamEnabled: (enabled) => set({ webcamEnabled: enabled }),
  setWebcamDeviceId: (id) => set({ webcamDeviceId: id }),
  setWebcamDevices: (devices) => set({ webcamDevices: devices }),
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setMicDeviceId: (id) => set({ micDeviceId: id }),
  setMicDevices: (devices) => set({ micDevices: devices }),

  fetchDisplays: async () => {
    const displays = await window.api.getDisplays()
    const primary = displays.find((d) => d.isPrimary)
    set({ displays, selectedDisplayId: primary?.id ?? displays[0]?.id ?? null })
  },

  fetchWindows: async () => {
    const windows = await window.api.getWindows()
    set({ windows })
  },

  fetchMediaDevices: async () => {
    try {
      // Need permission first to get real device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {})
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      set({
        micDevices: audioInputs,
        webcamDevices: videoInputs,
        micDeviceId: audioInputs[0]?.deviceId ?? null,
        webcamDeviceId: videoInputs[0]?.deviceId ?? null
      })
    } catch {
      useToastStore.getState().push({
        kind: 'warning',
        message: 'Camera/microphone access denied — device list unavailable.',
        actionLabel: 'Open Settings',
        onAction: () => window.api.openPrivacySettings('camera')
      })
    }
  },

  startRecording: async () => {
    const { selectedDisplayId, selectedWindowId, captureMode, micEnabled, micDeviceId, webcamEnabled, selectedFps, hdrEnabled } = get()
    if (!selectedDisplayId && captureMode === 'display') return

    // Start mic capture in renderer via MediaRecorder
    let micRecorder: MediaRecorder | null = null
    const micChunks: Blob[] = []
    if (micEnabled) {
      try {
        const constraints: MediaStreamConstraints = {
          audio: micDeviceId ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
          video: false
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm'
        micRecorder = new MediaRecorder(stream, { mimeType })
        micRecorder.ondataavailable = (e) => { if (e.data.size > 0) micChunks.push(e.data) }
        micRecorder.start(200)
        set({ _micStartedAt: Date.now() })
      } catch (e) {
        console.warn('[mic] getUserMedia failed:', e)
        useToastStore.getState().push({
          kind: 'warning',
          message: 'Microphone unavailable — recording will have no mic audio.',
          actionLabel: 'Open Settings',
          onAction: () => window.api.openPrivacySettings('microphone')
        })
      }
    }
    set({ _micRecorder: micRecorder, _micChunks: micChunks })

    const opts: StartOptions = {
      displayId: selectedDisplayId ?? 0,
      windowId: captureMode === 'window' && selectedWindowId ? selectedWindowId : undefined,
      fps: selectedFps,
      hdr: captureMode === 'display' && hdrEnabled,
      // System audio via ScreenCaptureKit only works in display mode; mic is captured separately in renderer
      captureAudio: captureMode === 'display',
      webcamEnabled,
      // Cap capture resolution to 1080p — native Retina resolution (e.g. 3024x1964) makes
      // export's per-pixel filters (rounded corners, webcam mask) extremely slow.
      maxHeight: 1080,
      outputDir: ''
    }

    const result = await window.api.startRecording(opts)
    if (result.ok) {
      trackEvent('recording_started', { hasWebcam: !!opts.webcamEnabled, hasAudio: !!opts.captureAudio })
    }
    if (!result.ok) {
      console.error('Failed to start recording:', result.error)
      micRecorder?.stop()
      set({ _micRecorder: null, _micChunks: [] })
      useToastStore.getState().push({
        kind: 'error',
        message: `Couldn't start recording: ${result.error}`,
        actionLabel: result.error.includes('permission') || result.error.includes('Permission') ? 'Open Settings' : undefined,
        onAction: () => window.api.openPrivacySettings('screen')
      })
    }
  },

  stopRecording: async () => {
    const { _micRecorder, _micChunks, _micStartedAt, status } = get()

    // Stop mic recorder and collect audio blob
    if (_micRecorder && _micRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        _micRecorder.onstop = () => resolve()
        _micRecorder.stop()
        // Stop all tracks to release mic
        const stream = (_micRecorder as any).stream as MediaStream | undefined
        stream?.getTracks().forEach(t => t.stop())
      })
    }

    // Save mic audio to main process before stopping capture.
    // The mic MediaRecorder starts a beat before the Swift capture binary actually
    // begins writing frames (permission checks + process spawn take time), so pass
    // along how many ms of lead time to trim during mux — otherwise mic drifts ahead of video.
    if (_micChunks.length > 0) {
      const blob = new Blob(_micChunks, { type: 'audio/webm' })
      const buf = await blob.arrayBuffer()
      const videoStartedAt = status.state === 'recording' || status.state === 'paused' ? status.startedAt : null
      const leadMs = videoStartedAt && _micStartedAt ? Math.max(0, videoStartedAt - _micStartedAt) : 0
      await window.api.saveMicAudio(new Uint8Array(buf), leadMs)
    }

    set({ _micRecorder: null, _micChunks: [], _micStartedAt: null })

    const result = await window.api.stopRecording()
    if (result.ok) {
      trackEvent('recording_stopped', { durationSec: Math.round(result.manifest.duration) })
    } else {
      console.error('Failed to stop recording:', result.error)
      useToastStore.getState().push({
        kind: 'error',
        message: `Couldn't stop recording cleanly: ${result.error}`
      })
    }
  },

  pauseRecording: async () => {
    const { _micRecorder } = get()
    if (_micRecorder && _micRecorder.state === 'recording') _micRecorder.pause()
    const result = await window.api.pauseRecording()
    if (!result.ok) {
      console.error('Failed to pause recording:', result.error)
      useToastStore.getState().push({ kind: 'error', message: `Couldn't pause recording: ${result.error}` })
    }
  },

  resumeRecording: async () => {
    const { _micRecorder } = get()
    if (_micRecorder && _micRecorder.state === 'paused') _micRecorder.resume()
    const result = await window.api.resumeRecording()
    if (!result.ok) {
      console.error('Failed to resume recording:', result.error)
      useToastStore.getState().push({ kind: 'error', message: `Couldn't resume recording: ${result.error}` })
    }
  }
}))
