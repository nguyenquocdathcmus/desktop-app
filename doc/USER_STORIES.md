# User Stories: Screen Studio Clone (macOS)

**Document Version**: 1.0  
**Last Updated**: 2026-06-29  
**Total Stories**: 30  
**Personas**: Dana (Developer), Diego (Designer), Carlos (Creator)

Story IDs are stable — do not renumber when inserting new stories. Append new stories at the end with the next sequential ID.

---

## US-001: Select Display for Recording

**As a** Dana (developer with multiple monitors)  
**I want to** choose which display to capture before starting a recording  
**So that** I only record the relevant screen and not my email or chat windows on other monitors

### Acceptance Criteria
- [ ] Given the app is on the home/ready screen, When I click "New Recording", Then a Display Picker screen appears showing all connected displays
- [ ] Given the Display Picker is open, When multiple displays are connected, Then each display is shown with its name (e.g., "Built-in Retina Display"), resolution (e.g., "2560×1600"), and a live thumbnail updated at 1fps or faster
- [ ] Given the Display Picker is open, When I click a display thumbnail, Then it becomes selected with a visible highlight border and a checkmark
- [ ] Given I have selected a display, When I disconnect that display before pressing Start, Then the app shows an error "Selected display disconnected" and returns me to the picker
- [ ] Given the app launches for the second time, When the Display Picker opens, Then the previously selected display is pre-selected by default
- [ ] Given macOS 13+ is running, When I open the Display Picker, Then a "Window Capture" option is available in addition to full displays
- [ ] Given I select Window Capture, When I click it, Then I see a list of open application windows to choose from

### Priority: P0
### Phase: 1
### Sprint: 1
### Estimate: M

---

## US-002: Grant Screen Recording Permission

**As a** Dana  
**I want to** be clearly guided through granting screen recording permission the first time  
**So that** I understand why the app needs it and can successfully grant access without Googling

### Acceptance Criteria
- [ ] Given it is the first app launch and screen recording permission has not been granted, When the Display Picker opens, Then the app immediately shows a permission prompt screen before showing the picker
- [ ] Given the permission prompt is shown, When I look at it, Then it explains in plain language what will be captured and why ("Screen Studio needs permission to record your screen. Your recordings are stored locally and never uploaded.")
- [ ] Given the permission prompt is shown, When I click "Open System Settings", Then macOS System Settings opens directly to the Screen Recording privacy section
- [ ] Given the permission prompt is shown, When I click "Not Now", Then I am returned to the home screen with a banner explaining that recording is unavailable until permission is granted
- [ ] Given I have granted permission in System Settings, When I return to the app and click "New Recording", Then the Display Picker opens without showing the permission prompt again
- [ ] Given I have previously denied permission, When I click "New Recording", Then the app shows a non-blocking banner with a button to open System Settings, rather than blocking the entire UI

### Priority: P0
### Phase: 1
### Sprint: 1
### Estimate: S

---

## US-003: Start a Screen Recording with Countdown

**As a** Dana  
**I want to** see a 3-second countdown before recording begins  
**So that** I have time to switch focus to the window I am demonstrating before the first frame is captured

### Acceptance Criteria
- [ ] Given a display has been selected, When I click "Start Recording", Then a full-screen overlay on the selected display shows a countdown: 3 → 2 → 1 → (recording begins)
- [ ] Given the countdown is running, When I press Escape, Then the countdown is cancelled and no recording is started
- [ ] Given the countdown reaches 0, When recording begins, Then the overlay disappears and a recording indicator appears in the macOS menu bar
- [ ] Given recording is active, When I look at the menu bar, Then a red dot icon with a running timer (MM:SS) is visible
- [ ] Given recording is active, When I press the configured keyboard shortcut (default: Cmd+Shift+R), Then recording stops immediately
- [ ] Given recording is active, When I click the menu bar icon, Then a small popover shows the duration and a "Stop Recording" button

### Priority: P0
### Phase: 1
### Sprint: 2
### Estimate: M

---

## US-004: Configure Audio Sources Before Recording

**As a** Carlos (content creator)  
**I want to** choose whether to capture system audio, microphone, or both before I start recording  
**So that** I have the right audio mix for my tutorial without re-recording

### Acceptance Criteria
- [ ] Given the pre-recording configuration panel is open, When I look at the Audio section, Then I see three toggles: "System Audio", "Microphone", and "No Audio"
- [ ] Given the Microphone toggle is enabled, When I click the microphone icon, Then a dropdown shows available microphone devices
- [ ] Given no microphone permission has been granted, When I enable the Microphone toggle, Then the app requests microphone permission before proceeding
- [ ] Given I select "No Audio", When the recording is complete, Then the exported file has no audio track
- [ ] Given System Audio is enabled, When the recording is complete, Then the captured audio.m4a contains system audio at the volume level active during recording
- [ ] Given both System Audio and Microphone are enabled, When the recording is complete, Then the audio-composer binary has mixed both sources and the audio.m4a contains the mixed output
- [ ] Given the configuration panel is closed and recording starts, When I look at the session manifest, Then the audio configuration is stored correctly

### Priority: P0
### Phase: 1
### Sprint: 2
### Estimate: M

---

## US-005: Stop Recording and Enter the Editor

**As a** Dana  
**I want to** have my recording automatically open in the editor when I stop  
**So that** I can immediately see the result and start adjusting the composition

### Acceptance Criteria
- [ ] Given recording is active, When I stop the recording via keyboard shortcut or menu bar button, Then recording stops within 500ms and the Swift capture binary exits cleanly
- [ ] Given recording has stopped, When the capture binary finishes writing the .mov file, Then the main process triggers a transition to the editor view
- [ ] Given the editor view opens, When I see it for the first time after a recording, Then the video is already loaded and positioned at frame 0 with the default settings applied (default background, default padding)
- [ ] Given the editor view has opened, When I look at the timeline scrubber, Then the total duration matches the recorded duration
- [ ] Given recording stops and file is being finalized, When there is a processing delay > 1 second, Then a loading spinner with "Processing recording..." is shown rather than a blank screen
- [ ] Given the capture binary crashes during recording, When the user stops recording, Then the main process detects the crash, attempts to recover any partial .mov written, and shows an error describing what was recovered

### Priority: P0
### Phase: 1
### Sprint: 3
### Estimate: M

---

## US-006: Adjust Background Style

**As a** Diego (designer)  
**I want to** set a background color, gradient, or image behind my recording  
**So that** the video looks polished and branded rather than showing my raw desktop

### Acceptance Criteria
- [ ] Given the editor is open, When I open the Background panel in the sidebar, Then I see four background type buttons: Solid, Gradient, Image, Wallpaper Blur
- [ ] Given I select Solid, When I click the color swatch, Then the macOS native color picker opens and my selection updates the preview in real time
- [ ] Given I select Gradient, When I configure two color stops and an angle, Then the preview shows a smooth linear gradient at that angle
- [ ] Given I select Gradient, When I click "+ Add Stop", Then a third color stop is added at the midpoint; max 5 stops total
- [ ] Given I select Image, When I click "Choose Image", Then a native file picker opens filtered to PNG, JPG, WEBP; after selection the image fills the canvas background
- [ ] Given I select Wallpaper Blur, When the panel activates, Then the app captures a screenshot of the active desktop wallpaper and applies it as background with the configured blur radius
- [ ] Given I adjust the Blur Radius slider (0–40px), When I drag it, Then the blur intensity updates in the preview within one frame
- [ ] Given I have set a background, When I close and reopen the project, Then the same background configuration is restored

### Priority: P0
### Phase: 1
### Sprint: 4
### Estimate: M

---

## US-007: Control Padding and Corner Radius

**As a** Diego  
**I want to** set the padding around the recording and rounded corners on the video clip  
**So that** the composition matches the style of modern product screenshots and design presentations

### Acceptance Criteria
- [ ] Given the editor is open, When I open the Padding panel, Then I see a Padding slider (range 0–200px) and a Corner Radius slider (range 0–40px)
- [ ] Given I drag the Padding slider to 40px, When I look at the preview, Then there are 40px of background visible on all four sides of the video
- [ ] Given I drag the Corner Radius slider to 12px, When I look at the preview, Then the video clip corners are visibly rounded with a 12px radius
- [ ] Given both Padding (0px) and Corner Radius (0px) are at minimum, When I look at the preview, Then the video fills the entire canvas edge-to-edge with square corners
- [ ] Given I set a non-zero padding, When I look at the output canvas dimensions, Then the total export canvas size equals: video_width + (2 × padding) × video_height + (2 × padding)
- [ ] Given I set a corner radius > 0, When I export the video, Then the exported MP4 shows the same rounded corners as the preview
- [ ] Given I change padding or corner radius, When the value changes, Then the preview updates within one render frame (< 16ms)

### Priority: P0
### Phase: 1
### Sprint: 4
### Estimate: S

---

## US-008: Play Back the Recording in the Editor

**As a** Dana  
**I want to** play back my recording in the editor preview  
**So that** I can review the content and timing before exporting

### Acceptance Criteria
- [ ] Given the editor is open, When I press the Space bar or click the Play button, Then playback begins from the current playhead position
- [ ] Given playback is running, When I press Space bar again, Then playback pauses at the current frame
- [ ] Given playback is running, When the playhead reaches the out-point (or end of clip if no trim is set), Then playback stops and the playhead returns to the in-point
- [ ] Given I click anywhere on the scrubber track, When the click position is within the clip duration, Then the playhead jumps to that position and the preview updates within 100ms
- [ ] Given playback is running, When I observe the frame rate, Then it plays at the correct speed (1x) without visible stuttering at 1080p on an M1 or later chip
- [ ] Given the editor is open, When I press the Left Arrow key, Then the playhead steps back exactly 1 frame; Right Arrow steps forward 1 frame

### Priority: P0
### Phase: 1
### Sprint: 4
### Estimate: M

---

## US-009: Export as MP4

**As a** Dana  
**I want to** export my edited recording as an MP4 file  
**So that** I can upload it to Twitter, Notion, or share it via Slack

### Acceptance Criteria
- [ ] Given the editor is open, When I click "Export", Then the Export modal opens
- [ ] Given the Export modal is open, When I look at the default settings, Then: Format = MP4, Resolution = same as source, Quality = High, Audio = same as captured
- [ ] Given I click the output path field, When the file picker opens, Then it defaults to the Desktop with a filename derived from the project name and current date
- [ ] Given I click "Export" in the modal, When the export starts, Then the modal transitions to a progress view showing percentage (0–100%) and elapsed time
- [ ] Given export is at 100%, When the process completes, Then a "Reveal in Finder" button appears and the exported file is at the specified path
- [ ] Given I click "Cancel" during export, When the cancellation completes, Then any partial output file is deleted and the modal closes
- [ ] Given the exported MP4, When I open it in QuickTime Player, Then: video plays at correct speed, audio is in sync, background and padding are visible, corner radius is applied
- [ ] Given export fails due to a codec error, When the failure occurs, Then the error message shows the FFmpeg error text in a scrollable disclosure panel

### Priority: P0
### Phase: 1
### Sprint: 5
### Estimate: L

---

## US-010: Save and Reopen a Project

**As a** Carlos  
**I want to** save my project and reopen it the next day to continue editing  
**So that** I do not have to re-record if I run out of time to finish the export in one session

### Acceptance Criteria
- [ ] Given I am in the editor, When any setting changes, Then the project manifest is auto-saved within 500ms (debounced)
- [ ] Given a new recording is completed, When the editor opens, Then the project is automatically stored in a temp location as a `.screenstudio` bundle
- [ ] Given I choose File > Save As, When the native save panel appears, Then it is pre-populated with the project name and `.screenstudio` extension
- [ ] Given I save to a custom location, When I close and reopen the app, Then the project appears in the Recent Projects list on the home screen
- [ ] Given I click a recent project, When the project loads, Then all settings (background, padding, corner radius, audio config) are restored exactly as saved
- [ ] Given a `.screenstudio` bundle has a missing capture.mov, When I try to open it, Then the app shows "capture.mov is missing from this project bundle. The project cannot be opened."
- [ ] Given I open the project from a different machine or after moving the bundle, When the editor opens, Then all assets are resolved relative to the bundle path (no hardcoded absolute paths in the manifest)

### Priority: P0
### Phase: 1
### Sprint: 5
### Estimate: M

---

## US-011: Preview Zoom/Pan Effects During Playback

**As a** Carlos  
**I want to** see the automatic zoom/pan effect in the editor preview as the recording plays  
**So that** I can verify the zoom behavior looks correct before exporting a 10-minute tutorial

### Acceptance Criteria
- [ ] Given the editor is in Phase 2 with a completed recording, When I enable the Zoom toggle in the Zoom panel, Then playback shows the zoom/pan effect following the cursor log
- [ ] Given zoom is enabled and I press Play, When the playhead reaches a zoom event trigger point, Then the preview smoothly zooms in using spring physics within the defined transition
- [ ] Given a zoom event is active, When the cursor moves to a new region of interest, Then the view pans smoothly to the new center using the same spring physics
- [ ] Given zoom is enabled, When I toggle it off, Then the preview immediately shows the full unzoomed frame
- [ ] Given zoom is enabled with default settings, When the recording plays and the cursor is stationary for > 400ms, Then a zoom-in event is triggered at that cursor position
- [ ] Given I adjust the Zoom Sensitivity slider to "High", When the recording plays, Then zoom events are triggered more frequently (pause threshold is reduced to ~200ms)
- [ ] Given I adjust Zoom Sensitivity to "Low", When the recording plays, Then zoom events trigger only on explicit click events

### Priority: P0
### Phase: 2
### Sprint: 6
### Estimate: XL

---

## US-012: View Cursor Highlight and Click Animations

**As a** Diego  
**I want to** see cursor highlights and click ripple animations in my recording  
**So that** viewers of my design walkthroughs can follow exactly where I am clicking

### Acceptance Criteria
- [ ] Given the Cursor panel is open and cursor effects are enabled, When I play back the recording, Then a soft circular highlight follows the cursor at all times
- [ ] Given cursor effects are enabled, When a left-click event is at the current playhead position, Then a circular ripple animation plays (scale 1x → 2x, opacity 100% → 0%, duration 400ms)
- [ ] Given cursor effects are enabled, When a right-click event occurs, Then a ripple with a different configured color plays
- [ ] Given I open the Cursor panel, When I adjust the Highlight Size slider, Then the highlight circle size changes in the preview immediately
- [ ] Given I open the Cursor panel, When I adjust the Highlight Opacity slider (0–100%), Then the opacity of the soft circle changes in the preview
- [ ] Given cursor effects are enabled, When I toggle them off, Then no cursor circle or ripple effects are visible in the preview
- [ ] Given the cursor event log has gaps (cursor was outside the captured display), When the recording plays through those gaps, Then the highlight disappears gracefully rather than jumping

### Priority: P0
### Phase: 2
### Sprint: 7
### Estimate: M

---

## US-013: Display Keyboard Shortcuts During Playback

**As a** Carlos  
**I want to** see keyboard shortcuts I pressed during recording displayed as a badge overlay  
**So that** my tutorial viewers can learn shortcuts without me having to verbally narrate every keystroke

### Acceptance Criteria
- [ ] Given the Keyboard Shortcut Overlay is enabled in the Cursor panel, When I play back the recording and reach a keystroke event, Then a badge appears showing the key combination (e.g., "⌘⇧5")
- [ ] Given a keystroke badge is displayed, When 2 seconds have passed, Then the badge fades out
- [ ] Given multiple keystrokes occur within 2 seconds, When they occur, Then up to 3 badges are stacked vertically with the most recent on top
- [ ] Given the keystroke badge position, When I look at the preview, Then it is in the bottom-left corner by default
- [ ] Given the cursor-tracker binary is running, When I press Cmd+C during recording, Then it is captured in cursor.json as a keystroke event with the correct timestamp
- [ ] Given cursor-tracker lacks Accessibility permission, When recording starts, Then the app shows a warning that keyboard overlay will not be available and prompts for Accessibility permission
- [ ] Given I disable Keyboard Shortcut Overlay in settings, When I play back or export, Then no keystroke badges are visible

### Priority: P1
### Phase: 2
### Sprint: 7
### Estimate: M

---

## US-014: Apply a Device Frame Overlay

**As a** Diego  
**I want to** place my recording inside a MacBook or browser frame  
**So that** my design portfolio demos look like real-world product screenshots

### Acceptance Criteria
- [ ] Given the editor sidebar, When I open the Frame section, Then I see a grid of available frames: MacBook Pro, iMac, Safari, Chrome, iPhone 15 Pro, and "None"
- [ ] Given I click a frame thumbnail, When the selection is applied, Then the preview canvas updates to show the recording composited inside the frame
- [ ] Given a frame is selected, When I view the preview at different zoom levels, Then the frame scales proportionally without pixelation (SVG-based rendering)
- [ ] Given a frame is selected, When I adjust the Frame Scale slider (50%–120%), Then the frame and its video content scale together
- [ ] Given a frame is selected, When I play back the recording, Then the frame remains static while the video plays inside it
- [ ] Given I select "None", When the preview updates, Then the raw video with background/padding is shown without any frame overlay
- [ ] Given a frame is selected, When I export, Then the exported video contains the frame composited correctly at the same dimensions as the preview

### Priority: P2
### Phase: 2
### Sprint: 8
### Estimate: M

---

## US-015: Trim the Recording on the Timeline

**As a** Carlos  
**I want to** trim the beginning and end of my recording on a visual timeline  
**So that** I can remove the awkward 5-second setup at the start without opening a separate video editor

### Acceptance Criteria
- [ ] Given the Phase 3 editor, When I look below the preview canvas, Then a timeline component is visible showing the full clip duration
- [ ] Given the timeline is visible, When I look at it, Then an audio waveform is rendered as a visual representation of the captured audio
- [ ] Given the timeline is visible, When I drag the left trim handle to the right, Then the in-point advances and the playhead jumps to the new in-point
- [ ] Given the timeline is visible, When I drag the right trim handle to the left, Then the out-point moves earlier and playback stops at the new out-point
- [ ] Given I drag a trim handle within 0.5 seconds of a whole-second mark, When I release the handle, Then it snaps to that whole second
- [ ] Given trim handles are set, When I play back, Then playback begins at the in-point and stops at the out-point
- [ ] Given trim handles are set, When I export, Then the exported file contains only the content between in-point and out-point
- [ ] Given the in-point and out-point are set to the same time, When I try to drag them to overlap, Then the handles are constrained to maintain a minimum clip duration of 1 second

### Priority: P0
### Phase: 3
### Sprint: 9
### Estimate: XL

---

## US-016: Enable Webcam Overlay

**As a** Diego  
**I want to** show my webcam in the corner of the recording  
**So that** client presentation videos feel more personal and engaging

### Acceptance Criteria
- [ ] Given the editor sidebar in Phase 3, When I open the Webcam section, Then I see a "Enable Webcam Overlay" toggle and a camera source dropdown
- [ ] Given webcam is enabled, When the dropdown opens, Then all connected cameras are listed by name (e.g., "FaceTime HD Camera", "Continuity Camera")
- [ ] Given a camera is selected, When I look at the preview, Then the webcam feed is composited in the bottom-right corner at default size (240px wide)
- [ ] Given the webcam overlay is visible in the preview, When I drag it to a different corner, Then it repositions and the new position is saved in the manifest
- [ ] Given the webcam overlay is enabled, When I click the Shape button, Then I can select Circle, Rounded Rectangle, or Rectangle as the webcam clip shape
- [ ] Given the webcam overlay is enabled, When I toggle "Auto Face Centering", Then the face-detector binary is used to center the crop on the detected face within the webcam feed
- [ ] Given I recorded without webcam enabled, When I enable webcam in the editor, Then the app shows "Webcam was not recorded for this session. Re-record to include webcam." and the toggle is disabled
- [ ] Given webcam was captured during recording, When I export, Then the webcam overlay is composited in the output video using FFmpeg overlay filter

### Priority: P0
### Phase: 3
### Sprint: 10
### Estimate: L

---

## US-017: Export as GIF

**As a** Dana  
**I want to** export a short clip as a high-quality GIF  
**So that** I can embed it in my GitHub README without requiring video support

### Acceptance Criteria
- [ ] Given the Export modal, When I change Format to "GIF", Then the export settings panel updates to show GIF-specific options: Width, Frame Rate (8/12/15/24 fps), Loop (always on)
- [ ] Given GIF export settings are configured, When I look at the modal, Then an estimated file size is shown based on duration × frame rate × width
- [ ] Given I click Export for GIF, When the pipeline runs, Then three steps occur: palette generation, palette application, gifsicle optimization (--optimize=3)
- [ ] Given GIF export completes, When I open the output file, Then the GIF plays at the configured frame rate and loops infinitely
- [ ] Given GIF export completes, When I check the file size, Then it is equal to or smaller than the unoptimized intermediate GIF (optimization is always applied)
- [ ] Given the recording has audio, When I export as GIF, Then the GIF has no audio (GIF format does not support audio; no error is shown)
- [ ] Given the trim handles are set, When I export as GIF, Then the GIF contains only the trimmed portion

### Priority: P0
### Phase: 3
### Sprint: 11
### Estimate: M

---

## US-018: Use Export Presets for Social Media

**As a** Carlos  
**I want to** select a Twitter or YouTube preset in the export modal  
**So that** I do not have to remember the correct resolution, codec, and frame rate for each platform every time

### Acceptance Criteria
- [ ] Given the Export modal, When I click the Presets section, Then I see the following presets: Twitter/X, YouTube, LinkedIn, Slack/Discord (GIF)
- [ ] Given I click "Twitter/X", When the preset applies, Then Format = MP4, Width = 1280, Height = 720, FPS = 30, Quality = High are populated automatically
- [ ] Given I click "YouTube", When the preset applies, Then Format = MP4, Width = 1920, Height = 1080, FPS = 60, Quality = High are populated
- [ ] Given I click "Slack/Discord", When the preset applies, Then Format = GIF, Width = 800, FPS = 24 are populated
- [ ] Given I select a preset and then modify any field, When I look at the preset indicator, Then it changes to "Custom" to indicate I have diverged from the preset
- [ ] Given I have configured custom settings, When I click "Save as Preset" and enter a name, Then a new preset appears in the list for future sessions
- [ ] Given I open the Export modal on a new session, When I look at the preset selected, Then it is the same preset I used for the last export

### Priority: P1
### Phase: 3
### Sprint: 11
### Estimate: S

---

## US-019: Receive App Updates Automatically

**As a** Dana  
**I want to** receive updates to the app automatically in the background  
**So that** I always have the latest features and bug fixes without manually checking the website

### Acceptance Criteria
- [ ] Given the app launches, When it connects to GitHub Releases, Then it checks for a newer version within 30 seconds of launch
- [ ] Given a new version is available, When the check completes, Then a non-modal notification badge or banner appears indicating an update is available
- [ ] Given the update banner is visible, When I click "View Release Notes", Then a panel shows the changelog for the new version
- [ ] Given I click "Download Update", When the download starts, Then a progress bar shows the download progress in percentage
- [ ] Given the download completes, When I look at the update prompt, Then it says "Restart to apply update" with "Restart Now" and "Later" options
- [ ] Given I click "Later", When I use the app normally, Then the update is applied on the next launch without prompting again
- [ ] Given I disable auto-update in Settings, When the app launches, Then no update check is performed and no update notification appears

### Priority: P1
### Phase: 3
### Sprint: 12
### Estimate: M

---

## US-020: Configure Keyboard Shortcuts

**As a** Dana  
**I want to** customize the keyboard shortcut for starting and stopping a recording  
**So that** it does not conflict with shortcuts in my development tools

### Acceptance Criteria
- [ ] Given the Settings screen, When I open the Shortcuts section, Then I see a list of configurable shortcuts: Start/Stop Recording, Pause Recording, Open App
- [ ] Given I click the shortcut field for Start/Stop Recording, When the field is focused, Then it shows "Press a shortcut..." and listens for my key combination
- [ ] Given I press a key combination (e.g., Cmd+Shift+9), When the combination is detected, Then it appears in the field and is saved
- [ ] Given I set a shortcut that conflicts with a macOS system shortcut, When I save it, Then the app shows a warning "This shortcut may conflict with a system shortcut" but still allows saving
- [ ] Given I click "Reset to Default", When the action completes, Then the shortcut reverts to Cmd+Shift+R
- [ ] Given I have set a custom shortcut, When I use that shortcut while the app is in the background, Then the recording starts or stops correctly via the global event listener

### Priority: P1
### Phase: 1
### Sprint: 6
### Estimate: S

---

## US-021: Adjust Zoom Level for Auto Zoom Events

**As a** Carlos  
**I want to** control how far in the auto zoom effect zooms  
**So that** I can have a subtle zoom for coding demos and a stronger zoom for UI demos

### Acceptance Criteria
- [ ] Given the Zoom panel is open, When I look at the Zoom Level slider, Then it ranges from 1.2x to 3.0x with a default of 2.0x
- [ ] Given I change the zoom level to 1.5x, When I play back the recording, Then zoom events zoom to 1.5x rather than 2.0x
- [ ] Given I change the zoom level, When the change is applied, Then all existing auto-generated zoom events are recalculated with the new level
- [ ] Given I set zoom level to 1.0x, When playback runs, Then the Zoom panel disables the level slider (1.0x is "no zoom" — toggle should be off instead)
- [ ] Given the zoom level is set, When I export, Then the exported video uses the same zoom level as configured in the editor

### Priority: P1
### Phase: 2
### Sprint: 6
### Estimate: S

---

## US-022: View Recent Projects on Home Screen

**As a** Carlos  
**I want to** see my recent projects when I open the app  
**So that** I can quickly get back to work on a recording without navigating to the file in Finder

### Acceptance Criteria
- [ ] Given the app is on the home screen, When I look at the Recent Projects section, Then I see the last 10 opened or saved projects
- [ ] Given the recent projects list, When I look at each item, Then I see: project thumbnail (thumbnail.jpg from bundle), project name, last modified date, and recording duration
- [ ] Given I click a recent project, When the project loads, Then the editor opens with all settings restored
- [ ] Given a recent project's bundle has been moved or deleted, When I click it, Then the app shows "Project file not found at [path]" with an option to locate the file manually
- [ ] Given I right-click a recent project, When the context menu appears, Then I see options: Open, Show in Finder, Remove from Recent
- [ ] Given the recent projects list has 10 items and a new project is created, When the new project is added, Then the oldest item is removed from the list

### Priority: P1
### Phase: 1
### Sprint: 5
### Estimate: S

---

## US-023: Manage Recording with Menu Bar Controls

**As a** Dana  
**I want to** control my recording from the macOS menu bar  
**So that** I can stop recording without switching away from the app I am demonstrating

### Acceptance Criteria
- [ ] Given the app is recording, When I look at the macOS menu bar, Then the Screen Studio icon shows a red recording indicator and a timer (MM:SS format)
- [ ] Given I click the menu bar icon during recording, When the popover opens, Then I see: recording duration, a "Stop" button, and a "Pause" button (if supported)
- [ ] Given I click "Stop" in the menu bar popover, When the click registers, Then recording stops and the app comes to the foreground with the editor
- [ ] Given the app is recording and the Electron window is minimized, When I use the menu bar stop button, Then recording still stops correctly
- [ ] Given recording is not active, When I click the menu bar icon, Then the popover shows "No active recording" and a "New Recording" button

### Priority: P1
### Phase: 1
### Sprint: 3
### Estimate: M

---

## US-024: See Export Progress with Time Estimate

**As a** Carlos  
**I want to** see how long an export will take while it is in progress  
**So that** I can decide whether to wait for it or come back later

### Acceptance Criteria
- [ ] Given export has started, When I look at the progress view, Then I see: a progress bar (0–100%), elapsed time (HH:MM:SS), and an estimated time remaining
- [ ] Given export is 50% complete, When I look at the estimate, Then the time remaining is calculated based on the elapsed rate and is within 20% of the actual remaining time for a typical 1080p60 clip
- [ ] Given the FFmpeg process is stalled (no progress for > 10 seconds), When the stall is detected, Then the progress view shows a warning "Export seems stuck. You may cancel and retry."
- [ ] Given export completes, When the 100% state is reached, Then the estimated time remaining disappears and a "Done" state is shown
- [ ] Given I minimize the app during export, When I look at the Dock icon, Then a progress badge shows the export percentage

### Priority: P1
### Phase: 1
### Sprint: 5
### Estimate: S

---

## US-025: Handle Missing Accessibility Permission Gracefully

**As a** Dana  
**I want to** be informed when cursor tracking is unavailable due to a missing permission  
**So that** I can make an informed decision about whether to grant it or record without keyboard overlay

### Acceptance Criteria
- [ ] Given the cursor-tracker binary cannot acquire CGEventTap due to missing Accessibility permission, When this is detected at recording start, Then the main process logs the error and emits an IPC event to the renderer
- [ ] Given the permission error event is received by the renderer, When it is displayed, Then a non-blocking warning banner says "Keyboard shortcut overlay and cursor tracking are unavailable. Grant Accessibility permission in System Settings to enable these features."
- [ ] Given the banner is visible, When I click "Open System Settings", Then System Settings opens to the Accessibility section
- [ ] Given the banner is visible, When I click "Continue Without", Then recording proceeds without cursor tracking data; cursor.json will be empty/missing
- [ ] Given cursor.json is missing, When the editor opens, Then cursor effects and keyboard overlay are greyed out in the sidebar with the tooltip "Cursor data was not captured for this recording"

### Priority: P0
### Phase: 1
### Sprint: 2
### Estimate: S

---

## US-026: Configure Output Canvas Aspect Ratio

**As a** Diego  
**I want to** choose the output aspect ratio independently of my recording resolution  
**So that** I can produce a 1:1 square video for LinkedIn from a 16:9 recording

### Acceptance Criteria
- [ ] Given the editor sidebar, When I open the Canvas section, Then I see an Aspect Ratio selector with options: Source (default), 16:9, 1:1, 9:16, 4:3, Custom
- [ ] Given I select 1:1, When the preview updates, Then the canvas becomes square with the video centered and background filling the remaining area
- [ ] Given I select 9:16 (vertical), When the preview updates, Then the canvas is portrait orientation with the video scaled to fit within the height
- [ ] Given I select Custom, When I enter Width and Height values, Then the canvas updates to the specified dimensions
- [ ] Given a non-source aspect ratio is selected, When I export, Then the output file is the configured canvas dimensions with the video composited correctly inside it

### Priority: P1
### Phase: 2
### Sprint: 8
### Estimate: M

---

## US-027: View Zoom Events on the Timeline Track

**As a** Carlos  
**I want to** see where zoom events occur on the timeline  
**So that** I can understand why certain sections are zoomed in and remove events that do not make sense

### Acceptance Criteria
- [ ] Given Phase 3 timeline is visible and zoom is enabled, When I look at the zoom event track, Then colored markers indicate where auto-generated zoom-in and zoom-out transitions occur
- [ ] Given I hover over a zoom marker, When a tooltip appears, Then it shows: zoom level (e.g., "2.0x"), start time, and trigger type ("cursor pause" or "click event")
- [ ] Given I click a zoom marker, When it becomes selected, Then a Delete key press removes that zoom event and the timeline updates
- [ ] Given I delete a zoom event, When I play back through that region, Then no zoom occurs at that time
- [ ] Given I delete all zoom events, When I look at the playback, Then the video plays at 1.0x (no zoom) throughout

### Priority: P1
### Phase: 3
### Sprint: 9
### Estimate: M

---

## US-028: Apply Curated Wallpaper Backgrounds

**As a** Diego  
**I want to** choose from a set of built-in high-quality wallpapers as my background  
**So that** I can achieve a professional look without needing to find my own image

### Acceptance Criteria
- [ ] Given the Background panel is open and I select "Image" type, When I look at the image options, Then a "Built-in Wallpapers" section shows at least 8 thumbnail previews
- [ ] Given I click a built-in wallpaper thumbnail, When the selection is applied, Then the preview canvas updates with the wallpaper as background immediately
- [ ] Given a built-in wallpaper is selected, When I export, Then the exported video uses the bundled wallpaper image (resolved from app resources, not user disk)
- [ ] Given I move the project to another machine, When I open it, Then the built-in wallpaper is still available (it is bundled with the app, not stored in the project bundle)

### Priority: P2
### Phase: 2
### Sprint: 8
### Estimate: S

---

## US-029: Pause and Resume Recording

**As a** Carlos  
**I want to** pause my recording mid-session and resume it without stopping  
**So that** I can take a breath, check my notes, and continue without having to edit out the gap later

### Acceptance Criteria
- [ ] Given recording is active, When I press the Pause shortcut (default: Cmd+Shift+P), Then the recording pauses: screen capture stops writing frames, timer pauses
- [ ] Given recording is paused, When I press the Pause shortcut again (or a Resume shortcut), Then recording resumes: screen capture continues, timer resumes from where it paused
- [ ] Given recording has a pause segment, When I look at the captured video, Then there is a clean cut at the pause point (no frames from the paused period are in the video)
- [ ] Given recording is paused, When I look at the menu bar indicator, Then it shows a yellow pause icon instead of the red recording indicator
- [ ] Given the recording completes with one or more pause segments, When the session manifest is written, Then the pause intervals are stored as an array of { start, end } timestamps in the manifest

### Priority: P2
### Phase: 2
### Sprint: 8
### Estimate: L

---

## US-030: Export with Lossless Intermediate for Re-editing

**As a** Carlos  
**I want to** export a lossless ProRes file in addition to the compressed MP4  
**So that** I can import the composited output into DaVinci Resolve for further color grading without generation loss

### Acceptance Criteria
- [ ] Given the Export modal Format dropdown, When I open it, Then "ProRes 422 HQ (Lossless)" is available as a format option
- [ ] Given I select ProRes, When the export runs, Then FFmpeg outputs a .mov file with codec prores_ks and profile 3 (HQ)
- [ ] Given ProRes export completes, When I import the file into DaVinci Resolve or Final Cut Pro, Then the file is recognized and playable without transcoding
- [ ] Given ProRes is selected, When I look at the estimated file size, Then it shows an estimate significantly larger than the H.264 equivalent (typically 10–30x larger) with a warning note
- [ ] Given I select ProRes, When the export completes, Then the background, padding, corner radius, and cursor effects are all composited into the ProRes output just as they are for MP4

### Priority: P2
### Phase: 3
### Sprint: 12
### Estimate: M
