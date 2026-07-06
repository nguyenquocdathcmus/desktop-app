# Product Requirements Document: Screen Studio Clone (macOS)

**Status**: Approved  
**Author**: Business Analyst  
**Last Updated**: 2026-06-29  
**Version**: 1.0  
**Stakeholders**: Engineering Lead, Design Lead, QA Lead, Product Owner

---

## 1. Executive Summary

Screen Studio Clone is a native macOS screen recording and video production application that replicates and extends the core experience of Screen Studio (screen.studio). The product enables developers, designers, and content creators to record their screen and produce polished, professional-quality videos — complete with cinematic zoom/pan, cursor effects, background customization, and one-click social media export — without requiring video editing expertise.

The application is built on an Electron + React/TypeScript shell with Swift native helper binaries handling all performance-critical macOS system interactions (screen capture via ScreenCaptureKit, cursor tracking via CGEventTap, audio mixing via AVFoundation). This architecture delivers native-quality performance with fast UI iteration cycles.

**Target Platform**: macOS 12.3 (Monterey) and later, Apple Silicon and Intel universal binary.

**Primary Business Goal**: Deliver a feature-complete, shippable alternative to Screen Studio across three incremental phases over 16 weeks, with each phase producing a usable, releasable build.

---

## 2. Problem Statement

### 2.1 The Core Problem

Developers and designers regularly need to record and share screen content — product demos, tutorial walkthroughs, bug reproductions, design reviews. The existing tools force a painful choice:

- **Raw screen recorders** (QuickTime, macOS native): Produce flat, unpolished footage with no composition controls. The result looks unprofessional and fails to direct viewer attention.
- **Full video editors** (Final Cut Pro, DaVinci Resolve, Adobe Premiere): Extremely powerful but require deep expertise, take hours to produce a 2-minute clip, and are overkill for the use case.
- **SaaS alternatives** (Loom, Descript): Cloud-dependent, privacy-concerning, limited composition controls, subscription-locked export quality.

### 2.2 What Users Actually Need

Users want to record a workflow or demo and share it within minutes — with it looking like someone who knows what they are doing produced it. They need:

1. A recording tool that captures their exact workflow without disruption
2. Automatic visual polish (zoom, background framing, cursor effects) that requires no manual keyframing
3. One-click export to the format and resolution their target platform expects
4. Full local processing — no cloud upload, no subscription gate on export quality

### 2.3 Cost of Not Solving This

- Developers ship raw QuickTime recordings for product demos that fail to land with prospects
- Designers spend 2–3 hours in video editors for content that should take 15 minutes
- Teams share unpolished Loom links that erode credibility in enterprise sales contexts
- Content creators with technical knowledge but no video editing background cannot produce competitive social content

---

## 3. User Personas

### Persona 1: Dev Dana — Software Developer / Technical Blogger

**Context**: Full-stack developer at a mid-size startup, 5 years experience. Regularly creates screen recordings for: internal team demos, OSS project README GIFs, technical blog posts, and Twitter/X threads.

**Current behavior**: Uses QuickTime for recording, occasionally Gifox for GIFs. Editing is minimal — trim start/end at most. Shares raw footage.

**Pain points**:
- Raw recordings look amateur; cursor is hard to follow
- Terminal text is too small; viewers complain they cannot read it
- GIF quality from QuickTime + conversion tools is poor
- Setting up a "nice background" for demos requires tools she does not have

**Goals**:
- Record a terminal or browser session and share it looking professional in under 5 minutes
- Generate clean GIFs for GitHub READMEs automatically
- Have cursor movements be visually highlighted without post-processing

**Key jobs-to-be-done**:
- Record and export a 60-second product demo
- Create a GIF showing a CLI tool in action
- Share a keyboard-shortcut tip as a short clip

---

### Persona 2: Design Diego — Product Designer

**Context**: Senior product designer at a product agency, works across 4–6 client products simultaneously. Creates design walkthroughs for client reviews, prototype demos for stakeholder sign-off, and Figma workflow shares for his design community.

**Current behavior**: Uses Screen Studio (paid, $89 one-time). Values the zoom feature highly. Occasionally uses Rotato for 3D device mockups.

**Pain points**:
- Wants more control over zoom keyframe timing than Screen Studio's auto algorithm provides
- Needs webcam overlay for talking-head demos during client presentations
- Export presets for LinkedIn vs. Twitter require manual tweaking each time

**Goals**:
- Record Figma walkthroughs with automatic zoom on interaction points
- Show webcam alongside the recording for client-facing demos
- Export different aspect ratios from one recording for different channels

**Key jobs-to-be-done**:
- Capture a Figma prototype flow with smooth automatic zoom on click points
- Overlay his webcam in the corner for a presentation recording
- Export a 16:9 clip for YouTube and a 1:1 clip for LinkedIn from the same session

---

### Persona 3: Creator Carlos — Developer-Turned-Content Creator

**Context**: Self-employed developer who runs a YouTube channel (42k subscribers) teaching software development. Primary income from course sales and sponsorships. Records 3–5 videos per week, each requiring screen capture segments.

**Current behavior**: Records screen with OBS, edits in DaVinci Resolve, adds zoom effects manually in the editor. Process takes 3–4 hours per video.

**Pain points**:
- Manual zoom keyframing in DaVinci is tedious and time-consuming
- Keeping cursor visible and centered during fast demos is a constant challenge
- Background composition requires overlaying a design asset on every clip
- Keyboard shortcut visualization requires a separate OBS plugin

**Goals**:
- Cut post-production time for screen segments from 3 hours to under 30 minutes
- Automatic zoom that follows where he is working without manual keyframing
- Built-in keyboard shortcut display to avoid teaching "what did I just press?"

**Key jobs-to-be-done**:
- Record a 10-minute tutorial segment with automatic zoom and cursor highlight
- Display keyboard shortcuts on-screen without OBS plugin setup
- Export at YouTube 1080p60 with one click

---

## 4. Goals and Non-Goals

### 4.1 Goals

**Phase 1 — MVP (Weeks 1–8)**
- Users can record any connected display at up to 4K/60fps
- Users can apply background, padding, and corner radius in a visual preview editor
- Users can export a polished MP4 from a recorded session
- Users can save and reopen recording projects as `.screenstudio` bundles

**Phase 2 — Effects (Weeks 9–14)**
- Users get automatic zoom/pan that follows cursor activity with cinematic spring physics
- Cursor movements are visually highlighted and click events are animated
- Background options include gradient, image, and frosted glass blur
- Keyboard shortcuts pressed during recording are displayed on-screen
- Device frame overlays (MacBook, browser, iPhone) are available in the editor

**Phase 3 — Polish (Weeks 15–20)**
- Users can trim recordings with a visual timeline including audio waveform
- Webcam overlay with face-tracking positioning is available
- GIF export with palette optimization is supported
- Social media export presets (Twitter/X, YouTube, LinkedIn, Slack/Discord) are one-click
- The app auto-updates silently via GitHub Releases

### 4.2 Non-Goals (Explicit Scope Exclusions)

- **No Windows or Linux support in v1.** The Swift native helper architecture is macOS-only by design. Windows is a post-v1 platform decision requiring full re-architecture of capture binaries.
- **No cloud storage or sync.** Projects are local files only. No user accounts, no cloud backup, no sharing links.
- **No real-time collaboration.** This is a single-user, local-first tool.
- **No audio recording from application-specific audio routing in Phase 1.** System audio and microphone are supported; per-app audio isolation (e.g., only capture Chrome audio) is deferred to a post-v3 iteration.
- **No AI-generated captions or transcription.** Out of scope for all three phases.
- **No multi-display simultaneous capture.** One display per recording session.
- **No iOS/iPadOS screen mirroring capture.** Not supported in this version.
- **No live streaming.** Output is recorded files, not live RTMP/HLS streams.
- **No timeline-based multi-clip editing.** The timeline editor in Phase 3 supports trim (in/out points) of a single clip only. Multi-clip assembly is out of scope.

---

## 5. Feature Requirements

### Phase 1 — MVP: Core Recording + Basic Export

---

#### F-101: Display Selection

**User Story**: As Dana (developer), I want to select which display to record before I start so that I only capture the relevant screen when using a multi-monitor setup.

**Acceptance Criteria**:
- [ ] The app displays a list of all connected displays with name, resolution, and a live thumbnail preview
- [ ] Each display thumbnail refreshes at minimum 1fps while the picker is open
- [ ] The user can select exactly one display per recording session
- [ ] The selected display is visually highlighted with a selection indicator
- [ ] If a display is disconnected after selection but before recording starts, the app shows an error and returns to the picker
- [ ] Window capture mode (select a specific app window instead of full display) is listed as an option when available on macOS 13+
- [ ] The previously selected display is remembered across app launches

**Priority**: P0

---

#### F-102: Screen Recording

**User Story**: As Dana, I want to start and stop a screen recording with a keyboard shortcut so that I can capture a workflow without interrupting my task to find a UI button.

**Acceptance Criteria**:
- [ ] Recording starts within 3 seconds of the user pressing the start control (countdown timer displayed: 3, 2, 1)
- [ ] A floating recording indicator (menu bar item + optional floating badge) is visible during recording
- [ ] Recording captures at the display's native resolution at up to 60fps
- [ ] The keyboard shortcut Cmd+Shift+R starts/stops recording (configurable in settings)
- [ ] Recording stops immediately when the user triggers stop — no data loss on abrupt stop
- [ ] Raw capture is written to a lossless HEVC .mov file in a temp session directory
- [ ] System audio is captured alongside video when the user grants permission
- [ ] Microphone audio is captured when the user enables it in the pre-recording configuration panel
- [ ] The cursor position is tracked and written to cursor.json throughout the recording
- [ ] Recording duration is displayed in the floating indicator (MM:SS format)
- [ ] If ScreenCaptureKit permission has not been granted, the app shows a clear permission request UI with a "Open System Settings" button
- [ ] The app handles the case where the user denies screen recording permission gracefully, showing an explanatory error state

**Priority**: P0

---

#### F-103: Editor Preview

**User Story**: As Diego (designer), I want to see a live preview of my recording with background and padding applied so that I can adjust the composition before exporting.

**Acceptance Criteria**:
- [ ] After recording completes, the editor opens automatically with the new session loaded
- [ ] The preview canvas renders the recorded video inside the configured background at the correct aspect ratio
- [ ] The preview plays back at the correct speed (not faster or slower than the original)
- [ ] Scrubbing the playhead updates the preview frame within 100ms
- [ ] Changes to background, padding, or corner radius settings update the preview in real time (within one frame)
- [ ] The preview canvas maintains the aspect ratio of the source recording regardless of window size
- [ ] The preview canvas is rendered using Konva.js with a requestAnimationFrame render loop
- [ ] A play/pause control and a scrubber are visible below the preview

**Priority**: P0

---

#### F-104: Background Configuration

**User Story**: As Diego, I want to choose a background style (solid color, gradient, or image) for my recording so that it looks professionally framed rather than showing my desktop.

**Acceptance Criteria**:
- [ ] The Background panel offers four background type options: Solid Color, Gradient, Image, and Wallpaper Blur
- [ ] Solid Color: user can pick any color via a native macOS color picker; the preview updates immediately
- [ ] Gradient: user can configure at least 2 stops with individual colors and an angle (0–360 degrees); preview updates immediately
- [ ] Image: user can select an image file from disk (PNG, JPG, WEBP supported); the image is scaled to cover the canvas
- [ ] Wallpaper Blur: captures a screenshot of the current desktop wallpaper and applies a configurable blur radius (0–40px) as the background
- [ ] The selected background type and its parameters are persisted to the project manifest
- [ ] Background configuration is reflected identically in the exported video

**Priority**: P0

---

#### F-105: Padding and Corner Radius

**User Story**: As Diego, I want to control the padding around the recording and the corner radius of the video clip so that the composition feels like a polished product screenshot.

**Acceptance Criteria**:
- [ ] A Padding slider (range: 0–200px, step: 1px) controls the uniform padding on all four sides
- [ ] A Corner Radius slider (range: 0–40px, step: 1px) controls the rounding of the video clip corners
- [ ] Both sliders update the preview canvas in real time
- [ ] The effective output canvas size equals: source video dimensions + (2 × padding)
- [ ] When corner radius > 0, the video clip is masked with a rounded rectangle; the background is visible in the corners
- [ ] Padding and corner radius values are stored in the project manifest

**Priority**: P0

---

#### F-106: MP4 Export

**User Story**: As Dana, I want to export my edited recording as an MP4 file so that I can share it anywhere video is accepted.

**Acceptance Criteria**:
- [ ] An Export button in the editor opens the Export modal
- [ ] The Export modal shows: output format (MP4 selected by default), resolution, quality preset (High / Medium / Web), and output file path
- [ ] Export progress is shown as a percentage progress bar with an estimated time remaining
- [ ] The exported MP4 includes the background composited around the video with the configured padding and corner radius
- [ ] Audio (system + mic if captured) is included in the export at AAC 192kbps
- [ ] Export completes and reveals the file in Finder on success
- [ ] If export fails, a descriptive error message is shown with the FFmpeg stderr output available in a disclosure panel
- [ ] The export can be cancelled mid-progress; partial output files are cleaned up
- [ ] Export runs in the main process via FFmpeg; the UI remains responsive during export

**Priority**: P0

---

#### F-107: Project Save and Open

**User Story**: As Carlos (creator), I want to save my editing session and reopen it later so that I can finish editing a recording across multiple work sessions.

**Acceptance Criteria**:
- [ ] A recording session is saved as a `.screenstudio` bundle directory containing: manifest.json, capture.mov, cursor.json, audio.m4a (optional), and thumbnail.jpg
- [ ] The app auto-saves the manifest (all effect settings) whenever any setting changes, with a debounce of 500ms
- [ ] The user can explicitly Save As... to choose a custom location via a native save panel
- [ ] File > Open opens a native file picker filtered to `.screenstudio` bundles
- [ ] The app shows a "Recent Projects" list (last 10) on the home screen
- [ ] Opening a project from a different location than the temp directory correctly resolves all asset paths relative to the bundle
- [ ] If a project bundle is corrupt or missing required files, the app shows a specific error describing which file is missing

**Priority**: P0

---

### Phase 2 — Effects: Zoom/Pan, Cursor, Backgrounds

---

#### F-201: Automatic Zoom/Pan

**User Story**: As Carlos, I want the recording to automatically zoom in on where I am working so that viewers can read the content without me manually controlling the camera.

**Acceptance Criteria**:
- [ ] The ZoomPathGenerator analyzes the cursor event log post-recording and produces a list of ZoomEvent objects
- [ ] A ZoomEvent is triggered when the cursor pauses for more than 400ms or a click event is detected
- [ ] Zoom level range: 1.0x (no zoom) to 3.0x; default auto zoom level is 2.0x
- [ ] The zoom center is the cursor position at the time of the triggering event, normalized to 0.0–1.0 of the video frame
- [ ] Zoom transitions use critically-damped spring physics (stiffness: 200, damping: 28)
- [ ] The preview canvas renders the zoom/pan effect in real time during playback
- [ ] The user can toggle zoom on/off with a single switch in the Zoom panel
- [ ] The user can adjust the auto-zoom sensitivity (low/medium/high), which changes the pause threshold
- [ ] Individual zoom events can be seen as markers on the timeline track (Phase 3 dependency — zoom event display requires the Phase 3 timeline component but the zoom events themselves must be generated in Phase 2)
- [ ] The export pipeline applies identical zoom/pan via the zoom-renderer Swift binary

**Priority**: P0 (for Phase 2)

---

#### F-202: Cursor Effects

**User Story**: As Dana, I want the cursor to be visually highlighted in the recording so that viewers can easily follow where I am clicking and moving.

**Acceptance Criteria**:
- [ ] A soft circular highlight is rendered around the cursor position at all times during playback (configurable opacity: 0–100%, default 60%)
- [ ] On click events, a ripple animation (scale from 1x to 2x, fade out over 400ms) plays at the cursor position
- [ ] Left-click ripple color is configurable (default: white)
- [ ] Right-click ripple color is configurable (default: secondary color, default: orange)
- [ ] Cursor position is smoothed using a 7-sample moving average to eliminate jitter
- [ ] The cursor effects are composited in the preview in real time
- [ ] The cursor effects are baked into the export via the FFmpeg cursor overlay pipeline
- [ ] The user can enable/disable cursor effects with a toggle in the Cursor panel
- [ ] The cursor highlight size is configurable (small/medium/large)

**Priority**: P0 (for Phase 2)

---

#### F-203: Extended Background Options

**User Story**: As Diego, I want more background options including gradients and frosted glass blur so that my recordings match the aesthetic of modern design presentations.

**Acceptance Criteria**:
- [ ] Gradient backgrounds support: linear gradient with configurable stops, colors, and angle
- [ ] The gradient editor shows at least 2 color stops; additional stops can be added (max 5)
- [ ] Frosted glass / blur background: takes a screenshot of the desktop at recording start, applies a variable Gaussian blur (radius 4–40px)
- [ ] The blur radius slider updates the preview in real time
- [ ] Custom image backgrounds support PNG, JPG, and WEBP; images are copied into the project bundle on selection
- [ ] A curated wallpaper library (minimum 8 high-resolution wallpapers bundled with the app) is available as quick-pick options

**Priority**: P1 (for Phase 2)

---

#### F-204: Keyboard Shortcut Overlay

**User Story**: As Carlos, I want keyboard shortcuts I press during recording to appear on screen as a badge so that viewers can learn the shortcuts without me having to narrate them.

**Acceptance Criteria**:
- [ ] The cursor-tracker binary captures all keyboard events during recording and includes them in the cursor.json event stream
- [ ] Keystroke events are filtered to modifier-key combinations (Cmd, Ctrl, Option, Shift + any key); single keypresses are not shown by default
- [ ] A keyboard badge overlay renders in the bottom-left of the preview canvas (position configurable)
- [ ] The badge displays the human-readable key combination (e.g., "⌘⇧5") for 2 seconds after the keystroke
- [ ] Multiple rapid keystrokes stack vertically with the most recent on top, max 3 visible at once
- [ ] The overlay is toggled on/off in the Cursor panel
- [ ] The overlay is baked into export via FFmpeg drawtext or overlay filter

**Priority**: P1 (for Phase 2)

---

#### F-205: Device Frame Overlays

**User Story**: As Diego, I want to place my recording inside a MacBook or browser frame so that it looks like a real product demo screenshot.

**Acceptance Criteria**:
- [ ] Available frames: MacBook Pro, iMac, Safari browser chrome, Chrome browser chrome, iPhone 15 Pro
- [ ] Frames are SVG-based and scale correctly to any preview canvas size without pixelation
- [ ] Selecting a frame composites it on top of the video in the preview canvas
- [ ] The user can adjust the scale and position of the frame relative to the video
- [ ] No frame is the default; frames are opt-in
- [ ] The selected frame is baked into the export as an FFmpeg overlay filter

**Priority**: P2 (for Phase 2)

---

### Phase 3 — Polish: Timeline, Webcam, Presets

---

#### F-301: Timeline Editor with Trim

**User Story**: As Carlos, I want to trim the start and end of my recording on a visual timeline so that I can remove the setup and cleanup portions without a separate video editor.

**Acceptance Criteria**:
- [ ] The timeline shows the full duration of the recording as a scrollable horizontal track
- [ ] An audio waveform is rendered on the timeline track using the Web Audio API, computed from the captured audio file
- [ ] Drag handles at the left (in-point) and right (out-point) of the clip allow trimming
- [ ] The trim handles snap to the nearest second when within 0.5 seconds of a whole second
- [ ] The playhead can be dragged to any position in the trimmed range
- [ ] A zoom event track displays auto-generated zoom events as colored markers on the timeline
- [ ] Individual zoom event markers can be selected and deleted
- [ ] The export pipeline respects the in/out trim points — no frames outside the trim range are included in the output
- [ ] The in-point and out-point are stored in the project manifest

**Priority**: P0 (for Phase 3)

---

#### F-302: Webcam Overlay

**User Story**: As Diego, I want to show my webcam feed in the corner of the recording so that client demos feel more personal and engaging.

**Acceptance Criteria**:
- [ ] The user can enable webcam overlay from the editor sidebar
- [ ] Camera source is selected from a dropdown listing all available video capture devices
- [ ] The webcam feed is captured via `navigator.mediaDevices.getUserMedia` in the renderer during recording
- [ ] The webcam feed is saved as a separate video file in the project bundle (webcam.mov)
- [ ] Default overlay position: bottom-right corner, 20px margin
- [ ] The user can reposition the webcam overlay by dragging it in the preview canvas
- [ ] The webcam overlay is available in four shape options: circle, rounded rectangle, rectangle
- [ ] The face-detector binary analyzes the webcam feed and can automatically center the crop on the detected face
- [ ] Webcam overlay scale is configurable (small: 160px wide, medium: 240px wide, large: 320px wide)
- [ ] The webcam overlay is composited in the export via FFmpeg overlay filter

**Priority**: P0 (for Phase 3)

---

#### F-303: GIF Export

**User Story**: As Dana, I want to export a high-quality GIF from my recording so that I can embed it in a GitHub README or Notion page without requiring video playback support.

**Acceptance Criteria**:
- [ ] The Export modal offers GIF as a format option
- [ ] GIF export settings: width (default 800px), frame rate (8/12/15/24 fps options), start time, end time
- [ ] Export pipeline: generate palette PNG → apply palette → optimize with gifsicle --optimize=3
- [ ] Output file size estimate is shown before export begins (based on duration × frame rate × resolution)
- [ ] Exported GIF loops infinitely
- [ ] The GIF preserves the background composition and cursor effects
- [ ] Export progress is shown as a percentage

**Priority**: P0 (for Phase 3)

---

#### F-304: Export Presets

**User Story**: As Carlos, I want one-click export presets for Twitter, YouTube, and LinkedIn so that I do not have to remember the correct resolution and codec settings for each platform.

**Acceptance Criteria**:
- [ ] The following presets are available in the Export modal: Twitter/X (1280×720, 30fps, MP4), YouTube (1920×1080, 60fps, MP4), LinkedIn (1280×720, 30fps, MP4), Slack/Discord (800×450, 24fps, GIF)
- [ ] Selecting a preset auto-populates all export settings fields
- [ ] The user can modify any field after selecting a preset; modified presets show a "Custom" indicator
- [ ] A custom preset can be saved with a user-defined name and recalled later
- [ ] The last-used export settings are remembered across sessions

**Priority**: P1 (for Phase 3)

---

#### F-305: Auto-Update

**User Story**: As all users, I want the app to update itself automatically so that I always have the latest features and bug fixes without manually downloading new versions.

**Acceptance Criteria**:
- [ ] The app checks for updates on launch and once every 24 hours using electron-updater pointed at GitHub Releases
- [ ] When an update is available, a non-intrusive notification badge appears in the app (not a modal interruption)
- [ ] The user can click the notification to see the release notes and trigger the download
- [ ] The download progress is shown as a progress bar
- [ ] After download completes, the user is prompted to restart to apply the update; they can defer to "Restart Later"
- [ ] The app restarts and applies the update without requiring admin privileges
- [ ] Auto-update can be disabled in Settings

**Priority**: P1 (for Phase 3)

---

## 6. Out of Scope

The following are permanently out of scope for all three phases of this project:

| Item | Reason |
|------|--------|
| Windows / Linux support | Requires full re-architecture of Swift native helpers; separate roadmap item |
| Cloud sync / user accounts | Local-first by design; adds significant backend infrastructure cost and privacy complexity |
| Real-time collaboration / shared projects | Multi-user state is an entirely different product surface |
| Live streaming (RTMP/HLS) | Different architecture from recorded output; separate use case |
| AI transcription / captions | Significant model size and inference cost; separate feature initiative |
| Multi-clip timeline assembly | The timeline is for trim only; multi-clip NLE is a separate product |
| Per-app audio isolation | AVFoundation scoped audio capture requires additional entitlements and architecture work |
| iOS/iPadOS screen mirroring capture | Requires separate device pairing protocol |
| Multi-display simultaneous capture | ScreenCaptureKit supports it but UX complexity is high; single display covers 95% of use cases |
| 3D device mockups (Rotato-style) | 3D rendering pipeline is a significant additional dependency |

---

## 7. Success Metrics

### 7.1 Technical Quality Metrics (Measurable at QA)

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Recording start latency | < 3 seconds from button press to first frame captured | Automated timing test |
| Preview frame update on scrub | < 100ms | Performance profiling in renderer |
| Export speed | Real-time or faster for 1080p (i.e., 1-minute recording exports in ≤ 60 seconds) | Benchmark on M2 MacBook Pro |
| Crash rate during recording | < 0.1% of recording sessions | Crash reporter |
| Export success rate | > 99% of export attempts complete without error | Export event log |
| App cold launch time | < 3 seconds to interactive state | Startup benchmark |
| Memory usage during recording | < 250MB RSS in main process | Memory profiler |

### 7.2 Product Outcome Metrics (Measurable Post-Launch)

| Metric | Phase 1 Target | Phase 3 Target | Measurement Window |
|--------|---------------|---------------|-------------------|
| Recording completion rate (start → stop without crash) | > 98% | > 99.5% | 30 days post-launch |
| Export completion rate (start → file written successfully) | > 97% | > 99% | 30 days post-launch |
| Median time from recording stop to export complete (1080p, 60s clip) | < 90 seconds | < 60 seconds | 60 days post-phase |
| Feature adoption: Zoom/Pan enabled in exports | N/A (Phase 2) | > 60% of exports | 30 days post-Phase 2 |
| Feature adoption: GIF export used | N/A (Phase 3) | > 25% of users/month | 30 days post-Phase 3 |
| Project save/reopen success rate | > 99% | > 99% | Ongoing |

### 7.3 Phase Gate Criteria

Each phase is considered complete and releasable when:

- All P0 acceptance criteria for that phase pass QA
- Export success rate > 97% on a test suite of 20 varied recordings (duration 30s–10min, resolutions 1080p–4K)
- Zero P0 bugs open
- P1 bugs: < 3 open with workarounds documented
- App passes macOS notarization with no entitlement errors
- Auto-update pipeline is tested end-to-end (Phase 3 only)
