# Sprint 3 — Editor Preview + Basic Export

**Duration:** Week 5-8 (4 tuần)  
**Goal:** Editor preview hoạt động với Konva.js, export MP4 cơ bản qua FFmpeg  
**Status:** 🔲 Planned

---

## Sprint Goal

> Sau khi record xong, mở được file trong Editor. Preview canvas hiển thị video với background + padding + rounded corners. Export ra MP4 được. Đây là end-to-end flow đầu tiên hoàn chỉnh.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-015 | Konva preview canvas: video + background | P0 | L | 🔲 Todo |
| US-016 | Background panel: solid color + gradient | P0 | M | 🔲 Todo |
| US-017 | Padding + border-radius controls | P0 | M | 🔲 Todo |
| US-018 | Export MP4 via FFmpeg (background + padding) | P0 | L | 🔲 Todo |
| US-019 | Export progress bar | P0 | S | 🔲 Todo |
| US-020 | Project save/open (.screenstudio bundle) | P0 | M | 🔲 Todo |
| US-021 | Background: image + blur (frosted glass) | P1 | M | 🔲 Todo |
| US-022 | Export resolution picker + format (MP4/GIF stub) | P1 | S | 🔲 Todo |

---

## Definition of Done

- [ ] Record → stop → preview hiển thị đúng trong Editor
- [ ] Thay đổi background/padding reflect live trong preview
- [ ] Export MP4 chạy được, file mở được bằng macOS QuickTime
- [ ] Save/open project (.screenstudio) giữ nguyên settings
- [ ] Export 1 phút video 1080p xong trong < 60 giây (stretch: < 30s)
