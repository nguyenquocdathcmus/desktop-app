# Sprint 23 — QuickTime-Style Recording UI & Recorder Ergonomics

**Duration:** Week 85-88 (4 tuần)
**Goal:** `RecordingControls.tsx` hiện là một panel cố định 380×452 luôn hiển thị đầy đủ source picker + device menus, kể cả khi đang ghi — khác hẳn quy ước macOS quen thuộc (QuickTime Player) nơi cửa sổ thu gọn thành 1 pill nhỏ nổi góc màn hình khi ghi, chỉ hiện lại panel đầy đủ khi cần đổi thiết lập. Sprint này (bắt đầu từ redesign đã triển khai trực tiếp — pill collapse/expand, nút stop/pause hình học đúng chuẩn QuickTime, cửa sổ tự di chuyển/resize) mở rộng thêm phần ergonomics còn thiếu: kéo pill tự do, ghim vị trí, và menu bar equivalent.
**Status:** ✅ Done (US-178/179/180; US-181/182 deferred — polish, xem ghi chú)

---

## Sprint Goal

> Bản redesign ban đầu (thực hiện cùng đợt với sprint này) giải quyết đúng khung nhìn chính: panel ↔ pill tự động chuyển theo trạng thái ghi, nút stop (hình vuông đỏ) + pause/resume (hình học chuẩn) + timer trong pill, chevron mở lại panel. Còn 3 khoảng trống ergonomics thực tế khi dùng hàng ngày:
>
> 1. **Pill luôn cố định giữa-trên màn hình** — QuickTime cho phép kéo pill tới bất kỳ đâu (thường góc trên-phải cạnh menu bar) và nhớ vị trí lần sau.
> 2. **Không có menu bar item** — QuickTime luôn có icon record trên menu bar ngay cả khi cửa sổ chính đóng; app hiện tại phải mở cửa sổ controls thủ công mỗi lần.
> 3. **Không có phím tắt global để start/stop** — nhiều đối thủ (CleanShot, Loom) cho phép bấm tổ hợp phím bất kỳ lúc nào không cần focus app.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-178 | Pill kéo tự do + nhớ vị trí: cho phép kéo pill tới vị trí bất kỳ trên màn hình (không giới hạn giữa-trên), lưu toạ độ cuối cùng vào user preferences, khôi phục đúng vị trí (kẹp vào workArea nếu display đổi độ phân giải) lần ghi tiếp theo | P0 | S | ✅ Done — `pillPosition.ts`, `moved` listener debounced 300ms trong `index.ts` |
| US-179 | Menu bar icon thường trực (macOS status bar / `Tray`): click mở panel, click phải hiện menu nhanh (Start Recording, đổi display gần nhất dùng, Preferences) — icon đổi trạng thái (chấm đỏ) khi đang ghi | P0 | M | ✅ Done — `tray.ts` + `trayIcon.ts` (vẽ RGBA buffer trực tiếp, template image, không cần asset pipeline mới); menu đơn giản hoá còn Start/Stop + Open + Quit (bỏ "đổi display gần nhất" — quá phức tạp so với giá trị, xem ghi chú) |
| US-180 | Global keyboard shortcut start/stop recording (Electron `globalShortcut`), tuỳ chỉnh được trong Settings, mặc định gợi ý không đụng tổ hợp hệ thống phổ biến | P1 | S | ✅ Done — không đặt mặc định (an toàn hơn tránh trùng shortcut khác), UI ghi phím trực tiếp trong `SettingsPanel.tsx`, verify registration thành công/thất bại thật qua `globalShortcut.register` return value |
| US-181 | Pill hiện preview mini khi hover (giống QuickTime hiện waveform âm thanh khi ghi có mic) — optional visual feedback cho biết đang thu âm | P2 | S | 🔲 Deferred — polish, để sprint sau |
| US-182 | Áp dụng đúng `vibrancy`/backdrop material của macOS cho cả pill và panel (thay vì màu nền phẳng `#1c1c1e`/`#232326`) để hoà đúng ngôn ngữ hệ thống, dùng `BrowserWindow` `vibrancy: 'hud'` hoặc tương đương | P2 | M | 🔲 Deferred — polish, để sprint sau |

---

## Định hướng kỹ thuật

**Pill drag + nhớ vị trí (US-178):**
- Pill window đã `alwaysOnTop` + kéo được qua `WebkitAppRegion: 'drag'` (có sẵn) — chỉ cần bắt sự kiện `moved` trên `controlsWindow` trong main, lưu `{x, y}` vào cùng file preferences JSON đã dùng cho các setting khác (không phải secret, không cần `safeStorage`).
- Khi khôi phục vị trí, luôn clamp vào `workArea` của display gần nhất — tránh trường hợp user tắt màn hình phụ rồi mở lại app, pill biến mất ngoài vùng nhìn thấy.

**Menu bar icon (US-179):**
- `Tray` API của Electron, icon template (tự đổi theo dark/light menu bar macOS) — đặt tại `src/main/tray.ts` mới, khởi tạo trong `app.whenReady()`.
- Click trái: show/focus `controlsWindow`. Click phải: `Menu.buildFromTemplate` với action nhanh, tái dùng trực tiếp state hiện có (`useRecordingStore` không truy cập được từ main — cần IPC round-trip nhỏ để main biết trạng thái ghi hiện tại, hiện đã có qua `RecordingSession` state machine).

**Global shortcut (US-180):**
- `globalShortcut.register` trong main, gửi IPC `recording:toggle-shortcut` tới `controlsWindow` — validate không trùng shortcut hệ thống (Cmd+Shift+5 macOS screenshot, ví dụ) trước khi cho phép đặt.

---

## Definition of Done

- [ ] Kéo pill tới góc bất kỳ → dừng ghi, ghi lại lần sau → pill xuất hiện đúng vị trí đã kéo (hoặc clamp hợp lý nếu display đổi)
- [ ] Menu bar icon hiện thường trực, đổi biểu tượng khi đang ghi, click mở đúng panel/pill theo đúng trạng thái hiện tại
- [ ] Global shortcut start/stop hoạt động khi app không phải cửa sổ đang focus
- [ ] `vibrancy` áp dụng đúng, không vỡ layout hiện tại trên cả light/dark system theme

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Redesign lại toàn bộ device-picker UX (không chỉ hình dạng cửa sổ) | Ngoài phạm vi "giống QuickTime" ban đầu user yêu cầu — thay đổi quá nhiều thói quen dùng đã quen thuộc từ Sprint 1 |
| Windows-style system tray thay vì macOS `Tray`/menu bar | App hiện tại chỉ nhắm macOS (ScreenCaptureKit, Swift helpers) — ưu tiên đúng nền tảng hiện có, xem thêm Sprint 26 nếu port Windows |
