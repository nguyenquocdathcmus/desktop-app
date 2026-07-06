# Sprint 1 — Foundation Setup

**Duration:** Week 1-2 (2 tuần)  
**Goal:** Project skeleton chạy được, IPC contract xong, cửa sổ cơ bản hiển thị  
**Status:** 🟡 In Progress

---

## Sprint Goal

> Có một Electron app chạy được trên macOS với electron-vite, hai cửa sổ (Recording Controls + Editor), typed IPC contract, Zustand stores, và Tailwind CSS setup xong. Không cần tính năng thực tế, chỉ cần nền móng đúng để mọi Phase sau xây lên được.

---

## Team

| Role | Người |
|------|-------|
| Developer | [Dev] |
| BA | BA Agent (doc/PRD.md) |
| QA | Testing Agent (test/TEST_PLAN.md) |

---

## User Stories trong Sprint này

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-001 | Setup electron-vite project với React + TypeScript | P0 | S | 🔲 Todo |
| US-002 | Tạo typed IPC contract (ipc-types.ts) | P0 | S | 🔲 Todo |
| US-003 | Tạo Recording Controls window | P0 | M | 🔲 Todo |
| US-004 | Tạo Editor window placeholder | P0 | M | 🔲 Todo |
| US-005 | Setup Zustand stores (recording, project, playback) | P0 | S | 🔲 Todo |
| US-006 | Setup Tailwind CSS + Radix UI primitives | P0 | S | 🔲 Todo |
| US-007 | Setup electron-builder config + entitlements.plist | P0 | S | 🔲 Todo |
| US-008 | Setup Vitest + Playwright E2E skeleton | P1 | S | 🔲 Todo |

---

## Tasks

### Setup Project
- [ ] `npm create electron-vite@latest screen-studio -- --template react-ts`
- [ ] Cấu hình `tsconfig.json` (strict mode, path aliases `@main`, `@renderer`, `@shared`)
- [ ] Cấu hình `vite.config.ts` với electron-vite
- [ ] Install dependencies: `react`, `typescript`, `tailwindcss`, `zustand`, `immer`, `konva`, `react-konva`, `@radix-ui/react-*`, `framer-motion`, `fluent-ffmpeg`
- [ ] Install dev deps: `vitest`, `@playwright/test`, `electron-builder`, `@electron/notarize`
- [ ] Setup `scripts/download-ffmpeg.sh` (tải FFmpeg universal binary)
- [ ] Setup `scripts/build-swift.sh` (stub, sẽ dùng ở Sprint 2)

### IPC Contract
- [ ] Viết `src/shared/ipc-types.ts` — tất cả IPC channels dưới dạng discriminated unions
- [ ] Viết `src/shared/project-types.ts` — SessionManifest, ExportOptions, BackgroundSource
- [ ] Viết `src/shared/constants.ts`
- [ ] Viết `src/preload/index.ts` — contextBridge expose typed API

### Windows
- [ ] `src/main/index.ts` — tạo RecordingControls window (400x200, no frame, always on top)
- [ ] `src/main/index.ts` — tạo Editor window (1200x800)
- [ ] Zustand store: `useRecordingStore.ts` (status: idle | ready | recording | processing | done)
- [ ] Zustand store: `useProjectStore.ts` (current project, settings)
- [ ] Zustand store: `usePlaybackStore.ts` (currentTime, duration, isPlaying)

### UI Shell
- [ ] `src/renderer/App.tsx` — routing giữa Recording Controls và Editor
- [ ] `src/renderer/components/Recording/RecordingControls.tsx` — placeholder UI
- [ ] `src/renderer/components/Editor/Editor.tsx` — placeholder layout (sidebar + preview)
- [ ] Setup Tailwind dark theme

### Config Files
- [ ] `electron-builder.yml` — packaging, macOS target, entitlements
- [ ] `entitlements.plist` — screen-recording, microphone, camera entitlements
- [ ] `.gitignore` phù hợp với Electron project

---

## Definition of Done

- [ ] `npm run dev` khởi động app, 2 cửa sổ hiển thị không crash
- [ ] `npm run build` tạo được `.app` bundle
- [ ] TypeScript compile không có error (`tsc --noEmit`)
- [ ] IPC call từ renderer → main → renderer hoạt động (test bằng ping/pong)
- [ ] Tailwind styles render đúng trong Electron window
- [ ] `npm run test` chạy được (dù chưa có test nào pass/fail)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| electron-vite config phức tạp | Medium | High | Dùng official template, không customize quá sớm |
| Electron sandbox ảnh hưởng contextBridge | Low | High | Test IPC ngay từ đầu với ping/pong |
| Code signing chưa setup | Low | Medium | Skip cho dev, chỉ cần ở production build |

---

## Notes

- Tuần 1: Project setup + IPC contract + Zustand stores
- Tuần 2: Window layout + Tailwind + electron-builder config
- Sprint 2 sẽ bắt đầu Swift `capture` binary — **rủi ro cao nhất của toàn dự án**

---

## Sprint Review

*(Điền sau khi Sprint kết thúc)*

**Completed:** -  
**Not Completed:** -  
**Velocity:** -  
**Blockers gặp phải:** -  
**Carry-over sang Sprint 2:** -
