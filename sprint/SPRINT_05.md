# Sprint 5 — Timeline Editor + Webcam + Polish

**Duration:** Week 13-16 (4 tuần)  
**Goal:** Timeline editor, webcam overlay, GIF export, presets, auto-update, ship-ready  
**Status:** ⚠️ Partial (device frames ✅, auto-update & notarize skipped — need Apple cert/server)

---

## Sprint Goal

> Phase 3 — polishing. Timeline cho phép trim clip, webcam overlay, GIF export, export presets cho social media. App sẵn sàng distribute.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-033 | Timeline component với trim handles | P0 | XL | ✅ Done |
| US-034 | Audio waveform visualization | P1 | M | ✅ Done |
| US-035 | Webcam capture + overlay | P1 | L | ⚠️ Partial (preview only, not recorded to disk) |
| US-036 | Face detection tracking cho webcam | P2 | L | ⏭ Skipped (P2, out of scope) |
| US-037 | GIF export via FFmpeg + gifsicle | P1 | M | ✅ Done |
| US-038 | Export presets (Twitter, YouTube, LinkedIn, Slack) | P1 | S | ✅ Done |
| US-039 | Device frame overlays (MacBook, browser, iPhone) | P2 | M | ✅ Done |
| US-040 | Auto-update via electron-updater | P1 | M | ⏭ Skipped (needs Apple cert + update server) |
| US-041 | App notarization + distribution build | P0 | M | ⏭ Skipped (needs Apple Developer cert) |
| US-042 | Performance optimization (memory, CPU) | P1 | L | ⏭ Skipped (no perf issues yet) |

---

## Definition of Done

- [ ] Trim in/out points hoạt động, export chỉ phần đã trim
- [ ] Webcam overlay hiển thị trong preview và export
- [ ] GIF export chạy được, file size hợp lý
- [ ] App notarized, chạy được trên máy Mac khác không có dev tools
- [ ] Auto-update nhận và cài update mới
- [ ] Performance benchmarks đạt (xem test/PERFORMANCE_BENCHMARKS.md)
