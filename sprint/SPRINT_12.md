# Sprint 12 — Ship Readiness: Auto-Update, Crash Safety, Onboarding

**Duration:** Week 41-44 (4 tuần)
**Goal:** App hiện chỉ "chạy được trên máy dev" — chưa có cách tự cập nhật, một crash React duy nhất làm trắng toàn bộ cửa sổ, không ai biết app đã crash ở đâu, và người dùng mới mở app lần đầu không được hướng dẫn xin quyền hệ thống đúng thứ tự. Sprint này đóng khoảng cách giữa "demo được" và "phát hành được".
**Status:** ✅ Done (trừ US-101 crash reporting — cần tài khoản Sentry/dịch vụ ngoài, chưa triển khai)

---

## Sprint Goal

> Khảo sát trực tiếp trước khi viết sprint này xác nhận 4 lỗ hổng "ship readiness":
>
> 1. **Không có auto-update.** `package.json` có `electron-builder` nhưng không có `electron-updater`, không `publish` config. Người dùng cài bản v1 sẽ mãi mãi dùng v1 — mọi Sprint 6-11 vừa làm sẽ không đến tay ai đã cài trước đó trừ khi họ tự tải lại.
> 2. **Zero error boundary.** Không một `ErrorBoundary`/`componentDidCatch` nào trong toàn bộ `src/renderer`. Một exception ném ra giữa render (VD: `project.zoomEvents.find` khi `zoomEvents` bất ngờ `undefined` sau migrate lỗi) làm React unmount toàn bộ cây — cửa sổ Editor thành trắng tinh, không thông báo, không cách nào quay lại ngoài restart app và mất context đang làm.
> 3. **Không crash reporting.** Không Sentry, không `crashReporter` của Electron. Khi người dùng report "app bị đứng", không có cách nào biết đã xảy ra gì.
> 4. **Onboarding permission flow thô.** `checkAndRequestRecordingPermissions` tồn tại nhưng app không dẫn dắt người dùng lần đầu qua từng quyền (Screen Recording → Accessibility → Microphone → Camera) theo đúng thứ tự macOS yêu cầu — hiện chỉ xin khi cần, khiến người dùng mới bối rối với nhiều popup TCC bất ngờ.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-099 | Tích hợp `electron-updater` + GitHub Releases: check update khi mở app, banner "Update available" không chặn thao tác, cài đặt khi người dùng chọn "Restart & Update" | P0 | M | ✅ Done |
| US-100 | Error boundary bọc Editor/HomeScreen/RecordingControls riêng biệt — 1 crash trong Editor không kéo sập cả app; màn hình lỗi có nút "Reload" + "Report issue" | P0 | M | ✅ Done |
| US-101 | Crash reporting: bật `app.setPath('crashDumps', ...)` + Electron `crashReporter`, hoặc tích hợp Sentry Electron SDK (quyết định lúc bắt đầu sprint dựa trên chi phí self-host vs SaaS) | P0 | M | 🔴 Blocked — cần tài khoản Sentry/dịch vụ SaaS thật |
| US-102 | First-run onboarding: màn hình chào hỏi dẫn qua từng quyền hệ thống theo thứ tự (Screen Recording → Accessibility → Mic → Camera), giải thích ngắn gọn từng quyền dùng để làm gì trước khi trigger TCC prompt | P0 | M | ✅ Done |
| US-103 | "Send feedback" trong app: mở mailto hoặc form đơn giản kèm tự động đính version + log gần nhất (không PII) | P1 | S | ✅ Done (mailto qua Help menu + ErrorBoundary report) |
| US-104 | Auto-save crash recovery: nếu app bị kill giữa chừng khi đang edit, lần mở lại phát hiện project chưa lưu (so `isDirty` cache) và hỏi khôi phục | P1 | M | ✅ Done |
| US-105 | Disk space check trước khi bắt đầu recording: cảnh báo nếu còn <2GB trống (lossless HEVC 4K60 ~2GB/phút) | P1 | S | ✅ Done |
| US-106 | App menu + keyboard shortcuts chuẩn macOS: Cmd+Q xác nhận nếu đang export/recording, Cmd+, mở Settings (mới), Cmd+N ghi mới | P2 | S | ✅ Done (trừ Cmd+, Settings — chưa có Settings window để mở) |

---

## Định hướng kỹ thuật

**Auto-update (US-099):**
- `electron-updater` + GitHub Releases provider trong `electron-builder.yml` (`publish: { provider: 'github', owner, repo }`).
- Check ở main process lúc `app.whenReady()` (production only — skip trong dev), broadcast `update:available`/`update:downloaded` qua IPC.
- UI: banner nhỏ dưới toolbar Editor/HomeScreen, không modal chặn — "Cập nhật {version} đã sẵn sàng · Restart & Update".

**Error boundaries (US-100):**
- 3 boundary riêng: quanh `<HomeScreen>`, quanh `<Editor>`, quanh `<RecordingControls>` — lỗi 1 nơi không lan sang nơi khác (VD: lỗi trong Editor không ảnh hưởng RecordingControls đang là cửa sổ riêng, nhưng trong cùng cửa sổ Editor thì lỗi Sidebar không nên sập luôn PreviewCanvas — cân nhắc granularity lúc code).
- Fallback UI: thông báo ngắn + nút Reload (re-mount subtree) + nút "Report issue" (US-103) + chi tiết lỗi ẩn sau "Show details" (dành cho report, không phơi ra mặc định).

**Crash reporting (US-101):**
- Quyết định đầu sprint: Electron's built-in `crashReporter` (native crash dumps, cần backend nhận — có thể tự host qua `submitURL` hoặc dùng dịch vụ miễn phí) vs Sentry Electron SDK (dễ tích hợp hơn, có free tier, bắt được cả JS exception lẫn native crash). Nghiêng về Sentry cho tốc độ triển khai trừ khi có lý do bảo mật/chi phí cụ thể chặn lại.
- Không gửi PII: scrub file path chứa username trước khi gửi (`~/Documents/...` → `<home>/...`).

**Onboarding (US-102):**
- Cửa sổ/màn hình riêng hiện lần đầu (check `app.getPath('userData')/onboarded.flag`), 4 bước tuần tự với minh hoạ + nút "Grant permission" gọi đúng handler `permissions.ts` hiện có, disable nút Next cho tới khi quyền đó được cấp hoặc người dùng bấm "Skip for now".

**Disk space check (US-105):**
- `fs.statfs` (Node 18.15+) hoặc lệnh `df` trước khi `session.start()`; cảnh báo không chặn cứng, chỉ khi <2GB.

---

## Definition of Done

- [x] Build mới đẩy lên GitHub Releases → app đang chạy bản cũ hiện banner cập nhật trong vòng vài phút, bấm Restart & Update tự cài xong và mở lại đúng version mới
- [x] Ném lỗi giả trong component con của Editor (Sidebar) → chỉ Sidebar hiện fallback lỗi, PreviewCanvas + Timeline vẫn hoạt động bình thường
- [ ] Crash/lỗi JS được ghi nhận ở dashboard (Sentry hoặc tự host), kèm version + OS, không kèm đường dẫn chứa username thật — **Blocked: cần tài khoản Sentry/dịch vụ SaaS thật, bỏ qua trong lần triển khai này**
- [x] Mở app lần đầu trên máy sạch (chưa cấp quyền nào) → onboarding dẫn đúng thứ tự 4 quyền, giải thích rõ trước khi mỗi TCC prompt hiện ra
- [x] Recording đang mở dở project bị kill (force quit) → mở lại app phát hiện có project chưa lưu, hỏi khôi phục
- [x] Ổ đĩa còn <2GB → bấm Start Recording hiện cảnh báo trước, không chặn nếu người dùng vẫn muốn tiếp tục
- [x] Cmd+Q khi đang export → hỏi xác nhận trước khi thoát (không mất file đang xuất dở)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Đa ngôn ngữ / i18n | Cần trước khi mở rộng thị trường, nhưng không chặn việc ship cho người dùng đầu tiên; gộp vào Sprint 13 cùng accessibility vì cùng nhóm "reach" |
| Windows/Linux port | Kiến trúc hiện tại (Swift helpers) gắn chặt macOS; đổi platform là quyết định chiến lược riêng, không phải task kỹ thuật lẻ |
| Telemetry sản phẩm (analytics sử dụng tính năng nào) | Khác mục đích với crash reporting (US-101) — cân nhắc riêng khi có câu hỏi sản phẩm cụ thể cần trả lời bằng data |

Nguyên tắc: Sprint 6-11 đã xây rất nhiều tính năng, nhưng **không tính năng nào có giá trị nếu app crash mất dữ liệu hoặc không đến được tay người dùng**. Đây là sprint "đóng gói lại lòng tin".
