# Internal API Specification: Screen Studio Clone (macOS)

**Document Version**: 1.0  
**Last Updated**: 2026-06-29  
**Audience**: Engineering team  
**Status**: Approved

This document specifies all internal APIs: IPC channels between Electron processes, Swift binary CLI interfaces, the project file format, and FFmpeg command templates. These specifications are authoritative — implementations must conform to this document, not infer from it.

---

## Table of Contents

1. IPC Channel Specification (Full TypeScript Types)
2. Preload API (`window.electronAPI`)
3. Swift Binary CLI Interface
4. Project File Format (.screenstudio Bundle)
5. FFmpeg Command Templates
6. Electron Store Schema (Persisted Settings)

---

## 1. IPC Channel Specification

### 1.1 Shared Types

```typescript
// src/shared/ipc-types.ts

// ─── Enums ──────────────────────────────────────────────────────────────────

export type RecordingStatusCode =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'done'
  | 'error';

export type ExportStatusCode =
  | 'idle'
  | 'building'
  | 'zoom-rendering'
  | 'encoding'
  | 'gif-optimizing'
  | 'done'
  | 'cancelled'
  | 'error';

export type PermissionName = 'screenRecording' | 'microphone' | 'camera' | 'accessibility';

// ─── Recording Status Payloads ────────────────────────────────────────────────

export interface RecordingStatusIdle       { status: 'idle' }
export interface RecordingStatusCountdown  { status: 'countdown'; remaining: number }
export interface RecordingStatusRecording  { status: 'recording'; duration: number; frameCount: number }
export interface RecordingStatusPaused     { status: 'paused';    duration: number }
export interface RecordingStatusProcessing { status: 'processing' }
export interface RecordingStatusDone {
  status: 'done';
  sessionPath: string;
  duration: number;
  frameCount: number;
  hasAudio: boolean;
  hasCursorData: boolean;
}
export interface RecordingStatusError {
  status: 'error';
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

export type RecordingStatus =
  | RecordingStatusIdle
  | RecordingStatusCountdown
  | RecordingStatusRecording
  | RecordingStatusPaused
  | RecordingStatusProcessing
  | RecordingStatusDone
  | RecordingStatusError;

// ─── Export Status Payloads ───────────────────────────────────────────────────

export interface ExportProgress {
  status: 'encoding' | 'zoom-rendering' | 'gif-optimizing';
  percent: number;         // 0–100
  elapsed: number;         // seconds
  eta: number;             // seconds remaining (estimate)
  currentStep: number;     // 1-based step index
  totalSteps: number;
}

export interface ExportComplete {
  status: 'done';
  outputPath: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

export interface ExportError {
  status: 'error';
  code: ErrorCode;
  message: string;
  ffmpegStderr?: string;
}

export type ExportStatus =
  | ExportProgress
  | ExportComplete
  | ExportError;

// ─── Error Codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'E001'   // Screen recording permission denied
  | 'E002'   // Microphone permission denied
  | 'E003'   // Accessibility permission denied
  | 'E004'   // Binary not found
  | 'E005'   // Binary code signature invalid
  | 'E006'   // Disk full during recording
  | 'E007'   // FFmpeg binary not found
  | 'E008'   // FFmpeg non-zero exit
  | 'E009'   // Project manifest parse error
  | 'E010'   // Project asset missing
  | 'E011'   // Export cancelled
  | 'E012'   // Update download failed
  | 'E013';  // gifsicle binary not found

// ─── Permissions ──────────────────────────────────────────────────────────────

export interface PermissionsStatus {
  screenRecording: boolean;
  microphone: boolean;
  camera: boolean;
  accessibility: boolean;
}
```

### 1.2 RendererToMain Channels

These channels are sent from the renderer process to the main process using `window.electronAPI.send(channel, payload)`.

```typescript
// src/shared/ipc-types.ts (continued)

export type RendererToMain =
  // ── Recording ──────────────────────────────────────────────────────────────
  | {
      channel: 'recording:start';
      payload: {
        displayId: number;               // CGDirectDisplayID (0 for window capture)
        windowId?: number;               // CGWindowID (if window capture)
        fps: 30 | 60;
        captureSystemAudio: boolean;
        captureMicrophone: boolean;
        microphoneDeviceId?: string;     // AVCaptureDevice uid
        captureWebcam: boolean;          // Phase 3
        webcamDeviceId?: string;         // Phase 3
        countdownSeconds: 0 | 3 | 5;
        enableCursorTracking: boolean;
      };
    }
  | {
      channel: 'recording:stop';
      payload: undefined;
    }
  | {
      channel: 'recording:pause';        // Phase 2
      payload: undefined;
    }
  | {
      channel: 'recording:resume';       // Phase 2
      payload: undefined;
    }
  | {
      channel: 'recording:cancel';
      payload: undefined;
    }

  // ── Export ─────────────────────────────────────────────────────────────────
  | {
      channel: 'export:start';
      payload: ExportOptions;
    }
  | {
      channel: 'export:cancel';
      payload: undefined;
    }

  // ── Permissions ────────────────────────────────────────────────────────────
  | {
      channel: 'permissions:open-system-settings';
      payload: { section: 'screenRecording' | 'microphone' | 'camera' | 'accessibility' };
    }
  | {
      channel: 'permissions:recheck';
      payload: undefined;
    }

  // ── Window / UI ────────────────────────────────────────────────────────────
  | {
      channel: 'window:minimize';
      payload: undefined;
    }
  | {
      channel: 'window:open-settings';
      payload: undefined;
    }
  | {
      channel: 'shell:show-item-in-finder';
      payload: { path: string };
    }
  | {
      channel: 'shell:open-external';
      payload: { url: string };
    }

  // ── Zoom Path (Phase 2) ────────────────────────────────────────────────────
  | {
      channel: 'zoom:generate-path';
      payload: {
        cursorJsonPath: string;
        zoomLevel: number;
        sensitivity: 'low' | 'medium' | 'high';
      };
    };
```

### 1.3 MainToRenderer Channels

These channels are sent from the main process to the renderer using `mainWindow.webContents.send(channel, payload)`.

```typescript
export type MainToRenderer =
  // ── Recording ──────────────────────────────────────────────────────────────
  | {
      channel: 'recording:status';
      payload: RecordingStatus;
    }
  | {
      channel: 'recording:error';
      payload: { code: ErrorCode; message: string };
    }
  | {
      channel: 'recording:audio-level';
      payload: { system: number; mic: number };     // dBFS values
    }

  // ── Export ─────────────────────────────────────────────────────────────────
  | {
      channel: 'export:status';
      payload: ExportStatus;
    }

  // ── Permissions ────────────────────────────────────────────────────────────
  | {
      channel: 'permissions:status';
      payload: PermissionsStatus;
    }

  // ── Project ────────────────────────────────────────────────────────────────
  | {
      channel: 'project:loaded';
      payload: {
        manifest: SessionManifest;
        projectPath: string;
        videoUrl: string;            // file:// URL for the renderer video element
        audioUrl?: string;
        webcamUrl?: string;
      };
    }
  | {
      channel: 'project:auto-saved';
      payload: { path: string; timestamp: string };
    }
  | {
      channel: 'project:error';
      payload: { code: ErrorCode; message: string };
    }

  // ── Displays ───────────────────────────────────────────────────────────────
  | {
      channel: 'displays:list';
      payload: DisplayInfo[];
    }
  | {
      channel: 'displays:changed';
      payload: DisplayInfo[];
    }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  | {
      channel: 'zoom:path-generated';
      payload: { events: ZoomEvent[]; eventCount: number };
    }

  // ── Updates ────────────────────────────────────────────────────────────────
  | {
      channel: 'update:available';
      payload: { version: string; releaseNotes: string };
    }
  | {
      channel: 'update:download-progress';
      payload: { percent: number; bytesPerSecond: number; transferred: number; total: number };
    }
  | {
      channel: 'update:downloaded';
      payload: { version: string };
    }
  | {
      channel: 'update:error';
      payload: { message: string };
    };
```

### 1.4 Invoke Channels (Request-Response)

These channels use `ipcRenderer.invoke` / `ipcMain.handle` and return a Promise.

```typescript
// src/shared/ipc-types.ts

export interface InvokeChannels {
  // Project management
  'project:open-dialog': {
    request: undefined;
    response: { filePath: string } | null;    // null if user cancelled
  };
  'project:save-as-dialog': {
    request: { defaultName: string };
    response: { filePath: string } | null;
  };
  'project:load': {
    request: { projectPath: string };
    response: { manifest: SessionManifest; videoUrl: string; audioUrl?: string } | { error: string };
  };
  'project:save-manifest': {
    request: { projectPath: string; manifest: SessionManifest };
    response: { success: boolean };
  };
  'project:recent-list': {
    request: undefined;
    response: RecentProjectEntry[];
  };
  'project:remove-recent': {
    request: { projectPath: string };
    response: undefined;
  };

  // Displays
  'displays:list': {
    request: undefined;
    response: DisplayInfo[];
  };

  // Permissions
  'permissions:check': {
    request: undefined;
    response: PermissionsStatus;
  };

  // File system
  'fs:choose-image': {
    request: undefined;
    response: { filePath: string; mimeType: string } | null;
  };
  'fs:choose-output': {
    request: { defaultName: string; extension: string };
    response: { filePath: string } | null;
  };

  // Settings
  'settings:get': {
    request: { key: string };
    response: unknown;
  };
  'settings:set': {
    request: { key: string; value: unknown };
    response: undefined;
  };
  'settings:get-all': {
    request: undefined;
    response: AppSettings;
  };

  // Updates
  'update:check-now': {
    request: undefined;
    response: { hasUpdate: boolean; version?: string };
  };
  'update:install-and-restart': {
    request: undefined;
    response: undefined;   // app will quit and restart; no return
  };
}
```

### 1.5 Supporting Types for IPC

```typescript
// src/shared/ipc-types.ts

export interface DisplayInfo {
  id: number;                    // CGDirectDisplayID
  name: string;                  // e.g., "Built-in Retina Display"
  width: number;                 // logical pixels
  height: number;
  scaleFactor: number;           // 1.0 or 2.0 (Retina)
  isMain: boolean;
  isPrimary: boolean;
  thumbnailDataUrl?: string;     // base64 JPEG data URL, 240×135
}

export interface RecentProjectEntry {
  projectPath: string;
  projectName: string;
  lastOpenedAt: string;          // ISO 8601
  duration: number;              // seconds
  thumbnailDataUrl?: string;     // base64 JPEG
}

export interface ExportOptions {
  format: 'mp4' | 'gif' | 'prores';
  outputPath: string;
  resolutionMode: 'source' | 'preset' | 'custom';
  resolutionWidth?: number;      // required if mode = 'custom'
  resolutionHeight?: number;
  fps: number;
  quality: 'high' | 'medium' | 'web';
  audioCodec: 'aac-192' | 'aac-128' | 'none';
  // GIF-specific
  gifWidth?: number;
  gifFps?: number;
  gifOptimizeLevel?: 1 | 2 | 3;
  // Applied from manifest
  projectPath: string;
  trimIn: number;
  trimOut: number;
  // Applied effects
  applyBackground: boolean;
  applyZoom: boolean;
  applyCursorEffects: boolean;
  applyDeviceFrame: boolean;
}
```

---

## 2. Preload API (`window.electronAPI`)

The preload script exposes a typed API to the renderer via `contextBridge`. No other Node.js or Electron APIs are exposed.

### 2.1 Full Preload Implementation

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';
import type { RendererToMain, MainToRenderer, InvokeChannels } from '../shared/ipc-types';

type SendChannel = RendererToMain['channel'];
type ListenChannel = MainToRenderer['channel'];

// Extract payload type for a given send channel
type SendPayload<C extends SendChannel> =
  Extract<RendererToMain, { channel: C }>['payload'];

// Extract payload type for a given listen channel
type ListenPayload<C extends ListenChannel> =
  Extract<MainToRenderer, { channel: C }>['payload'];

const electronAPI = {
  // Fire-and-forget send
  send: <C extends SendChannel>(
    channel: C,
    payload: SendPayload<C>
  ): void => {
    ipcRenderer.send(channel, payload);
  },

  // Subscribe to main-process events; returns unsubscribe function
  on: <C extends ListenChannel>(
    channel: C,
    handler: (payload: ListenPayload<C>) => void
  ): (() => void) => {
    const wrappedHandler = (_event: Electron.IpcRendererEvent, payload: ListenPayload<C>) => {
      handler(payload);
    };
    ipcRenderer.on(channel, wrappedHandler);
    return () => ipcRenderer.removeListener(channel, wrappedHandler);
  },

  // Request-response (Promise-based)
  invoke: <C extends keyof InvokeChannels>(
    channel: C,
    payload: InvokeChannels[C]['request']
  ): Promise<InvokeChannels[C]['response']> => {
    return ipcRenderer.invoke(channel, payload);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript augmentation for the renderer's global window type:
// This declaration lives in src/renderer/env.d.ts
export type ElectronAPI = typeof electronAPI;
```

### 2.2 Renderer Type Augmentation

```typescript
// src/renderer/env.d.ts
import type { ElectronAPI } from '../preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

## 3. Swift Binary CLI Interface

### 3.1 `capture` Binary

```
USAGE:
  capture --display <id> --output <path> [options]
  capture --check-permissions

OPTIONS:
  --display <CGDirectDisplayID>   Display to capture (decimal integer)
  --output <path>                 Output .mov file path (absolute)
  --fps <30|60>                   Target frame rate (default: 60)
  --capture-audio                 Include system audio in output
  --time-ref <unix-us>            Unix timestamp in microseconds at spawn time
                                  (used for cursor sync calibration)
  --check-permissions             Check ScreenCaptureKit permission and exit

EXIT CODES:
  0   Success (recording completed normally after SIGTERM)
  1   Permission denied (ScreenCaptureKit not authorized)
  2   Invalid arguments (missing required flag, invalid display ID)
  3   Runtime error (VideoToolbox error, disk full, etc.)
  127 Binary cannot execute (missing entitlement, wrong arch)

STDOUT (newline-delimited JSON):
  { "event": "ready" }
  { "event": "frame", "count": <int>, "pts": <float>, "size": <int> }
  { "event": "error", "code": <string>, "message": <string> }
  { "event": "done",  "frameCount": <int>, "duration": <float>, "outputPath": <string> }

STDERR:
  Human-readable log lines prefixed with log level: [INFO], [WARN], [ERROR]
  Not machine-parsed by the main process.

NOTES:
  - The binary handles SIGTERM by flushing the VideoToolbox encoder and
    closing the output file. It exits within 2 seconds of receiving SIGTERM.
  - Frames are encoded losslessly using VideoToolbox HEVC Lossless
    (kVTCompressionPropertyKey_Quality = 1.0).
  - The output .mov uses a QuickTime container with one video track.
  - If --capture-audio is set, the output .mov also contains one AAC audio track.
```

### 3.2 `cursor-tracker` Binary

```
USAGE:
  cursor-tracker [options]

OPTIONS:
  --include-keyboard              Capture keyboard events (requires Accessibility)
  --keyboard-filter <mode>        Filter level: modifiers-only (default) | all
  --time-ref <unix-us>            Unix timestamp in microseconds for sync
  --display <CGDirectDisplayID>   Restrict cursor events to a specific display

EXIT CODES:
  0   Clean exit after SIGTERM
  1   CGEventTap acquisition failed (Accessibility permission likely missing)
  2   Invalid arguments
  3   Runtime error

STDOUT (newline-delimited JSON, one event per line):
  Move:     { "t": <float>, "x": <int>, "y": <int>, "type": "move" }
  Click:    { "t": <float>, "x": <int>, "y": <int>, "type": "click",
              "button": "left"|"right"|"middle" }
  Mousedown:{ "t": <float>, "x": <int>, "y": <int>, "type": "mousedown",
              "button": "left"|"right"|"middle" }
  Mouseup:  { "t": <float>, "x": <int>, "y": <int>, "type": "mouseup",
              "button": "left"|"right"|"middle" }
  Keydown:  { "t": <float>, "type": "keydown", "key": <string>, "display": <string> }
              key: normalized lowercase string e.g. "cmd+shift+5"
              display: Unicode display string e.g. "⌘⇧5"

FIELD TYPES:
  t:  Unix timestamp (float, millisecond precision)
  x,y: Screen coordinates in logical pixels (not Retina pixels)
       relative to the top-left of the primary display

NOTES:
  - Events are written to stdout as soon as they occur (unbuffered output).
  - The binary writes a final JSON line { "type": "eof", "count": <int> }
    immediately before exiting.
  - Mouse move events are throttled to a maximum of 60 per second.
```

### 3.3 `audio-composer` Binary

```
USAGE:
  audio-composer --output <path> [options]

OPTIONS:
  --output <path>                 Output .m4a file path (absolute)
  --system-audio                  Capture system audio (CoreAudio loopback tap)
  --microphone <device-uid>       UID of AVCaptureDevice to use for microphone
  --mic-gain <float>              Gain multiplier for microphone (default: 1.0)
  --system-gain <float>           Gain multiplier for system audio (default: 1.0)
  --sample-rate <int>             Output sample rate in Hz (default: 48000)
  --time-ref <unix-us>            Unix timestamp in microseconds for sync

EXIT CODES:
  0   Clean exit; output file finalized
  1   Permission denied (microphone or system audio)
  2   Invalid arguments (unknown device UID, etc.)
  3   Runtime error (AVAudioEngine failure, disk full)

STDOUT (newline-delimited JSON):
  { "event": "ready" }
  { "event": "level", "system": <float>, "mic": <float> }   // dBFS, emitted at 4Hz
  { "event": "done",  "duration": <float>, "outputPath": <string> }

OUTPUT FORMAT:
  AAC-LC at 192kbps, 48kHz, stereo, encapsulated in an MPEG-4 Audio container (.m4a)
```

### 3.4 `zoom-renderer` Binary (Phase 2)

```
USAGE:
  zoom-renderer --input <path> --output <path> --zoom-path <path> [options]

OPTIONS:
  --input <path>                  Input .mov file (lossless HEVC from capture)
  --output <path>                 Output .mov file (zoom-applied, lossless HEVC)
  --zoom-path <path>              Path to zoom-path.json
  --progress                      Emit progress events to stdout

EXIT CODES:
  0   Success
  2   Invalid arguments
  3   Runtime error (Metal device unavailable, VideoToolbox error)

STDOUT (only when --progress is set, newline-delimited JSON):
  { "event": "progress", "frame": <int>, "total": <int>, "percent": <float> }
  { "event": "done", "frameCount": <int>, "outputPath": <string> }

ZOOM-PATH.JSON FORMAT:
  {
    "fps": <int>,
    "events": [
      {
        "startTime": <float>,
        "endTime": <float>,
        "zoomLevel": <float>,
        "centerX": <float>,
        "centerY": <float>,
        "easing": "spring" | "ease-in-out" | "none"
      }
    ]
  }

SPRING PHYSICS PARAMETERS:
  stiffness: 200   (k in spring equation)
  damping:   28    (b in spring equation)
  These are baked into the binary and not configurable via flags.

NOTES:
  - Processing is done using a Metal compute shader on the GPU.
  - Falls back to CPU bicubic sampling if Metal device is unavailable.
  - Output file is lossless HEVC (same parameters as input).
  - The zoom-renderer reads the input sequentially; it does not random-access.
```

### 3.5 `face-detector` Binary (Phase 3)

```
USAGE:
  face-detector --input <path> --mode <mode> [options]

OPTIONS:
  --input <path>                  Path to webcam .mov file
  --mode file                     Process entire file and output crop-path.json
  --mode realtime                 Stream face positions as events to stdout in real time
  --output-crop <path>            Path for crop-path.json output (file mode only)

EXIT CODES:
  0   Success
  2   Invalid arguments
  3   Runtime error (Vision framework unavailable)

STDOUT (realtime mode, newline-delimited JSON):
  { "t": <float>, "faces": [ { "x": <float>, "y": <float>, "w": <float>, "h": <float>,
                                "confidence": <float> } ] }
  All coordinates are normalized (0.0–1.0) relative to frame dimensions.
  An empty "faces" array means no face was detected in that frame.

CROP-PATH.JSON FORMAT (file mode output):
  {
    "fps": <int>,
    "frames": [
      {
        "time": <float>,
        "cropX": <float>,
        "cropY": <float>,
        "cropW": <float>,
        "cropH": <float>
      }
    ]
  }
```

---

## 4. Project File Format (.screenstudio Bundle)

### 4.1 Bundle Directory Structure

```
<project-name>.screenstudio/
├── manifest.json           REQUIRED  Project metadata and all effect settings
├── capture.mov             REQUIRED  Raw lossless HEVC recording
├── cursor.json             OPTIONAL  Cursor and keyboard event log
├── audio.m4a               OPTIONAL  Mixed audio track (if audio was captured)
├── webcam.mov              OPTIONAL  Webcam recording (Phase 3)
├── thumbnail.jpg           OPTIONAL  240×135 JPEG preview; regenerated on open if missing
└── assets/                 OPTIONAL  User-provided image files referenced by the manifest
    └── background.<ext>              Background image (PNG, JPG, or WEBP)
```

The bundle is a regular macOS directory with a `.screenstudio` extension. Register it as a document type in `Info.plist` so Finder treats it as a single file (double-click to open, drag to Dock icon, etc.).

### 4.2 manifest.json Full Schema

```typescript
// TypeScript interface — the manifest.json is the serialized form of this type.
// All fields use camelCase. All paths are relative to the bundle root.

interface SessionManifest {
  // ── Schema versioning ──────────────────────────────────────────────────────
  version: '1.0';
  schemaVersion: 1;

  // ── Project metadata ───────────────────────────────────────────────────────
  projectName: string;
  createdAt: string;              // ISO 8601, e.g. "2026-06-29T14:30:00.000Z"
  updatedAt: string;
  appVersion: string;             // semver of the app that last wrote this manifest

  // ── Source media ───────────────────────────────────────────────────────────
  sourceVideoFile: 'capture.mov';                          // always this filename
  sourceDuration: number;         // seconds, float, e.g. 62.5
  sourceResolution: { width: number; height: number };     // logical pixels
  sourceResolutionRetina: { width: number; height: number }; // physical pixels (Retina)
  sourceFps: 30 | 60;
  hasAudio: boolean;
  audioFile?: 'audio.m4a';        // present if hasAudio = true
  hasWebcam: boolean;
  webcamFile?: 'webcam.mov';      // present if hasWebcam = true
  hasCursorData: boolean;
  cursorFile?: 'cursor.json';     // present if hasCursorData = true

  // ── Trim ──────────────────────────────────────────────────────────────────
  trimIn: number;                 // seconds; 0 = start of recording
  trimOut: number;                // seconds; sourceDuration = end of recording

  // ── Pause intervals (Phase 2) ──────────────────────────────────────────────
  pauseIntervals: Array<{
    start: number;                // seconds
    end: number;
  }>;

  // ── Canvas ────────────────────────────────────────────────────────────────
  canvas: {
    background: BackgroundSource;
    padding: number;              // pixels, uniform on all sides
    cornerRadius: number;         // pixels
    aspectRatio: 'source' | '16:9' | '1:1' | '9:16' | '4:3' | 'custom';
    customAspectWidth?: number;
    customAspectHeight?: number;
  };

  // ── Zoom (Phase 2) ────────────────────────────────────────────────────────
  zoom: {
    enabled: boolean;
    level: number;                // 1.0–3.0
    sensitivity: 'low' | 'medium' | 'high';
    events: ZoomEvent[];
  };

  // ── Cursor (Phase 2) ──────────────────────────────────────────────────────
  cursor: {
    highlightEnabled: boolean;
    highlightSize: 'small' | 'medium' | 'large';
    highlightOpacity: number;     // 0.0–1.0
    highlightColor: string;       // '#RRGGBB' hex
    rippleEnabled: boolean;
    rippleColorLeft: string;
    rippleColorRight: string;
    keyboardOverlayEnabled: boolean;
    keyboardOverlayPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  };

  // ── Device Frame (Phase 2) ────────────────────────────────────────────────
  frame: {
    enabled: boolean;
    frameId: 'macbook-pro' | 'imac' | 'safari' | 'chrome' | 'iphone-15-pro' | null;
    scale: number;                // 0.5–1.2
  };

  // ── Webcam (Phase 3) ──────────────────────────────────────────────────────
  webcam: {
    enabled: boolean;
    position: { x: number; y: number };    // normalized 0.0–1.0 of canvas
    size: 'small' | 'medium' | 'large';
    shape: 'circle' | 'rounded-rect' | 'rectangle';
    autoFaceCenter: boolean;
  };

  // ── Audio mix ─────────────────────────────────────────────────────────────
  audio: {
    systemGain: number;           // 0.0–2.0, default 1.0
    micGain: number;              // 0.0–2.0, default 1.0
  };

  // ── Export history (informational; not used for playback) ─────────────────
  exportHistory: Array<{
    exportedAt: string;
    outputPath: string;
    format: string;
    fileSizeBytes: number;
  }>;
}

// ── Inline type definitions ────────────────────────────────────────────────

type BackgroundSource =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; stops: GradientStop[]; angle: number }
  | { type: 'image'; assetPath: string; fit: 'cover' | 'contain' | 'fill' }
  | { type: 'blur'; assetPath: string; blurRadius: number }
  | { type: 'wallpaper-builtin'; wallpaperId: string };

interface GradientStop {
  color: string;                  // '#RRGGBB' hex
  position: number;               // 0.0–1.0
}

interface ZoomEvent {
  id: string;                     // UUID, stable across regenerations
  startTime: number;
  endTime: number;
  zoomLevel: number;
  centerX: number;
  centerY: number;
  easing: 'spring' | 'ease-in-out' | 'none';
  triggerType: 'cursor-pause' | 'click' | 'manual';
}
```

### 4.3 cursor.json Format

```json
{
  "version": "1.0",
  "recordingStartTime": 1719670200.123,
  "captureDisplayId": 1,
  "captureResolution": { "width": 2560, "height": 1600 },
  "events": [
    { "t": 1719670200.123, "x": 512, "y": 400, "type": "move" },
    { "t": 1719670200.456, "x": 512, "y": 400, "type": "click", "button": "left" },
    { "t": 1719670200.789, "x": 512, "y": 400, "type": "mousedown", "button": "left" },
    { "t": 1719670200.800, "x": 512, "y": 400, "type": "mouseup",   "button": "left" },
    { "t": 1719670201.000, "type": "keydown", "key": "cmd+c", "display": "⌘C" }
  ]
}
```

**Field types**:
- `version`: schema version, current "1.0"
- `recordingStartTime`: Unix timestamp in seconds at the moment recording began (from `--time-ref`)
- `captureDisplayId`: The CGDirectDisplayID that was recorded (for coordinate validation)
- `captureResolution`: Logical pixel dimensions of the captured display
- `events`: Array of event objects as produced by the `cursor-tracker` binary, sorted ascending by `t`

### 4.4 Manifest Defaults

When a new session is created (immediately after recording stops), the manifest is initialized with these defaults before the user modifies anything:

```typescript
const defaultManifest: Partial<SessionManifest> = {
  canvas: {
    background: { type: 'gradient', stops: [
      { color: '#667eea', position: 0.0 },
      { color: '#764ba2', position: 1.0 }
    ], angle: 135 },
    padding: 40,
    cornerRadius: 12,
    aspectRatio: 'source',
  },
  zoom: {
    enabled: false,
    level: 2.0,
    sensitivity: 'medium',
    events: [],
  },
  cursor: {
    highlightEnabled: true,
    highlightSize: 'medium',
    highlightOpacity: 0.6,
    highlightColor: '#FFFFFF',
    rippleEnabled: true,
    rippleColorLeft: '#FFFFFF',
    rippleColorRight: '#FF8C00',
    keyboardOverlayEnabled: false,
    keyboardOverlayPosition: 'bottom-left',
  },
  frame: { enabled: false, frameId: null, scale: 1.0 },
  webcam: { enabled: false, position: { x: 0.85, y: 0.85 }, size: 'medium', shape: 'circle', autoFaceCenter: false },
  audio: { systemGain: 1.0, micGain: 1.0 },
  pauseIntervals: [],
  exportHistory: [],
};
```

---

## 5. FFmpeg Command Templates

All FFmpeg commands are constructed by `src/main/export/FFmpegWrapper.ts`. Commands are built programmatically using `fluent-ffmpeg` with the templates below as the conceptual reference.

### 5.1 MP4 Export — Background + Padding (No Zoom)

```bash
# Variables:
# CAPTURE      = /path/to/capture.mov (or zoomed.mov if zoom was applied)
# AUDIO        = /path/to/audio.m4a
# OUTPUT       = /path/to/output.mp4
# PAD          = padding in pixels (e.g. 40)
# BGCOLOR      = background color hex without # (e.g. 667eea)
# OUT_W        = source_width  + PAD*2
# OUT_H        = source_height + PAD*2
# CRF          = 18 (high) | 23 (medium) | 28 (web)
# SCALE_W      = target output width (or -2 to maintain aspect ratio)
# SCALE_H      = target output height

ffmpeg \
  -i "$CAPTURE" \
  -i "$AUDIO" \
  -filter_complex "
    [0:v]
    scale=${SCALE_W}:${SCALE_H}:flags=lanczos,
    pad=${OUT_W}:${OUT_H}:${PAD}:${PAD}:color=#${BGCOLOR}
    [v]
  " \
  -map "[v]" \
  -map "1:a" \
  -c:v libx264 \
  -crf ${CRF} \
  -preset fast \
  -profile:v high \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -c:a aac \
  -b:a 192k \
  -ss ${TRIM_IN} \
  -to ${TRIM_OUT} \
  -progress pipe:2 \
  -y \
  "$OUTPUT"
```

### 5.2 MP4 Export — Gradient Background

When the background is a gradient, FFmpeg cannot render CSS-style gradients natively. The pipeline:

1. Generate a gradient PNG at the output canvas size using a separate FFmpeg call:
```bash
ffmpeg \
  -f lavfi \
  -i "color=c=black:s=${OUT_W}x${OUT_H}:d=1" \
  -vf "
    geq=
      r='clip(lerp(${R1},(${R2}),X/${OUT_W}),0,255)':
      g='clip(lerp(${G1},(${G2}),X/${OUT_W}),0,255)':
      b='clip(lerp(${B1},(${B2}),X/${OUT_W}),0,255)'
  " \
  -frames:v 1 \
  "$GRADIENT_PNG"
```

2. Overlay the video on the gradient:
```bash
ffmpeg \
  -i "$GRADIENT_PNG" \
  -loop 1 \
  -i "$CAPTURE" \
  -i "$AUDIO" \
  -filter_complex "
    [1:v]scale=${VID_W}:${VID_H}:flags=lanczos[scaled];
    [0:v][scaled]overlay=${PAD}:${PAD}[v]
  " \
  ...
```

**Note**: For multi-stop gradients with angles, the gradient is pre-rendered to a PNG using a Node.js Canvas API call (in the main process) rather than the FFmpeg `geq` filter, which is limited to two-color linear gradients along one axis.

### 5.3 MP4 Export — Image or Blur Background

```bash
ffmpeg \
  -i "$BACKGROUND_IMAGE" \
  -i "$CAPTURE" \
  -i "$AUDIO" \
  -filter_complex "
    [0:v]scale=${OUT_W}:${OUT_H}:flags=lanczos${BLUR_FILTER}[bg];
    [1:v]scale=${VID_W}:${VID_H}:flags=lanczos[vid];
    [bg][vid]overlay=${PAD}:${PAD}[v]
  " \
  -map "[v]" -map "2:a" \
  -c:v libx264 -crf ${CRF} -preset fast -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k \
  -y "$OUTPUT"

# BLUR_FILTER = "" if no blur; ",boxblur=${BLUR_RADIUS}:${BLUR_RADIUS}" if blur background
```

### 5.4 MP4 Export — Corner Radius

Corner radius requires an alpha channel mask. Pipeline:

1. Generate a rounded-rectangle alpha mask PNG at `${VID_W}×${VID_H}`:
```bash
ffmpeg \
  -f lavfi \
  -i "color=white:s=${VID_W}x${VID_H}:d=1" \
  -vf "
    geq=
      r=255*gt(hypot(min(X,${R})-${R},min(Y,${R})-${R}),${R})*
          gt(hypot(min(X,${R})-${R},max(Y,${VID_H}-${R})-${VID_H}+${R}),${R})*
          gt(hypot(max(X,${VID_W}-${R})-${VID_W}+${R},min(Y,${R})-${R}),${R})*
          gt(hypot(max(X,${VID_W}-${R})-${VID_W}+${R},max(Y,${VID_H}-${R})-${VID_H}+${R}),${R}):
      a=255
  " \
  -frames:v 1 "$MASK_PNG"
```

**Note**: The FFmpeg `geq` rounded-corner filter is complex. In practice, the rounded-corner alpha mask is generated using a Node.js Canvas API call (`ctx.roundRect`, then `getImageData`) and saved as a PNG, which is cleaner and more maintainable.

2. Apply mask to video:
```bash
ffmpeg \
  -i "$CAPTURE" \
  -i "$MASK_PNG" \
  -filter_complex "[0:v][1:v]alphamerge[vid_alpha]" \
  ...
```

3. Composite masked video over background (as in 5.1/5.2/5.3).

### 5.5 GIF Export — Full Pipeline

**Step 1: Palette Generation**
```bash
ffmpeg \
  -ss ${TRIM_IN} \
  -to ${TRIM_OUT} \
  -i "$CAPTURE_OR_COMPOSITED" \
  -vf "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=diff" \
  -y \
  "$PALETTE_PNG"
```

**Step 2: Apply Palette**
```bash
ffmpeg \
  -ss ${TRIM_IN} \
  -to ${TRIM_OUT} \
  -i "$CAPTURE_OR_COMPOSITED" \
  -i "$PALETTE_PNG" \
  -filter_complex "fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos[scaled];[scaled][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  -y \
  "$RAW_GIF"
```

**Step 3: Optimize with gifsicle**
```bash
"$BIN_PATH/gifsicle" \
  --optimize=3 \
  --lossy=80 \
  "$RAW_GIF" \
  -o "$FINAL_GIF"
```

**Step 4: Cleanup**
```bash
rm "$PALETTE_PNG" "$RAW_GIF"
```

### 5.6 ProRes Export (Phase 3)

```bash
ffmpeg \
  -i "$CAPTURE_OR_COMPOSITED" \
  -i "$AUDIO" \
  -filter_complex "
    [0:v]scale=${OUT_W}:${OUT_H}:flags=lanczos,
    pad=${CANVAS_W}:${CANVAS_H}:${PAD}:${PAD}:color=#${BGCOLOR}[v]
  " \
  -map "[v]" \
  -map "1:a" \
  -c:v prores_ks \
  -profile:v 3 \
  -vendor apl0 \
  -pix_fmt yuv422p10le \
  -c:a pcm_s16le \
  -ss ${TRIM_IN} \
  -to ${TRIM_OUT} \
  -y \
  "$OUTPUT"
# profile:v 3 = ProRes 422 HQ
```

### 5.7 Webcam Overlay (Phase 3)

```bash
# Assumes webcam.mov has been face-cropped and scaled separately
ffmpeg \
  -i "$SCREEN_COMPOSITED" \
  -i "$WEBCAM_CROPPED" \
  -filter_complex "
    [1:v]scale=${CAM_W}:${CAM_H}[cam];
    [0:v][cam]overlay=${CAM_X}:${CAM_Y}[v]
  " \
  -map "[v]" \
  -map "0:a" \
  -c:v libx264 -crf ${CRF} -preset fast -pix_fmt yuv420p -movflags +faststart \
  -c:a copy \
  -y "$OUTPUT"
# CAM_X, CAM_Y = pixel position of webcam overlay top-left corner
# Computed from the manifest webcam.position (normalized) × canvas dimensions
```

### 5.8 Thumbnail Generation

```bash
# Seek to 2 seconds in (avoids black frames at the very start)
ffmpeg \
  -ss 2 \
  -i "$CAPTURE" \
  -vframes 1 \
  -vf "scale=240:135:flags=lanczos,crop=240:135" \
  -q:v 3 \
  -y \
  "$PROJECT_BUNDLE/thumbnail.jpg"
```

### 5.9 Progress Parsing

FFmpeg is launched with `-progress pipe:2` which writes progress data to stderr in a key=value format:

```
frame=240
fps=59.94
stream_0_0_q=18.0
bitrate=  12345.6kbits/s
total_size=15728640
out_time_us=4000000
out_time=00:00:04.000000
dup_frames=0
drop_frames=0
speed=1.5x
progress=continue
```

The `FFmpegWrapper` reads stderr line by line and emits a progress event whenever it sees `out_time_us`:

```typescript
const percent = Math.round(
  (parseFloat(outTimeUs) / 1_000_000 / (trimOut - trimIn)) * 100
);
mainWindow.webContents.send('export:status', {
  status: 'encoding',
  percent,
  elapsed: (Date.now() - startTime) / 1000,
  eta: percent > 0 ? ((Date.now() - startTime) / percent * (100 - percent)) / 1000 : 0,
  currentStep: currentStep,
  totalSteps: totalSteps,
});
```

---

## 6. Electron Store Schema (Persisted Settings)

Settings are persisted using `electron-store` in the macOS user data directory:
`~/Library/Application Support/screen-studio-clone/settings.json`

```typescript
// src/shared/settings-types.ts

interface AppSettings {
  // ── General ───────────────────────────────────────────────────────────────
  launchAtLogin: boolean;              // default: false
  showFloatingBadge: boolean;          // default: true
  countdownSeconds: 0 | 3 | 5;        // default: 3
  defaultSaveLocation: string;         // default: os.homedir() + '/Desktop'

  // ── Recording ─────────────────────────────────────────────────────────────
  defaultFps: 30 | 60;                 // default: 60
  defaultSystemAudio: boolean;         // default: true
  defaultMicrophone: boolean;          // default: false
  defaultMicrophoneDeviceId: string;   // default: 'default'
  defaultWebcam: boolean;              // default: false
  defaultWebcamDeviceId: string;       // default: 'default'
  cursorTracking: boolean;             // default: true

  // ── Shortcuts ─────────────────────────────────────────────────────────────
  shortcuts: {
    startStopRecording: string;        // default: 'CommandOrControl+Shift+R'
    pauseRecording: string;            // default: 'CommandOrControl+Shift+P'
    openApp: string | null;            // default: null (not registered)
  };

  // ── Export ────────────────────────────────────────────────────────────────
  rememberLastExportSettings: boolean; // default: true
  defaultOutputFolder: string;         // default: os.homedir() + '/Desktop'
  openFinderAfterExport: boolean;      // default: true
  lastExportFormat: 'mp4' | 'gif' | 'prores';  // default: 'mp4'
  lastExportResolution: string;        // default: 'source'
  lastExportFps: number;               // default: 0 (= source)
  lastExportQuality: 'high' | 'medium' | 'web'; // default: 'high'
  lastExportAudio: string;             // default: 'aac-192'
  customExportPresets: CustomExportPreset[];

  // ── Updates ───────────────────────────────────────────────────────────────
  autoUpdate: boolean;                 // default: true
  updateCheckFrequency: 'launch' | 'daily' | 'weekly'; // default: 'daily'
  lastUpdateCheck: string | null;      // ISO 8601 timestamp, default: null

  // ── Recents ───────────────────────────────────────────────────────────────
  recentProjects: RecentProjectEntry[]; // max 10 entries, most recent first

  // ── Internal / telemetry ──────────────────────────────────────────────────
  _installId: string;                  // UUID generated on first launch; used only for crash reports
  _lastVersion: string;                // semver; used to detect upgrades and show release notes
}

interface CustomExportPreset {
  id: string;                          // UUID
  name: string;
  format: 'mp4' | 'gif' | 'prores';
  resolutionMode: 'source' | 'preset' | 'custom';
  resolutionWidth?: number;
  resolutionHeight?: number;
  fps: number;
  quality: 'high' | 'medium' | 'web';
  audioCodec: string;
  createdAt: string;
}
```

### 6.1 Settings Validation

On app launch, the settings file is validated against the schema. If any key is missing (e.g., after an upgrade that adds new settings), the default value is written back. If the settings file is corrupt (JSON parse error), it is backed up to `settings.json.bak` and a fresh settings file is created with all defaults.

### 6.2 Settings Migration

When `_lastVersion` in the settings file differs from the current app version, the settings migration function runs. Migrations are defined as:

```typescript
// src/main/settings/migrations.ts
const migrations: Record<string, (settings: Partial<AppSettings>) => Partial<AppSettings>> = {
  '1.1.0': (s) => ({
    ...s,
    // Example: add a new field introduced in 1.1.0 with its default
    showFloatingBadge: s.showFloatingBadge ?? true,
  }),
};
```

Migrations are applied sequentially from the stored version to the current version and are never run in reverse.
