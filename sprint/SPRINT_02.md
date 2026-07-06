# Sprint 2 — Screen Capture Binary

**Duration:** Week 3-4 (2 tuần)  
**Goal:** Swift `capture` binary hoạt động, ghi được màn hình, Electron quản lý được process  
**Status:** 🔲 Planned

---

## Sprint Goal

> Ghi được màn hình thực tế bằng ScreenCaptureKit, lưu ra file `.mov` lossless. Electron spawn và communicate với binary. Recording Controls UI có Start/Stop button thực sự hoạt động.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-009 | Capture binary ghi màn hình ra .mov lossless | P0 | XL | 🔲 Todo |
| US-010 | Electron spawn/stop capture binary qua IPC | P0 | L | 🔲 Todo |
| US-011 | Display picker UI (chọn màn hình cần ghi) | P0 | M | 🔲 Todo |
| US-012 | Recording status hiển thị (idle/recording/duration) | P0 | S | 🔲 Todo |
| US-013 | TCC permission request flow (screen recording) | P0 | M | 🔲 Todo |
| US-014 | Session manifest được tạo sau khi stop | P0 | S | 🔲 Todo |

---

## Key Technical Work

- [ ] `swift/capture/Package.swift` — Swift Package setup
- [ ] `swift/capture/Sources/capture/ScreenCapture.swift` — SCStream management
- [ ] `swift/capture/Sources/capture/VideoWriter.swift` — AVAssetWriter + VideoToolbox HEVC Lossless
- [ ] `scripts/build-swift.sh` — compile + `lipo` universal binary
- [ ] `scripts/sign-helpers.sh` — codesign binary với dev certificate
- [ ] `src/main/recording/CaptureProcess.ts` — spawn, IPC, SIGTERM
- [ ] `src/main/recording/RecordingSession.ts` — state machine
- [ ] `src/renderer/components/Recording/DisplayPicker.tsx`

---

## Definition of Done

- [ ] Chạy `swift run capture --output /tmp/test.mov --duration 5` ghi được 5 giây màn hình
- [ ] App ghi được video khi bấm Start, dừng khi bấm Stop
- [ ] File `.mov` mở được trong QuickTime Player
- [ ] SessionManifest JSON được tạo với đúng metadata
- [ ] TCC permission prompt hiển thị đúng lần đầu chạy
