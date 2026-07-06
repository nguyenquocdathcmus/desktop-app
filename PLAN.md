# Screen Studio Clone — Implementation Plan (macOS)

> Tài liệu này được tạo bởi Plan Agent dựa trên phân tích ứng dụng Screen Studio (screen.studio).

---

## 1. Kiến trúc được chọn

### Electron + React/TypeScript + Swift Native Helpers

Đây chính xác là cách Screen Studio thực tế được build. Electron làm shell UI, các binary Swift nhỏ xử lý mọi thứ nặng của macOS (capture, audio, face detection).

| Tiêu chí | Electron + Swift Helpers | Pure Swift | Tauri + Rust |
|---|---|---|---|
| Time to first recording | 2 tuần | 6-8 tuần | 5-7 tuần |
| Performance | Xuất sắc (native helpers) | Xuất sắc | Xuất sắc |
| Dev iteration speed | Nhanh (HMR) | Chậm | Trung bình |
| Distribution | Medium (Electron Builder) | Medium (notarize) | Medium |
| Windows support tương lai | Có | Không | Có |
| Memory footprint | ~200MB | ~30MB | ~50MB |

**Tại sao không pure Swift?** Mất 6-8 tuần để học SwiftUI, không có HMR, compile chậm.  
**Tại sao không Tauri/Rust?** Ecosystem cho AVFoundation/ScreenCaptureKit còn non-mature.

---

## 2. Technology Stack

| Layer | Công nghệ |
|---|---|
| App shell | Electron 26.x |
| Build tool | electron-vite 5.x (HMR cho main + renderer) |
| UI | React 18 + TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS variables |
| State | Zustand 5.x + Immer |
| Canvas/Preview | Konva.js 9.x + react-konva |
| Video processing | Bundled FFmpeg binary (arm64 + x86_64 universal) |
| FFmpeg wrapper | fluent-ffmpeg |
| GIF export | Bundled gifsicle binary |
| Packaging | electron-builder (dmg + mas targets) |
| Auto-update | electron-updater (GitHub Releases) |
| Swift helpers | Swift 6, compiled via swiftc, bundled universal binaries |

---

## 3. Swift Native Helpers

Tất cả các binary Swift được compiled và bundled vào `app.asar.unpacked/bin/`. Electron giao tiếp qua `child_process.spawn`.

| Binary | Chức năng | Apple API |
|--------|-----------|-----------|
| `capture` | Ghi màn hình lossless (60fps, 4K) | ScreenCaptureKit |
| `cursor-tracker` | Track vị trí + click chuột, stream JSON qua stdout | CGEventTap |
| `audio-composer` | Mix system audio + microphone | AVFoundation, CoreAudio |
| `zoom-renderer` | Apply zoom/pan frame-by-frame bằng bicubic sampling | Metal compute shader |
| `face-detector` | Detect khuôn mặt cho webcam tracking | Vision framework |

### Cursor Event Format (stdout JSON stream)
```json
{"t":1234567890.123,"x":1024,"y":768,"type":"move"}
{"t":1234567890.456,"x":1024,"y":768,"type":"click","button":"left"}
{"t":1234567891.000,"type":"keydown","key":"cmd+shift+5","display":"⌘⇧5"}
```

### Project File Format (`.screenstudio` bundle)
```
recording_2024_01_15.screenstudio/
  manifest.json       # project metadata + tất cả effect settings
  capture.mov         # raw video (lossless HEVC)
  cursor.json         # cursor event log
  audio.m4a           # optional separate audio
  thumbnail.jpg       # generated preview frame
```

---

## 4. Phase 1 — MVP: Core Recording + Basic Export (8-10 tuần)

### Mục tiêu
App có thể: start/stop screen recording, preview trong editor, apply background + padding + rounded corners, export MP4.

### 4.1 Screen Capture (`capture` binary)
Sử dụng **ScreenCaptureKit** (macOS 12.3+):

```swift
let content = try await SCShareableContent.current
let config = SCStreamConfiguration()
config.width = display.width * 2  // Retina
config.height = display.height * 2
config.pixelFormat = kCVPixelFormatType_32BGRA
config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
config.capturesAudio = true
```

Output: file `.mov` lossless dùng VideoToolbox HEVC Lossless encode (hardware-accelerated trên Apple Silicon).

### 4.2 Session State Machine
```
idle → ready → recording → processing → done
```

### 4.3 IPC Contract (Typed)
File: `src/shared/ipc-types.ts` — tất cả IPC channels dưới dạng discriminated unions.

```typescript
export type MainToRenderer =
  | { channel: 'recording:status'; payload: RecordingStatus }
  | { channel: 'recording:error'; payload: { code: string; message: string } }
  | { channel: 'export:progress'; payload: { percent: number } };

export type RendererToMain =
  | { channel: 'recording:start'; payload: StartOptions }
  | { channel: 'recording:stop' }
  | { channel: 'export:start'; payload: ExportOptions };
```

### 4.4 Preview Compositor (Konva.js)
```typescript
// src/renderer/hooks/usePreviewCompositor.ts
// Konva stage:
// 1. Fill background (color/gradient/image)
// 2. Clip inner rect thành roundedRect với padding
// 3. Draw video frame bên trong clip
// 4. Draw cursor overlay (Phase 2)
// Chạy tại requestAnimationFrame rate
```

### 4.5 Export Pipeline — Phase 1
FFmpeg command cho background + padding cơ bản:
```bash
ffmpeg -i capture.mov \
  -filter_complex "[0:v]scale=W:H,pad=W+PAD*2:H+PAD*2:PAD:PAD:color=BGCOLOR[v]" \
  -map "[v]" -map 0:a \
  -c:v libx264 -crf 18 -preset fast \
  output.mp4
```

### 4.6 BackgroundSource Type
```typescript
type BackgroundSource =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; stops: GradientStop[]; angle: number }
  | { type: 'image'; path: string; fit: 'cover' | 'contain' | 'fill' }
  | { type: 'blur'; blurRadius: number; screenshotPath: string }
  | { type: 'wallpaper'; screenshotPath: string };
```

### Phase 1 Deliverables
- [x] App khởi động, chọn display
- [x] Start/stop recording với ScreenCaptureKit
- [x] Preview: background + padding controls
- [x] Export MP4 cơ bản
- [x] Project save/open (`.screenstudio` bundle)

---

## 5. Phase 2 — Effects: Zoom/Pan, Cursor, Backgrounds (6-8 tuần)

### 5.1 Automatic Zoom/Pan — Core Differentiator

Algorithm:
1. Cursor event log ghi tất cả positions + clicks tại 60fps
2. Post-processing pass tìm "regions of interest" (pause hoặc click)
3. Tạo camera path: `{ time, zoomLevel, centerX, centerY }[]`
4. Áp dụng qua Metal shader trong export

```typescript
// src/renderer/effects/ZoomPathGenerator.ts
interface ZoomEvent {
  startTime: number;
  endTime: number;
  zoomLevel: number;    // 1.0 = no zoom, 2.0 = 2x zoom
  centerX: number;      // 0.0-1.0 normalized
  centerY: number;
  easing: 'spring' | 'ease-in-out';
}
```

**Spring Physics** (critically-damped, tạo cảm giác cinematic):
```typescript
// stiffness: 200, damping: 28 — đây là magic numbers của Screen Studio
function springStep(current, target, velocity, dt, k = 200, b = 28) {
  const force = -k * (current - target) - b * velocity;
  const newVelocity = velocity + force * dt;
  const newPosition = current + newVelocity * dt;
  return { position: newPosition, velocity: newVelocity };
}
```

### 5.2 Cursor Effects
- Soft circle highlight luôn hiển thị (low opacity)
- Click ripple animation (scale + fade)
- Cursor smoothing: moving average 5-10 samples để loại bỏ jitter

### 5.3 Keyboard Shortcut Visualization
Transparent Electron window (`alwaysOnTop: true`) hiển thị keystroke badges. Dữ liệu lấy từ `cursor-tracker` binary (đã capture keyboard events).

### 5.4 Device Frame Overlays
SVG frames (MacBook bezel, browser chrome, iPhone) composited:
- Preview: Konva `Image` layer phía trên video
- Export: FFmpeg `overlay` filter

### Phase 2 Deliverables
- [x] Zoom/pan tự động theo cursor với spring physics
- [x] Cursor highlight + click animations
- [x] Background: gradient, image, frosted glass blur
- [x] Keyboard shortcut overlay
- [x] Device frame overlays

---

## 6. Phase 3 — Polish: Timeline, Webcam, Presets (6-8 tuần)

### 6.1 Timeline Editor
Custom component (không có library nào phù hợp):
```
src/renderer/components/Timeline/
  Timeline.tsx          # root, quản lý scrubber + clip regions
  ClipRegion.tsx        # draggable trim handles (in/out points)
  ZoomEventTrack.tsx    # visual zoom events trên timeline
  AudioWaveform.tsx     # waveform từ Web Audio API
  Playhead.tsx          # current time indicator
```

### 6.2 Webcam Overlay
- Capture: `navigator.mediaDevices.getUserMedia` trong renderer
- Face tracking: `face-detector` binary (Vision framework)
- Export: FFmpeg overlay composite
```bash
ffmpeg -i screen.mov -i webcam.mov \
  -filter_complex "[1:v]scale=320:240[cam]; [0:v][cam]overlay=W-320-20:H-240-20[v]" \
  output.mp4
```

### 6.3 GIF Export
```bash
# Step 1: Generate palette
ffmpeg -i input.mov -vf "fps=12,scale=800:-1:flags=lanczos,palettegen" palette.png

# Step 2: Apply palette
ffmpeg -i input.mov -i palette.png -vf "fps=12,scale=800:-1:flags=lanczos,paletteuse" output.gif

# Step 3: Optimize
gifsicle --optimize=3 output.gif -o final.gif
```

### 6.4 Export Presets
```typescript
export const EXPORT_PRESETS: ExportPreset[] = [
  { name: 'Twitter/X',    width: 1280, height: 720,  fps: 30, format: 'mp4' },
  { name: 'YouTube',      width: 1920, height: 1080, fps: 60, format: 'mp4' },
  { name: 'LinkedIn',     width: 1280, height: 720,  fps: 30, format: 'mp4' },
  { name: 'Slack/Discord',width: 800,  height: 450,  fps: 24, format: 'gif' },
];
```

### Phase 3 Deliverables
- [x] Timeline với trim handles + audio waveform
- [x] Webcam overlay với face tracking
- [x] GIF export
- [x] Export presets (social media)
- [x] Auto-update với electron-updater

---

## 7. Project Structure

```
screen-studio/
├── package.json
├── tsconfig.json
├── vite.config.ts              # electron-vite config
├── electron-builder.yml        # packaging config
├── entitlements.plist          # macOS entitlements
│
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/
│   │   │   └── handlers.ts
│   │   ├── recording/
│   │   │   ├── RecordingSession.ts   # session state machine
│   │   │   ├── CaptureProcess.ts     # spawn capture binary
│   │   │   ├── CursorProcess.ts      # spawn cursor-tracker binary
│   │   │   └── AudioProcess.ts       # spawn audio-composer binary
│   │   ├── export/
│   │   │   ├── Exporter.ts
│   │   │   ├── ZoomExporter.ts
│   │   │   └── FFmpegWrapper.ts
│   │   └── project/
│   │       ├── ProjectManager.ts
│   │       └── SessionManifest.ts
│   │
│   ├── preload/
│   │   └── index.ts            # contextBridge typed IPC
│   │
│   ├── renderer/               # React UI
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   │   ├── useProjectStore.ts
│   │   │   ├── useRecordingStore.ts
│   │   │   └── usePlaybackStore.ts
│   │   ├── components/
│   │   │   ├── Editor/
│   │   │   │   ├── Editor.tsx
│   │   │   │   ├── PreviewCanvas.tsx       # Konva compositor
│   │   │   │   ├── ControlBar.tsx
│   │   │   │   └── Sidebar/
│   │   │   │       ├── BackgroundPanel.tsx
│   │   │   │       ├── PaddingPanel.tsx
│   │   │   │       ├── ZoomPanel.tsx       # Phase 2
│   │   │   │       └── CursorPanel.tsx     # Phase 2
│   │   │   ├── Timeline/                   # Phase 3
│   │   │   │   ├── Timeline.tsx
│   │   │   │   ├── ClipRegion.tsx
│   │   │   │   ├── ZoomEventTrack.tsx
│   │   │   │   └── AudioWaveform.tsx
│   │   │   ├── Recording/
│   │   │   │   ├── DisplayPicker.tsx
│   │   │   │   └── RecordingControls.tsx
│   │   │   └── Export/
│   │   │       ├── ExportModal.tsx
│   │   │       └── ExportPresets.tsx
│   │   ├── effects/
│   │   │   ├── ZoomPathGenerator.ts    # zoom timeline từ cursor log
│   │   │   ├── SpringSimulator.ts      # spring physics
│   │   │   ├── CursorSmoother.ts       # moving average
│   │   │   └── KeystrokeOverlay.ts
│   │   └── assets/
│   │       ├── frames/                 # device frame SVGs
│   │       └── wallpapers/
│   │
│   └── shared/
│       ├── ipc-types.ts            # ALL IPC channel types
│       ├── project-types.ts        # SessionManifest, ExportOptions...
│       └── constants.ts
│
├── swift/                      # Swift helper binaries
│   ├── capture/
│   │   ├── Package.swift
│   │   └── Sources/capture/
│   │       ├── main.swift
│   │       ├── ScreenCapture.swift
│   │       └── VideoWriter.swift
│   ├── cursor-tracker/
│   │   └── Sources/main.swift
│   ├── audio-composer/
│   │   └── Sources/main.swift
│   ├── face-detector/              # Phase 3
│   │   └── Sources/main.swift
│   └── zoom-renderer/              # Phase 2
│       └── Sources/main.swift
│
└── scripts/
    ├── build-swift.sh          # compile + lipo universal binaries
    ├── download-ffmpeg.sh      # fetch static FFmpeg binary
    └── sign-helpers.sh         # codesign tất cả binaries trong bin/
```

---

## 8. Development Sequence (16 tuần)

| Tuần | Công việc |
|------|-----------|
| 1-2 | electron-vite setup, IPC contract (`ipc-types.ts`), Zustand stores, basic window layout |
| 3-4 | Swift `capture` binary (ScreenCaptureKit) — **highest risk** |
| 5-6 | Editor preview với Konva.js (background + padding + rounded corners) |
| 7-8 | FFmpeg export pipeline — MP4 cơ bản |
| 9 | Swift `cursor-tracker` binary |
| 10 | Zoom/Pan algorithm + SpringSimulator |
| 11-12 | Cursor effects (highlight, ripple) + export |
| 13-14 | Timeline editor, webcam capture |
| 15-16 | GIF export, presets, auto-update, packaging |

---

## 9. Rủi ro và Gotchas Quan trọng

### Code Signing (Critical)
Mỗi binary trong `bin/` phải được signed với cùng Team ID. Thêm `scripts/sign-helpers.sh` từ sớm và test ngay. TCC permissions sẽ không hiện nếu signing sai — app sẽ fail silently.

### ScreenCaptureKit Entitlements
Yêu cầu entitlement `com.apple.security.screen-recording`. Trigger TCC permission prompt lần đầu. Binary phải được signed với cùng Team ID hoặc được bless bởi app bundle.

### CGEventTap — Accessibility Permission
`cursor-tracker` binary cần Accessibility permission (TCC prompt thứ 2). Phải handle gracefully khi user từ chối.

### FFmpeg Universal Binary
Phải là universal binary (arm64 + x86_64). Kiểm tra bằng:
```bash
file ffmpeg
# Output phải chứa: Mach-O universal binary with 2 architectures
```

### Electron Sandboxing
Tất cả `child_process.spawn` phải chạy trong **main process**, không phải renderer. Renderer bị sandbox.

### Frame-Accurate Cursor Sync
Cursor events dùng `mach_absolute_time()`. Video frames dùng CMSampleBuffer PTS. Phải calibrate offset tại recording start.

### Privacy Manifest (macOS 15+)
Apple yêu cầu `NSPrivacyCollectedDataTypes` trong Info.plist cho app dùng ScreenCaptureKit, microphone, hoặc camera.

### Lossless Intermediate Format
Dùng **VideoToolbox HEVC Lossless** trong capture binary. Hardware-accelerated trên Apple Silicon, file size hợp lý (~2GB/min cho 4K60).

---

## 10. Critical Files (build order priority)

1. [src/shared/ipc-types.ts](src/shared/ipc-types.ts) — IPC contract, mọi module khác phụ thuộc vào đây
2. [src/main/recording/RecordingSession.ts](src/main/recording/RecordingSession.ts) — session state machine
3. [swift/capture/Sources/capture/ScreenCapture.swift](swift/capture/Sources/capture/ScreenCapture.swift) — ScreenCaptureKit binary, rủi ro cao nhất
4. [src/renderer/effects/ZoomPathGenerator.ts](src/renderer/effects/ZoomPathGenerator.ts) — core product differentiator
5. [vite.config.ts](vite.config.ts) — electron-vite config cho 3 Electron processes

---

*Plan được tạo bởi agency-agents Plan Agent — 2026-06-29*
