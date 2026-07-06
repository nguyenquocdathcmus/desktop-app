# Technical Architecture Overview: Screen Studio Clone (macOS)

**Document Version**: 1.0  
**Last Updated**: 2026-06-29  
**Audience**: Engineering team  
**Status**: Approved

---

## 1. Architecture Summary

Screen Studio Clone uses a three-layer architecture:

1. **Electron shell** — main process (Node.js), preload bridge, renderer (React/TypeScript). Handles all UI, IPC routing, project file management, and FFmpeg orchestration.
2. **Swift native helper binaries** — small, focused command-line binaries compiled as universal macOS binaries (arm64 + x86_64). Each binary owns exactly one macOS system API surface. Communication with Electron is via stdin/stdout/stderr and process exit codes.
3. **Bundled FFmpeg and gifsicle** — statically linked universal binaries for all video processing and GIF optimization.

This architecture is directly modeled on how Screen Studio (screen.studio) is built. The key principle: **never call a macOS private API from a sandboxed Electron renderer process**. All privileged system calls go through binaries that can carry their own entitlements.

---

## 2. System Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                     ELECTRON APPLICATION BUNDLE                       ║
║                                                                        ║
║  ┌──────────────────────────────────────────────────────────────────┐ ║
║  │                    RENDERER PROCESS (sandboxed)                   │ ║
║  │                                                                   │ ║
║  │  React 18 + TypeScript                                            │ ║
║  │  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐ │ ║
║  │  │ Zustand Store│  │ Konva.js      │  │ Timeline Editor        │ │ ║
║  │  │ useProject   │  │ PreviewCanvas │  │ (Phase 3)              │ │ ║
║  │  │ useRecording │  │               │  │                        │ │ ║
║  │  │ usePlayback  │  └───────────────┘  └────────────────────────┘ │ ║
║  │  └──────┬───────┘                                                 │ ║
║  │         │ window.electronAPI (contextBridge)                      │ ║
║  └─────────┼─────────────────────────────────────────────────────────┘ ║
║            │                                                            ║
║  ┌─────────┼─────────────────────────────────────────────────────────┐ ║
║  │         │              PRELOAD SCRIPT                              │ ║
║  │  contextBridge.exposeInMainWorld('electronAPI', {                  │ ║
║  │    send: (channel, payload) => ipcRenderer.send(channel, payload), │ ║
║  │    on:   (channel, fn)     => ipcRenderer.on(channel, fn)         │ ║
║  │  })                                                                │ ║
║  └─────────┼─────────────────────────────────────────────────────────┘ ║
║            │ ipcMain / ipcRenderer                                      ║
║  ┌─────────┼─────────────────────────────────────────────────────────┐ ║
║  │         │              MAIN PROCESS (Node.js, unsandboxed)         │ ║
║  │         │                                                           │ ║
║  │  ┌──────▼──────┐   ┌──────────────────┐   ┌──────────────────┐   │ ║
║  │  │ IPC Handlers│   │ RecordingSession  │   │ ProjectManager   │   │ ║
║  │  │ handlers.ts │   │ (state machine)   │   │ SessionManifest  │   │ ║
║  │  └─────────────┘   └──────────┬───────┘   └──────────────────┘   │ ║
║  │                               │                                     │ ║
║  │  ┌────────────────────────────┼────────────────────────────────┐   │ ║
║  │  │           PROCESS MANAGER  │                                 │   │ ║
║  │  │  ┌─────────────┐  ┌───────▼──────┐  ┌──────────────────┐   │   │ ║
║  │  │  │CaptureProcess│ │CursorProcess  │  │AudioProcess      │   │   │ ║
║  │  │  └──────┬───────┘ └───────┬───────┘ └────────┬─────────┘   │   │ ║
║  │  └─────────┼─────────────────┼──────────────────┼─────────────┘   │ ║
║  │            │ child_process.spawn                  │                  │ ║
║  │  ┌─────────┼─────────────────┼──────────────────┼─────────────┐   │ ║
║  │  │Exporter │ ┌───────────────┼──────────────────┼──────────┐  │   │ ║
║  │  │        │ │    FFmpegWrapper (fluent-ffmpeg)   │          │  │   │ ║
║  │  │        │ └───────────────────────────────────────────────┘  │   │ ║
║  │  └─────────────────────────────────────────────────────────────┘   │ ║
║  └─────────────────────────────────────────────────────────────────────┘ ║
║                                                                            ║
║  app.asar.unpacked/bin/           (unsigned not allowed on macOS 13+)      ║
║  ┌───────────┐ ┌────────────────┐ ┌─────────────┐ ┌───────────────────┐  ║
║  │ capture   │ │ cursor-tracker │ │audio-composer│ │ zoom-renderer     │  ║
║  │ (Swift)   │ │ (Swift)        │ │ (Swift)      │ │ (Swift, Phase 2)  │  ║
║  │ SCKit     │ │ CGEventTap     │ │ AVFoundation │ │ Metal compute     │  ║
║  └───────────┘ └────────────────┘ └─────────────┘ └───────────────────┘  ║
║  ┌───────────┐ ┌────────────────┐                                         ║
║  │ face-     │ │ ffmpeg         │ (static universal binary)                ║
║  │ detector  │ │ gifsicle       │                                          ║
║  │ (Phase 3) │ └────────────────┘                                         ║
║  └───────────┘                                                             ║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 3. IPC Communication Patterns

### 3.1 Three-Process Model

Electron has three distinct execution contexts:

| Context | File | Trust Level | Can Spawn Processes |
|---------|------|-------------|---------------------|
| Main process | `src/main/index.ts` | Full OS access | Yes |
| Preload script | `src/preload/index.ts` | Partial (contextBridge only) | No |
| Renderer process | `src/renderer/main.tsx` | Sandboxed | No |

All `child_process.spawn` calls for Swift binaries and FFmpeg are in the **main process only**. The renderer never directly executes system commands.

### 3.2 IPC Channel Direction

**Renderer → Main** (renderer sends a request; main executes and optionally replies):

```
Renderer                  Preload                    Main
   │                        │                          │
   │ window.electronAPI     │                          │
   │   .send('recording:    │                          │
   │    start', opts)  ────►│ ipcRenderer.send ───────►│ ipcMain.on
   │                        │                          │   RecordingSession.start()
   │                        │                          │   CaptureProcess.spawn()
```

**Main → Renderer** (main pushes events; renderer reacts):

```
Main                       Preload                   Renderer
  │                          │                          │
  │ mainWindow.webContents   │                          │
  │   .send('recording:      │                          │
  │    status', status) ────►│ ipcRenderer.on ─────────►│ useRecordingStore.setState()
  │                          │                          │   UI re-renders
```

### 3.3 Request-Response Pattern (invoke/handle)

For operations that require a return value, use `ipcRenderer.invoke` / `ipcMain.handle` (Electron's promise-based IPC):

```typescript
// Renderer:
const manifest = await window.electronAPI.invoke('project:load', filePath);

// Main:
ipcMain.handle('project:load', async (event, filePath: string) => {
  return await ProjectManager.load(filePath);
});
```

Used for: `project:load`, `project:save-as`, `dialog:open-file`, `dialog:save-file`, `permissions:check`.

### 3.4 Streaming Events Pattern

For long-running operations (recording, export), the main process emits a series of events rather than a single response:

```typescript
// Main emits multiple events during export:
mainWindow.webContents.send('export:progress', { percent: 0 });
// ... FFmpeg runs ...
mainWindow.webContents.send('export:progress', { percent: 45 });
// ... FFmpeg completes ...
mainWindow.webContents.send('export:complete', { outputPath: '/Users/.../output.mp4' });
// OR on failure:
mainWindow.webContents.send('export:error', { code: 'E008', message: '...' });
```

The renderer subscribes to all relevant channels on mount and unsubscribes on unmount.

### 3.5 Typed IPC Contract

All IPC channels are defined as discriminated unions in `src/shared/ipc-types.ts`. This file is imported by both main and renderer. The preload script re-exposes only the channel names (not the types) via `contextBridge`. TypeScript enforces correct payload shapes at both ends.

---

## 4. Swift Binary Protocol Specification

### 4.1 General Conventions

All Swift binaries share these conventions:

- **Arguments**: command-line flags (see per-binary spec below)
- **stdout**: structured JSON or raw binary data (varies per binary)
- **stderr**: human-readable log lines (for debugging; not machine-parsed)
- **Exit codes**: 0 = success, 1 = permission error, 2 = invalid arguments, 3 = runtime error, 127 = binary not found
- **Termination**: SIGTERM is the expected stop signal. The binary must handle it gracefully (flush buffers, finalize files) and exit within 2 seconds. After 5 seconds, the main process sends SIGKILL.

### 4.2 `capture` Binary

**Location**: `app.asar.unpacked/bin/capture`  
**Purpose**: Records the selected display to a lossless HEVC .mov file using ScreenCaptureKit.

**Arguments**:
```
capture --display <display-id>
        --output <path/to/output.mov>
        --fps <30|60>
        [--capture-audio]
        [--check-permissions]
```

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--display` | string (CGDirectDisplayID as decimal) | Yes (unless `--check-permissions`) | The display to capture |
| `--output` | string (absolute path) | Yes | Path for the output .mov file |
| `--fps` | int (30 or 60) | No (default: 60) | Target capture frame rate |
| `--capture-audio` | flag | No | If present, captures system audio into the output |
| `--check-permissions` | flag | No | If present, checks ScreenCaptureKit permission and exits without recording |

**stdout events** (one JSON object per line, newline-delimited):
```json
{"event": "ready"}
{"event": "frame", "count": 1, "pts": 0.016667, "size": 4194304}
{"event": "frame", "count": 2, "pts": 0.033333, "size": 4194304}
{"event": "error", "code": "permission_denied", "message": "SCStreamErrorDomain code 7"}
{"event": "done", "frameCount": 3600, "duration": 60.0, "outputPath": "/tmp/.../capture.mov"}
```

**Permission check mode** (invoked with `--check-permissions`):
- Exit code 0: permission granted
- Exit code 1: permission not granted

**ScreenCaptureKit configuration**:
```swift
config.width  = display.width  * 2   // 2x for Retina
config.height = display.height * 2
config.pixelFormat   = kCVPixelFormatType_32BGRA
config.minimumFrameInterval = CMTime(value: 1, timescale: Int32(fps))
config.capturesAudio = captureAudio
```

**VideoToolbox encoder settings**:
```swift
// HEVC Lossless — hardware-accelerated on Apple Silicon
compressionProps[kVTCompressionPropertyKey_ProfileLevel] =
    kVTProfileLevel_HEVC_Main_AutoLevel
compressionProps[kVTCompressionPropertyKey_Quality] = 1.0
compressionProps[kVTCompressionPropertyKey_RealTime] = true
```

### 4.3 `cursor-tracker` Binary

**Location**: `app.asar.unpacked/bin/cursor-tracker`  
**Purpose**: Tracks mouse position, click events, and keyboard events in real time, streaming JSON to stdout.

**Arguments**:
```
cursor-tracker [--include-keyboard]
               [--keyboard-filter <modifiers-only|all>]
               [--time-ref <mach-absolute-time-at-recording-start>]
```

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--include-keyboard` | flag | No | If present, captures keyboard events |
| `--keyboard-filter` | string | No (default: modifiers-only) | Filter level for keyboard events |
| `--time-ref` | uint64 | No (default: start of binary) | Mach absolute time reference for synchronization with capture binary |

**stdout format** (newline-delimited JSON; one event per line):
```json
{"t": 1234567890.123, "x": 1024, "y": 768, "type": "move"}
{"t": 1234567890.456, "x": 1024, "y": 768, "type": "click", "button": "left"}
{"t": 1234567890.789, "x": 1024, "y": 768, "type": "click", "button": "right"}
{"t": 1234567891.000, "x": 1024, "y": 768, "type": "mousedown", "button": "left"}
{"t": 1234567891.100, "x": 1024, "y": 768, "type": "mouseup",   "button": "left"}
{"t": 1234567892.000, "type": "keydown", "key": "cmd+shift+5", "display": "⌘⇧5"}
```

**Timestamp field `t`**: Unix timestamp with millisecond precision, derived from `mach_absolute_time()` converted to wall clock time using the reference provided at launch. This allows frame-accurate synchronization with the `capture` binary's CMSampleBuffer PTS.

**CGEventTap configuration**:
```swift
let eventMask: CGEventMask =
    (1 << CGEventType.mouseMoved.rawValue)   |
    (1 << CGEventType.leftMouseDown.rawValue)|
    (1 << CGEventType.rightMouseDown.rawValue)|
    (1 << CGEventType.keyDown.rawValue)
let tap = CGEvent.tapCreate(
    tap: .cghidEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: eventMask,
    callback: eventCallback,
    userInfo: nil
)
```

### 4.4 `audio-composer` Binary

**Location**: `app.asar.unpacked/bin/audio-composer`  
**Purpose**: Mixes system audio and microphone audio in real time during recording, writing a combined audio track.

**Arguments**:
```
audio-composer --output <path/to/audio.m4a>
               [--system-audio]
               [--microphone <device-uid>]
               [--mic-gain <0.0-2.0>]
               [--system-gain <0.0-2.0>]
```

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--output` | string | Yes | Output path for the mixed audio |
| `--system-audio` | flag | No | Capture system audio via CoreAudio loopback |
| `--microphone` | string | No | UID of the microphone device to capture |
| `--mic-gain` | float | No (default: 1.0) | Gain multiplier for microphone channel |
| `--system-gain` | float | No (default: 1.0) | Gain multiplier for system audio channel |

**stdout events**:
```json
{"event": "ready"}
{"event": "level", "system": -12.5, "mic": -18.3}
{"event": "done", "duration": 60.0, "outputPath": "/tmp/.../audio.m4a"}
```

**AVFoundation configuration**: Uses `AVAudioEngine` with separate nodes for system audio tap (`AVAudioInputNode` with hardware input) and aggregate device for simultaneous system audio capture.

### 4.5 `zoom-renderer` Binary (Phase 2)

**Location**: `app.asar.unpacked/bin/zoom-renderer`  
**Purpose**: Applies the zoom/pan path to each frame of `capture.mov` using a Metal compute shader (bicubic resampling), outputting a processed `.mov`.

**Arguments**:
```
zoom-renderer --input  <path/to/capture.mov>
              --output <path/to/zoomed.mov>
              --zoom-path <path/to/zoom-path.json>
              [--progress]
```

**zoom-path.json format**:
```json
{
  "fps": 60,
  "events": [
    {
      "startTime": 0.0,
      "endTime": 0.0,
      "zoomLevel": 1.0,
      "centerX": 0.5,
      "centerY": 0.5,
      "easing": "none"
    },
    {
      "startTime": 2.4,
      "endTime": 2.4,
      "zoomLevel": 2.0,
      "centerX": 0.312,
      "centerY": 0.654,
      "easing": "spring"
    }
  ]
}
```

**stdout events** (when `--progress` flag is set):
```json
{"event": "progress", "frame": 120, "total": 3600, "percent": 3.3}
{"event": "done", "frameCount": 3600, "outputPath": "/tmp/.../zoomed.mov"}
```

**Metal shader description**: For each output frame, the shader computes the interpolated zoom level and center point using spring physics, calculates the source sample region, and performs bicubic resampling from the source texture into the output texture.

### 4.6 `face-detector` Binary (Phase 3)

**Location**: `app.asar.unpacked/bin/face-detector`  
**Purpose**: Detects face bounding boxes in a webcam video stream using the Vision framework, streaming position data for webcam crop centering.

**Arguments**:
```
face-detector --input <path/to/webcam.mov>
              --mode <file|realtime>
              [--output-crop <path/to/crop-path.json>]
```

**stdout events** (realtime mode — one per frame):
```json
{"t": 1234567890.123, "faces": [{"x": 0.2, "y": 0.1, "w": 0.4, "h": 0.6, "confidence": 0.98}]}
{"t": 1234567890.140, "faces": []}
```

All coordinates are normalized (0.0–1.0) relative to the frame dimensions.

---

## 5. Data Models

### 5.1 SessionManifest

```typescript
// src/shared/project-types.ts

interface SessionManifest {
  version: '1.0';
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  projectName: string;
  
  // Source media
  sourceDuration: number;     // seconds, float
  sourceResolution: { width: number; height: number };
  sourceFps: number;          // 30 or 60
  hasAudio: boolean;
  hasWebcam: boolean;         // Phase 3
  hasCursorData: boolean;
  
  // Trim
  trimIn: number;             // seconds from start; default 0
  trimOut: number;            // seconds from start; default = sourceDuration
  
  // Pause intervals (Phase 2)
  pauseIntervals: Array<{ start: number; end: number }>;
  
  // Canvas
  canvas: CanvasSettings;
  
  // Effects
  zoom: ZoomSettings;         // Phase 2
  cursor: CursorSettings;     // Phase 2
  frame: FrameSettings;       // Phase 2
  webcam: WebcamSettings;     // Phase 3
  
  // Audio
  audio: AudioSettings;
}

interface CanvasSettings {
  background: BackgroundSource;
  padding: number;             // pixels
  cornerRadius: number;        // pixels
  aspectRatio: 'source' | '16:9' | '1:1' | '9:16' | '4:3' | 'custom';
  customAspectWidth?: number;
  customAspectHeight?: number;
}

type BackgroundSource =
  | { type: 'solid';    color: string }
  | { type: 'gradient'; stops: GradientStop[]; angle: number }
  | { type: 'image';    assetPath: string; fit: 'cover' | 'contain' | 'fill' }
  | { type: 'blur';     blurRadius: number; assetPath: string }
  | { type: 'wallpaper-builtin'; wallpaperId: string };

interface GradientStop {
  color: string;               // hex string
  position: number;            // 0.0–1.0
}
```

### 5.2 ZoomSettings and ZoomEvent

```typescript
interface ZoomSettings {
  enabled: boolean;
  level: number;               // 1.0–3.0; default 2.0
  sensitivity: 'low' | 'medium' | 'high';
  events: ZoomEvent[];         // generated by ZoomPathGenerator
}

interface ZoomEvent {
  startTime: number;           // seconds
  endTime: number;             // seconds (for the state at this zoom level)
  zoomLevel: number;           // 1.0 = full out, 3.0 = max zoom
  centerX: number;             // 0.0–1.0 normalized to source video width
  centerY: number;             // 0.0–1.0 normalized to source video height
  easing: 'spring' | 'ease-in-out' | 'none';
  triggerType: 'cursor-pause' | 'click' | 'manual';
}
```

### 5.3 CursorSettings

```typescript
interface CursorSettings {
  highlightEnabled: boolean;
  highlightSize: 'small' | 'medium' | 'large';    // 20px / 32px / 48px radius
  highlightOpacity: number;                         // 0.0–1.0
  highlightColor: string;                           // hex
  rippleEnabled: boolean;
  rippleColorLeft: string;                          // hex; default '#FFFFFF'
  rippleColorRight: string;                         // hex; default '#FF8C00'
  keyboardOverlayEnabled: boolean;
  keyboardOverlayPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}
```

### 5.4 ExportOptions

```typescript
interface ExportOptions {
  format: 'mp4' | 'gif' | 'prores';
  outputPath: string;
  resolution: ExportResolution;
  fps: number;
  quality: 'high' | 'medium' | 'web';      // CRF 18 / 23 / 28
  audioCodec: 'aac-192' | 'aac-128' | 'none';
  
  // GIF-specific
  gifWidth?: number;
  gifFps?: number;
  gifOptimizeLevel?: 1 | 2 | 3;
  
  // Applied from manifest
  trimIn: number;
  trimOut: number;
}

interface ExportResolution {
  mode: 'source' | 'preset' | 'custom';
  width?: number;
  height?: number;
}
```

### 5.5 RecordingStatus

```typescript
type RecordingStatus =
  | { status: 'idle' }
  | { status: 'countdown'; remaining: number }
  | { status: 'recording'; duration: number; frameCount: number }
  | { status: 'paused';    duration: number }
  | { status: 'processing' }
  | { status: 'done';      sessionPath: string; duration: number }
  | { status: 'error';     code: string; message: string };
```

---

## 6. State Machine Diagrams

### 6.1 Recording Session State Machine

Managed by `src/main/recording/RecordingSession.ts`.

```
                    ┌────────┐
          [start]   │        │  [cancel during countdown]
   ─────────────────►  READY ◄───────────────────────────
                    │        │
                    └───┬────┘
                        │ [startCountdown()]
                        ▼
                    ┌───────────┐
                    │COUNTDOWN  │
                    │ 3 → 2 → 1 │
                    └───┬───────┘
                        │ [countdown complete]
                        │ [spawn capture, cursor-tracker, audio-composer]
                        ▼
                    ┌───────────┐
           ─────────►RECORDING  ├─────────────────┐
           │        │           │   [pause()]     │
    [resume()]      └───┬───────┘                 ▼
           │            │                    ┌─────────┐
           └────────────┤ [stop()]           │ PAUSED  │
                        │                   └────┬────┘
                        │                        │ [resume()]
                        │ ◄──────────────────────┘
                        ▼
                    ┌──────────────┐
                    │ PROCESSING   │
                    │ (finalizing  │
                    │  files)      │
                    └───┬──────────┘
              ┌─────────┴─────────┐
              │ [success]         │ [error]
              ▼                   ▼
          ┌──────┐           ┌─────────┐
          │ DONE │           │  ERROR  │
          └──────┘           └─────────┘
              │
              │ [openEditor()]
              ▼
          EDITOR STATE (renderer owns this)
```

### 6.2 Export State Machine

Managed by `src/main/export/Exporter.ts`.

```
     ┌────────┐
     │  IDLE  │
     └───┬────┘
         │ [exportStart(options)]
         ▼
     ┌──────────────────┐
     │  BUILDING_FILTER │  Constructs FFmpeg filter graph string
     │  _GRAPH          │  Resolves all asset paths
     └───┬──────────────┘
         │
         ▼
     ┌──────────────────────────────────────────────────────┐
     │  ZOOM_RENDER (if zoom enabled, Phase 2)              │
     │  Spawns zoom-renderer binary; waits for completion   │
     └───┬──────────────────────────────────────────────────┘
         │
         ▼
     ┌──────────────────┐
     │  FFMPEG_RUNNING  ├────────────────────────────────────┐
     │  (spawned, pid   │  [progress events stream to        │
     │   tracked)       │   renderer via IPC]                │
     └───┬──────────────┘                                    │
         │ [FFmpeg exits 0]        [cancel() called]         │
         │                                 │                 │
         ▼                                 ▼                 │
     ┌──────────┐               ┌─────────────────┐         │
     │  GIF     │               │  CANCELLING     │         │
     │  OPTIMIZE│               │  (kill FFmpeg   │         │
     │  (if GIF)│               │   process)      │         │
     └───┬──────┘               └───────┬─────────┘         │
         │ [gifsicle completes]         │ [process killed]   │ [FFmpeg exits non-0]
         ▼                              ▼                    ▼
     ┌──────────┐               ┌──────────────┐       ┌─────────┐
     │  SUCCESS │               │  CANCELLED   │       │  ERROR  │
     └──────────┘               └──────────────┘       └─────────┘
```

### 6.3 Renderer UI State Machine

Managed by Zustand stores; the router renders different views based on this state.

```
     ┌─────────────────┐
     │   HOME          │
     │ (home screen)   │
     └───┬─────────────┘
         │ [newRecording]            [openProject]
         │──────────────────────┐   │
         ▼                      ▼   ▼
     ┌──────────────┐    ┌─────────────────┐
     │ DISPLAY      │    │     EDITOR      │
     │ PICKER       │    │ (playback,      │
     └──────┬───────┘    │  effects,       │
            │            │  export)        │
            │ [select]   └────────┬────────┘
            ▼                     │ [← Home]
     ┌──────────────┐            │
     │ PRE-RECORD   │            ▼
     │ CONFIG       │        HOME (reset)
     └──────┬───────┘
            │ [startRecording]
            ▼
     ┌──────────────┐
     │ RECORDING    │  (app mostly hidden; menu bar active)
     │ ACTIVE       │
     └──────┬───────┘
            │ [stopRecording]
            ▼
     ┌──────────────┐
     │ PROCESSING   │
     └──────┬───────┘
            │ [done]
            ▼
         EDITOR
```

---

## 7. Zustand Store Architecture

### 7.1 Store Boundaries

| Store | File | Owns |
|-------|------|------|
| `useRecordingStore` | `src/renderer/store/useRecordingStore.ts` | Recording status, current display selection, audio config |
| `useProjectStore` | `src/renderer/store/useProjectStore.ts` | Current project manifest, project path, dirty state |
| `usePlaybackStore` | `src/renderer/store/usePlaybackStore.ts` | currentTime, playing state, duration |

### 7.2 Cross-Store Communication

Stores do not import each other. Cross-store coordination happens in React hooks or component event handlers:

```typescript
// Example: stopping recording updates both stores
function useStopRecording() {
  const setRecordingStatus = useRecordingStore(s => s.setStatus);
  const loadProject = useProjectStore(s => s.loadFromPath);
  
  return async () => {
    window.electronAPI.send('recording:stop');
    // Main process will emit 'recording:status' { status: 'done', sessionPath }
    // which is handled in a useEffect subscribing to that channel:
    //   setRecordingStatus('processing')
    //   ... then on done:
    //   loadProject(sessionPath)
  };
}
```

### 7.3 IPC Event Subscription Pattern

```typescript
// src/renderer/hooks/useIPCSubscription.ts
useEffect(() => {
  const unsubscribe = window.electronAPI.on('recording:status', (status: RecordingStatus) => {
    useRecordingStore.getState().setStatus(status);
  });
  return unsubscribe;  // cleanup on unmount
}, []);
```

---

## 8. Build and Packaging

### 8.1 Build Process

```
scripts/build-swift.sh
  → swiftc compile each Swift package for arm64
  → swiftc compile each Swift package for x86_64
  → lipo -create to produce universal binaries
  → Place binaries in resources/bin/

scripts/download-ffmpeg.sh
  → Download pre-built static FFmpeg universal binary
  → Verify SHA256 checksum
  → Place in resources/bin/ffmpeg

npm run build
  → electron-vite build (main + preload + renderer)
  → electron-builder package (DMG + app bundle)

scripts/sign-helpers.sh
  → codesign --sign "Developer ID Application: ..."
             --entitlements entitlements.plist
             resources/bin/* (all binaries)
  → codesign verify each binary
```

### 8.2 electron-builder Configuration (`electron-builder.yml`)

```yaml
appId: com.screenstudio.clone
productName: Screen Studio
mac:
  target: [dmg, mas]
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: entitlements.plist
  entitlementsInherit: entitlements.plist
  category: public.app-category.video
asarUnpack:
  - resources/bin/**
  - resources/wallpapers/**
  - resources/frames/**
```

### 8.3 macOS Entitlements

```xml
<!-- entitlements.plist -->
<key>com.apple.security.cs.allow-jit</key><true/>           <!-- Electron v8+ -->
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>  <!-- Swift helpers -->
<key>com.apple.security.screen-recording</key><true/>       <!-- ScreenCaptureKit -->
<key>com.apple.security.device.microphone</key><true/>      <!-- AVFoundation -->
<key>com.apple.security.device.camera</key><true/>          <!-- Webcam, Phase 3 -->
```

### 8.4 Privacy Manifest (macOS 15+)

The `NSPrivacyCollectedDataTypes` key in `Info.plist` must declare:
- `NSPrivacyCollectedDataTypeScreenRecording` — purpose: user-initiated screen recording, not transmitted
- `NSPrivacyCollectedDataTypeMicrophone` — purpose: user-initiated audio capture, not transmitted

---

## 9. Critical Implementation Notes

### 9.1 Frame-Accurate Cursor Synchronization

The `cursor-tracker` binary uses `mach_absolute_time()` internally and converts to wall-clock time. The `capture` binary timestamps each frame using `CMSampleBuffer.presentationTimeStamp`. To synchronize:

1. At recording start, the main process records the system time `T0` immediately before spawning both binaries.
2. Both binaries receive `T0` (as a Unix timestamp in microseconds) via the `--time-ref` argument.
3. At export time, cursor events are mapped to video frames by aligning their Unix timestamps to the video PTS relative to the first frame's capture time.

### 9.2 Lossless Intermediate Video

The capture binary always produces lossless HEVC encoded with VideoToolbox. This ensures no quality loss from the source capture through to the export. The FFmpeg export step is the only lossy encoding step.

Approximate file sizes for lossless HEVC capture:
- 1080p60: ~500MB/min
- 4K60: ~2GB/min

Users should be warned if available disk space is less than `sourceDuration × 2GB/min × 1.5` (safety margin).

### 9.3 `asar.unpacked` for Binary Resources

Because Electron packs the app into an `asar` archive (essentially a tar file), and Swift binaries cannot be executed from inside an archive, all binaries must be listed under `asarUnpack` in `electron-builder.yml`. They will be placed in `app.asar.unpacked/resources/bin/`. The path to these binaries at runtime is:

```typescript
import path from 'path';
import { app } from 'electron';

const binPath = app.isPackaged
  ? path.join(process.resourcesPath, 'bin')
  : path.join(__dirname, '../../resources/bin');
```

### 9.4 Code Signing Chain

Every binary in `resources/bin/` must be signed with the **same Team ID** as the app bundle. If any binary has a different Team ID or is unsigned:
- ScreenCaptureKit will deny permission silently (no error, no prompt)
- CGEventTap will fail silently
- macOS Gatekeeper will block execution on first launch

Run `scripts/sign-helpers.sh` before every release build, even during development when testing on real hardware.
