# Screen Studio Clone — Master Test Plan

**Version:** 1.0
**Date:** 2026-06-29
**Author:** QA Engineering
**Project:** Screen Studio Clone (Electron + React/TypeScript + Swift Native Helpers + FFmpeg)

---

## 1. Overview and Objectives

This document defines the complete test strategy for the Screen Studio Clone application — a macOS screen recording tool built with Electron 26.x, React 18/TypeScript 5, Swift 6 native helper binaries, and FFmpeg. The app captures screen output via ScreenCaptureKit, applies visual effects (zoom/pan, cursor highlights, backgrounds), and exports to MP4/GIF.

### Testing Objectives
- Validate all core recording, editing, and export functionality across all three development phases
- Ensure macOS TCC (Transparency, Consent, and Control) permission handling is correct and graceful
- Verify IPC communication integrity between Electron main process and renderer
- Confirm Swift helper binaries produce correct output under nominal and error conditions
- Validate FFmpeg export pipelines produce bit-correct, spec-compliant video files
- Ensure performance SLAs are met (recording CPU, export speed, UI framerate, startup time)
- Detect crashes, hangs, and data loss scenarios before production

---

## 2. Test Scope

### 2.1 In Scope

| Component | Description |
|-----------|-------------|
| Electron main process | IPC handlers, recording session state machine, process spawning |
| Electron renderer (React UI) | All UI components, Konva canvas compositor, Zustand state |
| Preload / contextBridge | Typed IPC bridge, security boundary validation |
| Swift `capture` binary | ScreenCaptureKit recording, HEVC lossless output |
| Swift `cursor-tracker` binary | CGEventTap JSON stream, accuracy, timing |
| Swift `audio-composer` binary | System audio + microphone mixing |
| Swift `zoom-renderer` binary | Metal compute shader zoom/pan application |
| Swift `face-detector` binary | Vision framework face detection output |
| FFmpeg export pipeline | MP4/GIF output, filter graphs, preset validation |
| Project file format | `.screenstudio` bundle save/open/migrate |
| Auto-update mechanism | electron-updater update detection and installation |
| Code signing + entitlements | TCC permissions, binary signing validation |

### 2.2 Out of Scope

- Windows / Linux builds (macOS-only application)
- Internal Electron/Chromium browser engine bugs
- FFmpeg codec bugs not caused by our filter configuration
- Third-party distribution channel (App Store review process itself)
- Hardware-specific GPU bugs unrelated to our Metal shader code

---

## 3. Test Strategy

### 3.1 Testing Pyramid

```
          /--E2E Tests (Playwright)--\
         /  ~15% — slow, high value   \
        /----------------------------\
       /  Integration Tests (Vitest)  \
      /    ~25% — IPC, export, IO     \
     /--------------------------------\
    /    Unit Tests (Vitest + XCTest)   \
   /    ~60% — fast, deterministic      \
  /--------------------------------------\
```

### 3.2 Test Types

#### Unit Tests (Vitest + XCTest)
- **Target:** Individual functions, classes, and modules in isolation
- **Framework:** Vitest 1.x for TypeScript/JS code; XCTest for Swift binaries
- **Mocking:** vi.mock() for IPC, fs, child_process; XCTest mocks for ScreenCaptureKit
- **Coverage target:** 80% line coverage on src/main/ and src/renderer/effects/
- **Execution:** Pre-commit hook + CI on every push
- **Speed target:** Full unit suite completes in under 2 minutes

Key unit test targets:
- `RecordingSession.ts` — state machine transitions (idle → ready → recording → processing → done)
- `ZoomPathGenerator.ts` — zoom event generation from cursor log input
- `SpringSimulator.ts` — spring physics correctness (convergence, overshoot bounds)
- `CursorSmoother.ts` — moving average filter accuracy
- `FFmpegWrapper.ts` — command construction correctness
- `ProjectManager.ts` — manifest serialization/deserialization
- Swift `cursor-tracker` — JSON output format validation, timestamp precision
- Swift `capture` — configuration parameter validation

#### Integration Tests (Vitest)
- **Target:** Cross-module interactions, IPC flows, file I/O
- **Framework:** Vitest with Electron test harness (electron-mocha pattern)
- **Environment:** Headless Electron instance, temp directories for file I/O
- **Coverage target:** All IPC channels have at least one integration test
- **Execution:** CI on pull requests

Key integration test targets:
- Full IPC roundtrip: renderer command → main handler → binary spawn → response
- Export pipeline: capture.mov input → FFmpeg invocation → output file validation
- Project save and reopen: write `.screenstudio` bundle → parse manifest → verify data integrity
- Permission denial flows: TCC denial simulation → graceful error propagation
- Binary process lifecycle: spawn → stdout parsing → exit handling

#### E2E Tests (Playwright)
- **Target:** Complete user workflows through real Electron application window
- **Framework:** Playwright with `electron` launch mode
- **Environment:** Signed development build on macOS 14+ Apple Silicon
- **Scope:** Critical user journeys only — recording, editing, exporting
- **Execution:** CI on release branches + manual gate for each Phase
- **Speed target:** Full E2E suite completes in under 15 minutes

Key E2E scenarios:
- Display selection → recording start → recording stop → editor opens
- Editor: apply background → change padding → preview updates
- Export MP4 → file saved to chosen location
- Open saved `.screenstudio` project → settings restored
- App crash recovery: relaunch after kill -9, verify project auto-recovery

#### Manual Testing
- **Target:** Subjective quality (visual correctness, animation smoothness, UI polish)
- **Checklist:** See test/TEST_CASES.md — Manual section
- **Execution:** Before each Phase release milestone
- **Sign-off:** Required from lead developer + QA before Phase release

Manual testing focus areas:
- Visual quality of backgrounds (gradient rendering, blur quality)
- Zoom/pan animation feel (spring physics smoothness)
- Cursor highlight and click ripple animations
- Export video visual inspection (no artifacts, correct colors)
- GIF quality and file size assessment
- Overall app responsiveness and UI polish

#### Performance Testing
- **Target:** CPU/memory usage, export speed, UI framerate
- **Tools:** macOS Instruments (Time Profiler, Allocations, Metal), Chrome DevTools in Electron, k6 for stress testing IPC
- **Execution:** Weekly automated benchmark run + manual before each Phase
- **Thresholds:** See test/PERFORMANCE_BENCHMARKS.md

### 3.3 Risk-Based Prioritization

| Risk | Likelihood | Impact | Testing Priority |
|------|-----------|--------|-----------------|
| ScreenCaptureKit entitlement failure (silent TCC denial) | High | Critical | P0 — test first |
| CGEventTap accessibility permission denial handling | High | High | P0 |
| Cursor timestamp desync with video frames | Medium | Critical | P0 |
| FFmpeg command injection via user file paths | Low | Critical | P0 |
| HEVC lossless encode failure on Intel Macs | Medium | High | P0 |
| Code signing mismatch — binary execution blocked | High | Critical | P0 |
| Spring physics numerical instability | Low | Medium | P1 |
| Konva canvas memory leak during long sessions | Medium | High | P1 |
| Export pipeline crash midway (no partial file cleanup) | Medium | High | P1 |
| `.screenstudio` bundle corruption on crash | Medium | High | P1 |
| GIF palette generation producing wrong colors | Low | Medium | P2 |
| Auto-update installing corrupted bundle | Low | High | P1 |
| Face detector false positives affecting webcam crop | Low | Low | P2 |

---

## 4. Test Phases

### Phase 1 — MVP Testing (Weeks 1-8)

**Scope:** Core recording, basic export, project save/open, basic UI

**Entry Criteria:**
- Swift `capture` binary compiles and runs on test machine
- Electron app launches without errors
- Basic IPC contract (`ipc-types.ts`) implemented
- At least one display can be selected and shown in UI

**Exit Criteria:**
- All P0 test cases pass
- At least 80% of P1 test cases pass
- No open Critical/High severity bugs blocking core workflow
- Recording start/stop works on both Apple Silicon and Intel (if available)
- Export produces a valid, playable MP4 file
- Project save/open round-trip preserves all settings
- CPU during recording stays below 30%
- Export time for 60-second 1080p recording is under 30 seconds
- App startup time is under 2 seconds

**Test Cases:** TC-001 through TC-040 (see TEST_CASES.md)

**Phase 1 Test Artifacts:**
- RESULTS/PHASE1_RUN_001.md — initial test run
- Bug reports filed in BUG_REPORT_TEMPLATE.md format

---

### Phase 2 — Effects Testing (Weeks 9-14)

**Scope:** Zoom/pan, cursor effects, advanced backgrounds, keyboard shortcut overlay, device frames

**Entry Criteria:**
- Phase 1 exit criteria met
- Swift `cursor-tracker` binary produces correct JSON stream
- Swift `zoom-renderer` binary compiles and processes test video
- ZoomPathGenerator produces output from cursor log fixture

**Exit Criteria:**
- All Phase 2 P0 test cases pass
- Zoom/pan animation visually smooth at 60fps during export
- Spring physics parameters produce cinematic feel (manual sign-off)
- Cursor highlight renders at correct position (within 2px tolerance)
- Click ripple animation completes within 300ms
- Frosted glass background renders without visible artifacts
- No cursor desync detectable at 1x playback speed
- Keyboard shortcut overlay window appears within 50ms of keypress

**Test Cases:** TC-041 through TC-080 (see TEST_CASES.md)

---

### Phase 3 — Polish Testing (Weeks 15-20)

**Scope:** Timeline editor, webcam overlay, GIF export, presets, auto-update

**Entry Criteria:**
- Phase 2 exit criteria met
- Swift `face-detector` binary operational
- GIF export pipeline (FFmpeg palette + gifsicle) functional
- Timeline component renders without console errors

**Exit Criteria:**
- All Phase 3 P0 test cases pass
- GIF export produces files under 5MB for 10-second 800px-wide clip
- Timeline trim handles drag with less than 1 frame accuracy error
- Webcam overlay composited correctly in export (position, size, shape)
- Auto-update mechanism tested with test channel release
- All 4 social media presets produce correct output dimensions
- Full test suite passes (all P0, 90% P1, 70% P2)
- No critical bugs open for more than 48 hours before release

**Test Cases:** TC-081 through TC-120 (see TEST_CASES.md)

---

## 5. Test Environment Requirements

### Hardware
| Device | Required | Purpose |
|--------|----------|---------|
| MacBook Pro M2/M3 (Apple Silicon) | Required | Primary test platform |
| MacBook Intel (x86_64) | Strongly recommended | Universal binary validation |
| 4K display or higher | Recommended | Retina capture testing |
| External USB microphone | Required | Audio composer testing |

### Software
| Component | Version | Notes |
|-----------|---------|-------|
| macOS | 14.0+ (Sonoma) minimum | ScreenCaptureKit API version |
| macOS | 15.x (Sequoia) | Privacy manifest validation |
| Xcode | 15.x+ | Swift 6 compilation |
| Node.js | 20.x LTS | Matches electron-vite requirements |
| FFmpeg | Universal binary (arm64 + x86_64) | Validate with `file ffmpeg` |
| Vitest | 1.x | Unit + integration testing |
| Playwright | 1.45+ | E2E Electron testing |

### Accounts and Permissions
- Apple Developer account with valid Team ID (code signing)
- macOS test account with Screen Recording, Accessibility, and Microphone permissions granted
- Separate macOS test account with all permissions denied (for negative testing)
- GitHub repository access for auto-update channel testing

### Test Data
- Fixture video files: 1080p, 4K, 30fps, 60fps `.mov` files
- Cursor log JSON fixtures representing various interaction patterns
- Sample `.screenstudio` project bundles (valid, corrupted, missing fields)
- Audio files: stereo M4A, mono WAV for composer testing
- Large files: 10-minute 4K recording for stress testing

---

## 6. Tools and Frameworks

### Unit Testing
- **Vitest 1.x** — TypeScript unit tests with native ESM support
  - Configuration: `vitest.config.ts` with electron-vite integration
  - Coverage: Istanbul/V8 provider, threshold: 80% lines
  - Run: `npm run test:unit`

### Integration Testing
- **Vitest** with custom Electron test harness
  - Launch headless Electron for IPC testing
  - Use `tmp` package for isolated temp directories
  - Run: `npm run test:integration`

### E2E Testing
- **Playwright 1.45+** with `_electron` launch API
  - `playwright.config.ts` — Electron app launch, screenshot on failure
  - `test/e2e/` directory for E2E test files
  - Run: `npm run test:e2e`

### Swift Testing
- **XCTest** — Apple's native Swift testing framework
  - Located in `swift/*/Tests/` directories
  - Run via `swift test` in each package directory
  - CI integration: `xcodebuild test -scheme <scheme>`

### Performance Testing
- **macOS Instruments** — Time Profiler, Allocations, Metal GPU Debugger
  - Instruments `.trace` files archived per Phase
- **Node.js `--inspect`** — V8 heap snapshots for renderer memory analysis
- **`perf_hooks`** — API response time measurement in integration tests

### Manual Testing Aids
- macOS Screen Recording to capture test evidence
- **ScreenCaptureKit** reference recording for visual comparison
- **ffprobe** for validating output file metadata
  - `ffprobe -v quiet -print_format json -show_streams output.mp4`
- **MediaInfo** for codec and bitrate validation

---

## 7. Defect Management

### Severity Definitions
| Severity | Definition | SLA |
|----------|-----------|-----|
| Critical | App crash, data loss, security vulnerability, recording produces no output | Fix before next build |
| High | Feature completely broken, significant data corruption risk, export fails | Fix within 48 hours |
| Medium | Feature partially broken, workaround exists, visual artifacts | Fix within 1 week |
| Low | Minor UI issue, cosmetic defect, documentation error | Fix at discretion |

### Priority Definitions
| Priority | Definition |
|----------|-----------|
| P0 | Blocks release or phase completion |
| P1 | Important, should fix before release |
| P2 | Nice to fix, low business impact |

### Bug Report Format
See `test/BUG_REPORT_TEMPLATE.md` for the standard format.

### Triage Process
1. Bug discovered → filed immediately with reproduction steps
2. Daily triage: assign severity, priority, owner
3. P0 bugs: immediate escalation, block further testing if unresolved
4. Fixed bugs: verified by QA on same build as fix; status set to Verified

---

## 8. Entry and Exit Criteria Summary

| Phase | Entry | Exit |
|-------|-------|------|
| Phase 1 | App launches, IPC defined, capture binary runs | All P0 pass, MP4 export functional, project save/open works |
| Phase 2 | Phase 1 passed, cursor-tracker operational | Zoom/pan smooth, cursor effects correct, no desync |
| Phase 3 | Phase 2 passed, face-detector operational, GIF pipeline built | All P0 pass 90% P1, full regression clean |

---

## 9. Test Deliverables

| Deliverable | Location | Owner | Due |
|-------------|----------|-------|-----|
| TEST_PLAN.md (this document) | test/ | QA | Phase 0 |
| TEST_CASES.md | test/ | QA | Phase 0 |
| BUG_REPORT_TEMPLATE.md | test/ | QA | Phase 0 |
| PERFORMANCE_BENCHMARKS.md | test/ | QA | Phase 0 |
| PHASE1_RUN_001.md | test/RESULTS/ | QA | End of Phase 1 |
| Unit test suite (Vitest) | test/unit/ | Dev + QA | Ongoing |
| E2E test suite (Playwright) | test/e2e/ | QA | Phase 1 MVP |
| XCTest suites | swift/*/Tests/ | Dev | Per binary |
| Phase release sign-off | test/RESULTS/ | QA Lead | Per Phase |
