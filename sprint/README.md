# Sprints Overview

| Sprint | Tuần | Mục tiêu | Status |
|--------|------|----------|--------|
| [Sprint 1](SPRINT_01.md) | Week 1-2 | Foundation: electron-vite, IPC contract, Zustand, UI shell | ✅ Done |
| [Sprint 2](SPRINT_02.md) | Week 3-4 | Screen Capture: Swift binary, ScreenCaptureKit, Recording flow | ✅ Done |
| [Sprint 3](SPRINT_03.md) | Week 5-8 | Editor Preview: Konva.js, backgrounds, FFmpeg export | ✅ Done |
| [Sprint 4](SPRINT_04.md) | Week 9-12 | Zoom/Pan: cursor tracking, spring physics, effects | ✅ Done |
| [Sprint 5](SPRINT_05.md) | Week 13-16 | Polish: timeline, webcam, GIF, presets, ship | ✅ Done |
| [Sprint 6](SPRINT_06.md) | Week 17-20 | Reliability: webcam/frame compositing, error UX, autosave, undo/redo | ✅ Done |
| [Sprint 7](SPRINT_07.md) | Week 21-24 | Home screen: cache thumbnail, load nhanh hơn, redesign toolbar/skeleton | ✅ Done |
| [Sprint 8](SPRINT_08.md) | Week 25-28 | Multi-clip editing (split/ripple delete), manual zoom keyframe control, export codec/quality options | ✅ Done |
| [Sprint 9](SPRINT_09.md) | Week 29-32 | Smart editing: auto silence removal, speed ramping per-segment, text annotations, keystroke trong export, xuất dọc 9:16 | ✅ Done |
| [Sprint 10](SPRINT_10.md) | Week 33-36 | Synthetic cursor (scale/smooth/ẩn được), style presets, rename recording, batch export, quick share | ✅ Done |
| [Sprint 11](SPRINT_11.md) | Week 37-40 | Camera scenes (layout theo timeline), face auto-framing, audio mixer + auto-ducking | ✅ Done |
| [Sprint 12](SPRINT_12.md) | Week 41-44 | Ship readiness: auto-update, error boundary, crash reporting, onboarding permission flow | ✅ Done (trừ crash reporting) |
| [Sprint 13](SPRINT_13.md) | Week 45-48 | Accessibility (VoiceOver, keyboard-first Timeline), contrast audit, i18n foundation | ✅ Done (trừ Tab-to-select block) |
| [Sprint 14](SPRINT_14.md) | Week 49-52 | Test automation: Vitest cho Exporter/store, ffmpeg integration test, CI | ✅ Done (trừ XCTest, visual regression, pre-commit hook) |
| [Sprint 15](SPRINT_15.md) | Week 53-56 | Templates (nhân bản cấu trúc), chapter markers, review comments cục bộ | ✅ Done |
| [Sprint 16](SPRINT_16.md) | Week 57-60 | Proxy preview performance: edit mượt video 4K dài, giữ chất lượng gốc khi export | ✅ Done (trừ profiling — thiếu máy đo) |
| [Sprint 17](SPRINT_17.md) | Week 61-64 | Discoverability: shortcuts overlay, contextual hints, interactive tour, What's New | ✅ Done (trừ Tooltip component chung) |
| [Sprint 18](SPRINT_18.md) | Week 65-68 | Product analytics opt-in: đo tính năng nào thực sự được dùng, funnel, export config | ✅ Done (sink local — không có PostHog thật) |
| [Sprint 19](SPRINT_19.md) | Week 69-72 | Sensitive content redaction: blur region theo thời gian, auto-detect notification, face blur | ✅ Done (trừ auto-detect notification — thiếu dữ liệu test) |
| [Sprint 20](SPRINT_20.md) | Week 73-76 | Multi-display chính xác: fix cursor coordinate đa màn hình, display layout picker, chuyển display giữa lúc quay | ✅ Done (US-162 chỉ spike — thiếu phần cứng đa màn hình) |
| [Sprint 21](SPRINT_21.md) | Week 77-80 | Publish destinations: upload trực tiếp YouTube/Drive/Dropbox, quản lý token an toàn, lịch sử publish | ✅ Done scaffold (OAuth/upload Blocked — thiếu credentials thật) |
| [Sprint 22](SPRINT_22.md) | Week 81-84 | Trả nợ kỹ thuật: fixture tổng hợp cho notification auto-detect, đo thật 100%/0% recall/FP | 🟡 Partial (multi-display switch vẫn Blocked — thiếu phần cứng) |
| [Sprint 23](SPRINT_23.md) | Week 85-88 | QuickTime-style recording UI + ergonomics: pill kéo tự do, menu bar icon, global shortcut | ✅ Done |
| [Sprint 24](SPRINT_24.md) | Week 89-92 | AI-assisted editing on-device: transcript-driven cut, xoá filler word, xuất SRT | 🟡 Done pending 1 manual TCC check trên bản đóng gói thật |
| [Sprint 25](SPRINT_25.md) | Week 93-96 | Nâng trần chất lượng: capture/export HDR (verify thật trên XDR display), high-fps 90/120; phát hiện + sửa bug zoom-export có sẵn từ trước | ✅ Done |
| [Sprint 26](SPRINT_26.md) | Week 97-100 | Team collaboration: comment đồng hành khi publish, trang review nhẹ không cần app, phát hiện xung đột | ✅ Done |
| [Sprint 27](SPRINT_27.md) | Week 101-104 | HomeScreen performance (JSON index, load more), polish UI, i18n 13 ngôn ngữ, light theme | ✅ Done (i18n/theme phủ HomeScreen+Settings; RecordingControls/Timeline còn nợ kỹ thuật) |

## Quy trình mỗi Sprint

```
Sprint Planning → Development → QA (test/RESULTS/) → Sprint Review → Retrospective
```

## Status Legend
- 🔲 Planned — chưa bắt đầu
- 🟡 In Progress — đang thực hiện  
- ✅ Done — hoàn thành
- 🔴 Blocked — bị block
