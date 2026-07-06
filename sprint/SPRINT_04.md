# Sprint 4 — Cursor Tracking + Zoom/Pan

**Duration:** Week 9-12 (4 tuần)  
**Goal:** Cursor tracking, zoom/pan tự động với spring physics — core differentiator  
**Status:** ✅ Done

---

## Sprint Goal

> Đây là tính năng làm cho app khác biệt. Cursor được track, click events tạo zoom event, camera path smooth với spring physics, áp dụng được trong preview và export.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-023 | cursor-tracker binary stream JSON events | P0 | L | ✅ Done |
| US-024 | Cursor smoothing (moving average) | P0 | S | ✅ Done |
| US-025 | ZoomPathGenerator từ cursor log | P0 | XL | ✅ Done |
| US-026 | Spring physics interpolator | P0 | M | ✅ Done |
| US-027 | Zoom animation trong Konva preview | P0 | L | ✅ Done |
| US-028 | Zoom applied trong FFmpeg export | P0 | L | ✅ Done |
| US-029 | Cursor highlight overlay (soft circle) | P1 | M | ✅ Done |
| US-030 | Click ripple animation overlay | P1 | M | ✅ Done |
| US-031 | Keyboard shortcut visualization | P1 | M | ✅ Done |
| US-032 | Zoom settings panel (auto/manual, intensity) | P1 | S | ✅ Done |

---

## Definition of Done

- [ ] cursor-tracker binary stream đúng tọa độ + click events
- [ ] ZoomPathGenerator tạo được zoom events từ cursor log
- [ ] Preview animate smooth khi scrub qua zoom events
- [ ] Export video có zoom/pan effects đúng timing
- [ ] Spring animation không bị overshoot quá mức (cinematic feel)
