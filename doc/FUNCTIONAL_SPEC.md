# Functional Specification: Screen Studio Clone (macOS)

**Document Version**: 1.0  
**Last Updated**: 2026-06-29  
**Audience**: Engineering team, QA team, Design team  
**Status**: Approved for Phase 1 Development

This document describes the complete functional behavior of every screen, flow, and interaction in the application. It is the authoritative source of truth for what the product does, not how it is implemented internally.

---

## Table of Contents

1. Application Lifecycle
2. Home Screen
3. Recording Flow
4. Editor Flow
5. Export Flow
6. Project Management Flow
7. Settings
8. Global Behaviors and Edge Cases
9. Error States Reference

---

## 1. Application Lifecycle

### 1.1 Cold Launch

**State sequence**: `launching → permission-check → home`

1. The Electron main process starts.
2. The main window opens at its last position and size (persisted in electron-store), or centered at 1200×800 if first launch.
3. The main process checks whether ScreenCaptureKit permission has been granted by querying the `capture` Swift binary with `--check-permissions`.
4. The binary exits with code 0 (granted) or code 1 (not granted).
5. If not granted: renderer receives `permissions:status` IPC event with `{ screenRecording: false }` and displays the Permission Onboarding screen over the home screen.
6. If granted: renderer receives `permissions:status` with `{ screenRecording: true }` and shows the home screen directly.
7. Auto-update check runs 30 seconds after launch (non-blocking, silent).

### 1.2 Permission Onboarding Screen

**Shown when**: `screenRecording: false` in the permissions status event.

**Elements**:
- App icon
- Heading: "Screen Recording Access Required"
- Body copy explaining what is captured and that recordings are stored locally
- "Open System Settings" button → opens `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`
- "I'll Do This Later" link → dismisses onboarding, user reaches home screen (recording will be unavailable)

**State**: When the user returns from System Settings, the main process re-checks permissions on app focus (`app.on('browser-window-focus')`) and emits a new `permissions:status` event if the status has changed. If now granted, the Permission Onboarding screen closes automatically.

### 1.3 App Re-open from Dock

If the app is already running and the user clicks the Dock icon, the main window comes to front. If the main window is in the middle of recording, the menu bar popover is the primary interface — clicking the Dock icon brings the editor or home screen to front without interrupting recording.

### 1.4 Quit Behavior

- If no recording is active and no unsaved changes: quit immediately.
- If a recording is active: show dialog "Recording in progress. Stop recording and quit?" with "Stop and Quit" / "Cancel" options.
- If unsaved changes exist (editor has changes not yet written to a permanent location): show dialog "You have an unsaved project. Save before closing?" with "Save", "Don't Save", "Cancel".

---

## 2. Home Screen

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Screen Studio]                              [Settings icon]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│              [ New Recording    ▶ ]          [ Open Project   ]      │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│  Recent Projects                                                      │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ [thumbnail]  │  │ [thumbnail]  │  │ [thumbnail]  │               │
│  │ Project Name │  │ Project Name │  │ Project Name │               │
│  │ Jun 28 · 2m  │  │ Jun 27 · 5m  │  │ Jun 25 · 1m  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| `no-recent-projects` | First launch or all recent projects cleared | Recent Projects section shows "No recent projects. Start your first recording." |
| `has-recent-projects` | At least one project in recent list | Grid of project cards shown, max 10 |
| `recording-unavailable` | Screen recording permission denied | New Recording button is greyed out; tooltip: "Screen recording permission required" |
| `update-available` | electron-updater reports new version | Yellow banner at top: "An update is available. [View] [Dismiss]" |

### 2.3 Recent Project Card

Each card shows:
- Thumbnail (120×68px, from `thumbnail.jpg` in the bundle; grey placeholder if missing)
- Project name (filename without extension)
- Date modified (relative: "Today", "Yesterday", "Jun 28") and duration ("2m 34s")

**Interactions**:
- Single click: open project in editor
- Right-click: context menu with "Open", "Show in Finder", "Remove from Recent"

---

## 3. Recording Flow

### 3.1 Flow Overview

```
Home Screen
    │
    ▼ [New Recording]
Display Picker
    │
    ▼ [select display + configure]
Pre-Recording Configuration Panel
    │
    ▼ [Start Recording]
Countdown (3-2-1)
    │
    ▼ [countdown ends]
Active Recording (app minimized; menu bar active)
    │
    ▼ [Stop triggered]
Processing State ("Finalizing recording...")
    │
    ▼ [processing complete]
Editor (new session loaded)
```

### 3.2 Display Picker Screen

**Purpose**: Let the user select the source for capture.

**Elements**:
- Heading: "Select a Display to Record"
- Grid of display cards (one per connected display + one "Window Capture" option on macOS 13+)
- Each display card: live thumbnail (updated 1fps), display name, resolution string (e.g., "2560 × 1600 · Retina")
- "Continue" button (disabled until a display is selected)
- "Cancel" link → returns to home screen

**Display card selected state**: Blue border, checkmark overlay in top-right corner.

**Window Capture card**: Shows a grid icon and the text "Capture a Window". Selecting it expands a second picker below the display grid listing all open application windows with their names and icons.

**Edge cases**:
- Only one display connected: that display is auto-selected; the user is forwarded directly to the Pre-Recording Configuration Panel without needing to click Continue.
- No displays detected (impossible on macOS but guarded): show error "No displays found."

### 3.3 Pre-Recording Configuration Panel

**Purpose**: Configure audio sources and optional features before starting.

**Layout**: A panel that slides in from the right side of the Display Picker screen.

**Sections**:

**Audio**:
- "System Audio" toggle (default: ON)
- "Microphone" toggle (default: OFF) + device dropdown (shown when toggle is ON)
- "No Audio" option — mutually exclusive with the above (selecting it turns off both toggles)

**Cursor Tracking** (greyed out if Accessibility permission missing):
- "Enable cursor tracking" toggle (default: ON when permission granted)
- Info text: "Required for zoom/pan, cursor effects, and keyboard overlay features."

**Webcam** (Phase 3 only):
- "Record Webcam" toggle (default: OFF)
- Camera device dropdown (shown when toggle is ON)

**Countdown**:
- "Start countdown" selector: 0 sec / 3 sec / 5 sec (default: 3 sec)

**Keyboard shortcut reminder**: "Press Cmd+Shift+R to stop recording"

**Buttons**: "Start Recording" (primary), "Back" (returns to Display Picker)

### 3.4 Countdown State

When "Start Recording" is clicked:

1. The Screen Studio main window hides (`mainWindow.hide()`).
2. A transparent, always-on-top overlay window appears on the selected display.
3. The countdown animates: "3" → "2" → "1" → recording begins.
4. If the user presses Escape during countdown, the overlay closes and the main window shows again with the configuration panel.
5. After countdown: the overlay closes, the `capture` binary is spawned, and recording begins.

**Countdown overlay appearance**: Full-screen dark overlay at 30% opacity with a large centered countdown number in white. The countdown number animates with a scale-down effect (100% → 80%) before each transition.

### 3.5 Active Recording State

**What happens in the background (main process)**:
- `CaptureProcess` has spawned `capture` binary and is piping its stdout (status JSON events)
- `CursorProcess` has spawned `cursor-tracker` binary (if permitted) and is accumulating cursor events in memory
- `AudioProcess` has spawned `audio-composer` binary (if audio enabled)
- A `RecordingSession` state machine tracks the session state and writes events to the session manifest

**Menu bar indicator**:
- App menu bar icon changes to a red circle
- Title shows: "● 00:00" — timer increments each second in MM:SS format
- Clicking the icon opens a small popover with: elapsed time, "Stop Recording" button, "Pause" button (Phase 2)

**Keyboard shortcut**: Cmd+Shift+R registered globally via `globalShortcut.register` — triggers stop.

**Floating badge** (optional, configurable in Settings): A small always-on-top Electron window at the bottom-center of the recording display showing elapsed time and a stop button.

### 3.6 Stop Recording

**Trigger**: Keyboard shortcut, menu bar button, or floating badge stop button.

**Sequence**:
1. Main process sends SIGTERM to the `capture` binary.
2. The `capture` binary flushes the VideoToolbox encoder buffer and closes the file.
3. The `cursor-tracker` binary exits and the main process writes the accumulated cursor events to `cursor.json`.
4. The `audio-composer` binary stops and finalizes `audio.m4a`.
5. Main process generates `thumbnail.jpg` from the first non-black frame of `capture.mov` using FFmpeg.
6. Main process writes `manifest.json` with initial defaults.
7. Main process sends `recording:status` IPC event with `{ status: 'done', sessionPath: '...' }`.
8. Main window shows again (`mainWindow.show()`), navigates to the editor view.

**Processing state**: While steps 1–7 are running, the main window shows a full-screen "Finalizing recording..." spinner overlay. This typically takes 1–3 seconds.

### 3.7 Error States During Recording

| Error | Cause | UI Response |
|-------|-------|-------------|
| `capture_permission_denied` | ScreenCaptureKit denied mid-session | Recording stops; dialog: "Screen recording was interrupted. Permission may have been revoked in System Settings." |
| `capture_disk_full` | Insufficient disk space | Recording stops; dialog: "Recording stopped: insufficient disk space. The partial recording has been saved." |
| `capture_binary_crash` | Swift binary segfault or unhandled exception | Recording stops; dialog with error details; attempt to recover partial .mov |
| `audio_device_disconnected` | Microphone/speakers unplugged during recording | Warning banner injected into the session; recording continues without the disconnected audio source |

---

## 4. Editor Flow

### 4.1 Editor Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [← Home]  Project Name ● unsaved indicator           [Export]            │
├────────────────────────┬─────────────────────────────────────────────────┤
│                        │                                                  │
│    LEFT SIDEBAR        │             PREVIEW CANVAS                       │
│    (280px fixed)       │             (fills remaining width)              │
│                        │                                                  │
│  Background            │   ┌──────────────────────────────────────────┐  │
│  Padding               │   │                                          │  │
│  Zoom (Phase 2)        │   │         [Composited preview]             │  │
│  Cursor (Phase 2)      │   │         (Konva.js canvas)                │  │
│  Frame (Phase 2)       │   │                                          │  │
│  Webcam (Phase 3)      │   └──────────────────────────────────────────┘  │
│                        │                                                  │
│                        │   [ ◀◀ ]  [ ▶/⏸ ]  [ ▶▶ ]   00:00 / 01:23    │
│                        │   ────────────────●──────────────────────────   │
│                        │                                                  │
├────────────────────────┴─────────────────────────────────────────────────┤
│  TIMELINE (Phase 3, 120px height)                                        │
│  [in▶]══════════════════════════════[◀out]                               │
│  ~~~~waveform~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    │
│  [Z]  [Z]          [Z]      [Z event markers]                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Preview Canvas

The preview canvas is a Konva.js Stage rendered at the canvas's current DOM size with a scale applied to map the virtual canvas dimensions (source video + padding) to the available display area.

**Render layer order (bottom to top)**:
1. Background layer (solid / gradient / image / blur)
2. Video frame layer (current frame of capture.mov, clipped to rounded rect)
3. Cursor overlay layer (cursor position circle + click ripples)
4. Keyboard shortcut badge layer
5. Device frame SVG layer
6. Webcam overlay layer (Phase 3)

**Frame update loop**: `requestAnimationFrame` → if playing, advance currentTime → decode video frame → update Konva nodes → Konva.draw().

**Canvas dimensions**: The virtual canvas is `(sourceVideoWidth + paddingLeft + paddingRight) × (sourceVideoHeight + paddingTop + paddingBottom)`. The Konva stage is scaled uniformly to fit the available preview area while maintaining aspect ratio.

### 4.3 Sidebar Panels

Each panel is a collapsible accordion section in the left sidebar.

#### Background Panel

**States**: `solid | gradient | image | wallpaper-blur`

**Solid**:
- Color swatch button → opens macOS native color picker (`NSColorPanel`)
- Current color shown as hex value input (editable)

**Gradient**:
- Gradient preview strip showing current gradient
- Color stop list: each stop has a color swatch (opens color picker) and a position input (0–100%)
- "+" button adds a stop at the midpoint of the two adjacent stops; disabled when 5 stops exist
- "×" button removes a stop; disabled when only 2 stops remain
- Angle dial (0–360°) + numeric input

**Image**:
- "Choose Image..." button → native file picker (PNG, JPG, WEBP)
- Built-in wallpapers section: horizontal scroll of 8+ thumbnails
- Fit mode selector: Cover / Contain / Fill

**Wallpaper Blur**:
- "Capture Wallpaper" button (takes a screenshot of the desktop wallpaper at recording time; for existing projects, re-captures the current wallpaper)
- Blur Radius slider (0–40px)
- Preview thumbnail of the blurred result

#### Padding Panel

- Padding slider: 0–200px, step 1
- Numeric input field synchronized with slider
- Corner Radius slider: 0–40px, step 1
- Numeric input field synchronized with slider

#### Zoom Panel (Phase 2)

- "Auto Zoom" toggle (ON/OFF)
- Zoom Level slider: 1.2x–3.0x, default 2.0x (disabled when toggle is OFF)
- Sensitivity selector: Low / Medium / High (radio buttons)
- "Regenerate Zoom Path" button: re-analyzes cursor log and rebuilds zoom events
- Zoom event count indicator: "12 zoom events detected"

#### Cursor Panel (Phase 2)

- "Cursor Highlight" toggle (ON/OFF)
- Highlight Size: Small / Medium / Large (segmented control)
- Highlight Opacity: 0–100% slider
- Highlight Color: color swatch
- "Click Ripple" toggle (ON/OFF)
- Left-click Color: color swatch
- Right-click Color: color swatch
- "Keyboard Shortcut Overlay" toggle (ON/OFF)

#### Frame Panel (Phase 2)

- Frame grid: None (default), MacBook Pro, iMac, Safari, Chrome, iPhone 15 Pro
- Scale slider: 50%–120%
- (Position drag is done directly in the preview canvas)

#### Webcam Panel (Phase 3)

- "Enable Webcam" toggle (ON/OFF; disabled with tooltip if webcam was not recorded)
- Camera source dropdown (populated from `navigator.mediaDevices.enumerateDevices`)
- Shape: Circle / Rounded Rect / Rectangle (segmented control)
- Size: Small (160px) / Medium (240px) / Large (320px)
- "Auto Face Center" toggle (uses face-detector binary)

### 4.4 Playback Controls

Located below the preview canvas.

| Control | Keyboard Shortcut | Behavior |
|---------|------------------|----------|
| Play/Pause | Space | Toggles playback |
| Step back 1 frame | Left Arrow | Decrements currentTime by 1/fps seconds |
| Step forward 1 frame | Right Arrow | Increments currentTime by 1/fps seconds |
| Jump to in-point | Home | Sets currentTime to the trim in-point |
| Jump to out-point | End | Sets currentTime to the trim out-point |
| Scrubber click | — | Sets currentTime to clicked position |
| Scrubber drag | — | Continuously seeks; preview updates live |

**Time display**: `currentTime / totalDuration` in `MM:SS.f` format (tenths of seconds).

### 4.5 Timeline (Phase 3)

The timeline is a custom React component below the playback controls.

**Components**:

**Waveform track**: Rendered as a `<canvas>` element. Audio data is decoded at editor load time using the Web Audio API's `OfflineAudioContext`, resampled to the waveform display width, and drawn as a mirrored amplitude bar chart. Rendered once and cached; not animated.

**Trim handles**:
- Left handle (in-point): a vertical bar with a drag handle triangle at top. Dragging it to the right advances the in-point.
- Right handle (out-point): same, but dragging it to the left moves the out-point back.
- The selected region between handles is highlighted with a lighter overlay; outside the trim region is dimmed.

**Playhead**: A vertical line with a triangle at top showing `currentTime`. Dragging it seeks the video.

**Zoom event track** (shown below the waveform when zoom is enabled):
- Each zoom event is a colored pill marker at the event's start time
- Zoom-in events: blue pills; zoom-out events: grey pills
- Click to select; Delete key removes

**Timescale ruler**: At the top of the timeline, shows time labels (seconds or minutes depending on zoom level).

**Timeline zoom**: Pinch gesture or Ctrl+Scroll zooms the timeline in/out, expanding or compressing the time scale. The timeline scrolls horizontally to accommodate longer recordings.

---

## 5. Export Flow

### 5.1 Export Modal

**Trigger**: "Export" button in the editor header.

**Modal layout** (sheet-style, centered, 480×520px):

```
┌─────────────────────────────────────┐
│  Export Recording                [×]│
├─────────────────────────────────────┤
│  Presets                             │
│  [ Twitter/X ] [ YouTube ] [LinkedIn]│
│  [ Slack/GIF ] [ + Custom ]          │
├─────────────────────────────────────┤
│  Format     [ MP4 ▼ ]                │
│  Resolution [ 1920 × 1080 ]          │
│  Frame Rate [ 60 fps ▼ ]             │
│  Quality    [ High ▼ ]               │
│  Audio      [ AAC 192kbps ▼ ]        │
├─────────────────────────────────────┤
│  Output Path                         │
│  [~/Desktop/recording-2026-06-29.mp4]│
│                           [Browse…]  │
├─────────────────────────────────────┤
│        [Cancel]    [Export  →]       │
└─────────────────────────────────────┘
```

### 5.2 Export Settings

| Field | Options | Default |
|-------|---------|---------|
| Format | MP4, GIF, ProRes 422 HQ (Phase 3) | MP4 |
| Resolution | Source, 4K (3840×2160), 1080p (1920×1080), 720p (1280×720), Custom | Source |
| Frame Rate | Source, 60, 30, 24, 15 | Source |
| Quality (MP4 only) | High (CRF 18), Medium (CRF 23), Web (CRF 28) | High |
| Audio | AAC 192kbps, AAC 128kbps, No Audio | AAC 192kbps |

**GIF-specific settings** (shown when Format = GIF):
| Field | Options | Default |
|-------|---------|---------|
| Width | 400, 600, 800, 1200, Custom | 800 |
| Frame Rate | 8, 12, 15, 24 | 12 |
| Optimization | gifsicle level 1/2/3 | Level 3 |

**Estimated file size**: Shown below the settings as "Estimated size: ~24 MB" — calculated using a bitrate approximation based on format, resolution, and duration. Displayed only for GIF (where size surprises users) and ProRes.

### 5.3 Export Progress State

When "Export" is clicked:

1. Modal transitions to progress view (same modal dimensions).
2. A large circular progress indicator + percentage text in center.
3. Below: "Elapsed: 0:12" and "Remaining: ~0:45"
4. "Cancel" button (small, below progress)

**Progress reporting**: The FFmpeg wrapper in the main process parses FFmpeg's `-progress` output and emits `export:progress` IPC events with `{ percent: number, elapsed: number, eta: number }`. The renderer updates the progress UI on each event.

**Stall detection**: If no `export:progress` event is received for 10 seconds, the renderer shows a warning: "Export seems slow. You may cancel and try again with lower quality settings."

### 5.4 Export Success State

When export completes:

1. Progress circle fills to 100% with a green checkmark animation.
2. Text: "Export complete"
3. Two buttons: "Reveal in Finder" and "Done"
4. "Reveal in Finder" calls `shell.showItemInFolder(outputPath)` and closes the modal.
5. "Done" closes the modal.

### 5.5 Export Failure State

When FFmpeg exits with a non-zero code:

1. Progress view transitions to error state.
2. Red error icon + "Export failed"
3. Accordion "Show Details" expands to reveal the FFmpeg stderr output in a monospace scrollable area.
4. "Retry" button (re-attempts with the same settings) and "Close" button.

### 5.6 Export Pipeline Detail

**MP4 with background + padding + corner radius (FFmpeg filter graph)**:

```
Input: capture.mov (lossless HEVC)
Filter: scale to output resolution → pad with background color → 
        if corner_radius > 0: apply alphamerge with rounded rect alpha mask →
        overlay cursor effects PNG sequence (if cursor effects enabled)
Output: H.264 CRF {quality}, AAC 192kbps, faststart
```

**GIF pipeline**:
1. FFmpeg step 1: `fps={fps},scale={width}:-1:flags=lanczos,palettegen` → `palette.png`
2. FFmpeg step 2: `fps={fps},scale={width}:-1:flags=lanczos,paletteuse` → `output_raw.gif`
3. gifsicle step 3: `--optimize=3 output_raw.gif -o final.gif`
4. Cleanup: delete `palette.png` and `output_raw.gif`

**Zoom export pipeline** (Phase 2):

When zoom effects are enabled, the export pipeline routes through the `zoom-renderer` Swift binary before FFmpeg compositing:
1. `zoom-renderer` reads `capture.mov` and the zoom path JSON
2. Outputs a zoom-applied intermediate `.mov` (Metal compute shader, bicubic sampling)
3. FFmpeg then composites the background, padding, and cursor effects on top of the zoom-rendered intermediate

---

## 6. Project Management Flow

### 6.1 Project Bundle Structure

A `.screenstudio` bundle is a macOS directory package (a folder with a `.screenstudio` extension). Finder shows it as a single file.

```
my-recording.screenstudio/
├── manifest.json          # Project metadata and all effect settings
├── capture.mov            # Raw lossless HEVC recording (required)
├── cursor.json            # Cursor and keyboard event log (optional)
├── audio.m4a              # Separate audio track (optional)
├── webcam.mov             # Webcam recording (optional, Phase 3)
├── thumbnail.jpg          # 240×135 preview thumbnail
└── assets/                # User-provided images referenced in manifest
    └── background.jpg     # (if image background was chosen)
```

### 6.2 Manifest Schema

See `doc/API_SPEC.md` for the full `SessionManifest` type definition. Key fields:

- `version`: manifest schema version (current: "1.0")
- `createdAt`, `updatedAt`: ISO 8601 timestamps
- `sourceDuration`: total recording duration in seconds
- `sourceResolution`: `{ width: number, height: number }`
- `sourceFps`: frames per second of the capture
- `trimIn`, `trimOut`: in/out points in seconds (default: 0 and sourceDuration)
- `canvas`: output canvas settings (background, padding, cornerRadius, aspectRatio)
- `zoom`: zoom effect settings and generated zoom event array
- `cursor`: cursor effect settings
- `webcam`: webcam overlay settings (Phase 3)
- `audio`: audio mix settings

### 6.3 Auto-Save Behavior

- Any change to the manifest triggers a debounced write (500ms debounce, leading + trailing edge).
- The manifest is always written atomically: write to `manifest.json.tmp` → rename to `manifest.json`.
- The "unsaved indicator" (a dot next to the project name in the editor header) reflects whether the current bundle is in a temp location (has never been "Save As"-ed by the user). It does not reflect auto-save status.

### 6.4 Save As Flow

1. User selects File > Save As (Cmd+Shift+S).
2. Native `NSSavePanel` opens, filtered to `.screenstudio` extension.
3. On confirm, the main process copies the entire current bundle directory to the chosen path.
4. The app updates its internal `currentProjectPath` to the new location.
5. The "Save As" path is added to the Recent Projects list.

### 6.5 Open Project Flow

1. User selects File > Open (Cmd+O) or clicks a recent project card.
2. If opened via File > Open: `NSOpenPanel` appears filtered to `.screenstudio` bundles.
3. Main process validates the bundle: checks for `manifest.json` and `capture.mov`.
4. If valid: emits `project:loaded` IPC event with the manifest content.
5. Renderer transitions to the editor view and restores all settings from the manifest.
6. The project is added to the top of the Recent Projects list (pushing oldest off if > 10).

**Validation errors**:
- `manifest.json` missing → "This project bundle appears to be corrupted (manifest.json is missing)."
- `capture.mov` missing → "The recording file (capture.mov) is missing from this project. The project cannot be opened."
- `manifest.version` not supported → "This project was created with a newer version of Screen Studio. Please update the app to open it."

---

## 7. Settings

### 7.1 Settings Screen Layout

Settings is a separate window (`BrowserWindow`) opened from the main window gear icon or via Cmd+, (macOS convention). It is a floating window (not a sheet).

**Sections** (left sidebar navigation):

1. General
2. Recording
3. Shortcuts
4. Export
5. Updates
6. About

### 7.2 General Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Launch at login | Toggle | OFF | Uses `app.setLoginItemSettings` |
| Show floating recording badge | Toggle | ON | Shows the always-on-top timer badge during recording |
| Countdown duration | Selector: 0s / 3s / 5s | 3s | Duration of the pre-recording countdown |
| Default save location | Path picker | ~/Desktop | Where new projects are initially saved (temp location until Save As) |

### 7.3 Recording Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Default frame rate | Selector: 30fps / 60fps | 60fps | FPS passed to the capture binary |
| Default audio: System audio | Toggle | ON | Pre-selects system audio in config panel |
| Default audio: Microphone | Toggle | OFF | Pre-selects microphone in config panel |
| Default microphone device | Dropdown | System default | Remembered across sessions |
| Cursor tracking | Toggle | ON (if permitted) | Whether to spawn cursor-tracker binary |

### 7.4 Shortcuts Settings

| Action | Default Shortcut | Configurable |
|--------|-----------------|-------------|
| Start / Stop Recording | Cmd+Shift+R | Yes |
| Pause Recording | Cmd+Shift+P | Yes (Phase 2) |
| Open Screen Studio | — | Yes (optional global shortcut) |

**Shortcut editor**: Clicking the shortcut field puts it in "listening" mode (shows "Press shortcut..."). The next key combination entered is saved. Conflicts with macOS system shortcuts show a warning but are allowed.

**Reset all shortcuts**: Button at the bottom of the section resets all shortcuts to defaults.

### 7.5 Export Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Remember last export format | Toggle | ON | Restores last-used export settings on next session |
| Default output folder | Path picker | ~/Desktop | Where exported files are saved |
| Open Finder after export | Toggle | ON | Reveals the file in Finder on export success |

### 7.6 Updates Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Check for updates automatically | Toggle | ON | Enables the electron-updater background check |
| Check frequency | Selector: On launch / Daily / Weekly | Daily | How often the update check runs |
| Current version | Display | (app version) | Read-only |
| Check Now | Button | — | Manually triggers an update check |

### 7.7 About

- App icon, name, version
- Build number, Electron version, Node version
- Copyright notice
- "View Licenses" button → opens a new window with bundled dependency license text

---

## 8. Global Behaviors and Edge Cases

### 8.1 Drag and Drop

- A `.screenstudio` bundle can be dragged onto the app Dock icon to open it.
- An image file (PNG, JPG, WEBP) dragged onto the editor preview canvas sets it as the background image (equivalent to Image background type > Choose Image).

### 8.2 Window Sizing

- Minimum window size: 900×600px (prevents the sidebar from becoming unusable)
- The preview canvas fills all available space to the right of the sidebar and above the timeline
- The timeline has a fixed height of 120px (expandable to 200px by dragging the timeline resize handle)

### 8.3 Multi-Window Behavior

- Only one editor window is supported at a time. Opening a second project while one is open prompts: "Opening a new project will close the current one. Continue?"
- The Settings window is modeless and can be open while the editor is in use.

### 8.4 Performance Targets

| Operation | Target | Measured On |
|-----------|--------|-------------|
| Preview frame seek (click scrubber) | < 100ms to display frame | M2 MacBook Pro, 1080p60 |
| Real-time zoom preview during playback | 60fps with no dropped frames | M2 MacBook Pro |
| App cold launch to interactive | < 3 seconds | M2 MacBook Pro |
| Audio waveform computation | < 2 seconds for a 10-minute clip | M2 MacBook Pro |

### 8.5 Accessibility

- All sidebar controls are navigable via Tab key
- All sliders respond to arrow keys
- All toggle switches can be activated with Space
- Color swatches that open pickers are labeled appropriately for VoiceOver
- The preview canvas is marked `role="img"` with a descriptive `aria-label` updated when settings change

---

## 9. Error States Reference

| Error Code | Description | User-Facing Message | Recovery Action |
|------------|-------------|--------------------|--------------| 
| `E001` | Screen recording permission denied | "Screen recording permission is required to use Screen Studio." | "Open System Settings" button |
| `E002` | Microphone permission denied | "Microphone access was denied. Recording will continue without microphone audio." | Banner; continue without mic |
| `E003` | Accessibility permission denied | "Cursor tracking is unavailable without Accessibility permission." | Banner; continue without cursor tracking |
| `E004` | Capture binary not found | "A required component is missing. Please reinstall Screen Studio." | Reinstall prompt |
| `E005` | Capture binary code signature invalid | "Screen Studio cannot verify its recording component. Please reinstall." | Reinstall prompt |
| `E006` | Disk full during recording | "Recording stopped: your disk is full (~X GB available, ~Y GB needed)." | Stop recording; show disk space |
| `E007` | FFmpeg binary not found | "Export failed: the export engine is missing. Please reinstall." | Reinstall prompt |
| `E008` | FFmpeg non-zero exit | "Export failed. [Show Details] to view the error log." | Show FFmpeg stderr; Retry |
| `E009` | Project manifest parse error | "This project file is corrupted and cannot be opened." | Open different project |
| `E010` | Project asset missing | "The file [filename] referenced by this project is missing." | Locate file prompt |
| `E011` | Export cancelled | (No message; modal closes cleanly) | — |
| `E012` | Update download failed | "Failed to download the update. Check your internet connection." | Retry button |
| `E013` | gifsicle binary not found | "GIF optimization failed. The GIF was exported without optimization." | Warning; deliver raw GIF |
