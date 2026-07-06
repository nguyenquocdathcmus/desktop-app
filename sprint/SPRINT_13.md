# Sprint 13 — Accessibility + Keyboard-First Editing + Localization Foundation

**Duration:** Week 45-48 (4 tuần)
**Goal:** Khảo sát xác nhận **0 file trong toàn bộ `src/renderer` có thuộc tính `aria-*` hoặc `role`** — app hiện không dùng được với VoiceOver, không có focus indicator nhất quán, và hầu hết thao tác chỉ làm được bằng chuột (kéo thả timeline, click nút nhỏ 24px). Sprint này làm app dùng được cho người dùng bàn phím/screen reader, đồng thời đặt nền móng i18n cho ngày mở rộng thị trường.
**Status:** ✅ Done (trừ US-109 Tab-to-select block — partial)

---

## Sprint Goal

> 3 quan sát dẫn tới sprint này:
>
> 1. **Zero accessibility là rủi ro pháp lý + rào cản thật.** Không chỉ là "nice to have" — nhiều tổ chức (giáo dục, chính phủ, doanh nghiệp lớn) yêu cầu WCAG compliance để mua phần mềm. App hiện không thể vượt qua bất kỳ audit accessibility cơ bản nào: không `aria-label` trên icon-only buttons (rất nhiều trong `RecordingControls.tsx`, `ExportModal.tsx`), không quản lý focus khi mở modal, contrast một số text-gray-600 trên nền tối có thể dưới ngưỡng AA.
> 2. **Editor gần như không dùng được bằng bàn phím.** Ngoại trừ `⌘Z`/`S` (Sprint 6/8) và `Tab` mặc định của trình duyệt, mọi thao tác chính — kéo trim handle, kéo zoom event, click vào segment — chỉ có chuột. Người dùng RSI/motor-impaired hoặc chỉ đơn giản thích bàn phím (phổ biến ở dev — đúng đối tượng dùng app này) không có đường thay thế.
> 3. **Không có hạ tầng dịch.** Mọi string đều hardcode tiếng Anh trong JSX. Trước khi nghĩ tới dịch ngôn ngữ nào, cần tách string ra khỏi component — làm sớm rẻ hơn làm muộn (mỗi component mới thêm sau này lại phải sửa lại).

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-107 | Audit + gắn `aria-label` cho toàn bộ icon-only button (RecordingControls, ExportModal, HomeScreen, Sidebar panels) — ưu tiên các nút hành động chính (Start/Stop/Export/Delete) | P0 | M | ✅ Done |
| US-108 | Focus management cho modal/overlay: `ExportModal` trap focus + return focus về trigger khi đóng, `Escape` đóng mọi modal nhất quán | P0 | S | ✅ Done |
| US-109 | Keyboard nav cho Timeline: `←/→` di chuyển playhead theo frame, `Shift+←/→` nhảy theo giây, `[`/`]` set in/out point tại playhead, `Tab` giữa các zoom/annotation/scene block để chọn và sửa bằng phím (Enter mở edit, Delete xoá) | P0 | L | 🟡 Partial — chỉ làm phần playhead + in/out point; Tab-to-select từng block chưa làm |
| US-110 | Visible focus indicator nhất quán: outline/ring rõ ràng cho mọi interactive element khi focus bằng bàn phím (không chỉ hover), tuân theo design system hiện có (indigo-500) | P0 | S | ✅ Done |
| US-111 | Contrast audit: kiểm tra toàn bộ text-gray-500/600/700 trên nền #141414/#1a1a1a bằng công cụ WCAG contrast checker, nâng cấp các cặp dưới AA (4.5:1 cho text thường) | P1 | S | ✅ Done |
| US-112 | Tách string UI ra khỏi component vào file `strings/en.ts`, thêm hook `useT()` đơn giản (không cần thư viện i18n nặng ở giai đoạn này) — chuẩn bị hạ tầng, chưa cần dịch ngôn ngữ thứ 2 | P1 | L | ✅ Done |
| US-113 | Screen reader announcement cho trạng thái động: export progress (`aria-live`), recording status change, silence detection xong — VoiceOver cần biết trạng thái thay đổi mà không cần nhìn | P1 | M | ✅ Done |
| US-114 | Reduced motion: tôn trọng `prefers-reduced-motion` — tắt/rút ngắn animation Framer Motion (countdown, fadeIn, transitions) khi hệ điều hành bật Reduce Motion | P2 | S | ✅ Done |
| US-115 | Command palette (`⌘K`): tìm nhanh mọi action (Export, Add Zoom, Add Text, Detect Silences...) bằng gõ tên — bổ sung hướng bàn phím-first cho power user | P2 | M | ✅ Done |

---

## Định hướng kỹ thuật

**Aria labels (US-107):**
- Grep toàn bộ `<button` không có text con rõ ràng (chỉ SVG/emoji) trong `RecordingControls.tsx`, `ExportModal.tsx`, `HomeScreen.tsx`, các Sidebar panel — thêm `aria-label` mô tả hành động, không mô tả icon ("Delete recording" không phải "X icon").
- Input range (sliders) cần `aria-label` hoặc `aria-labelledby` trỏ tới label text hiện có.

**Focus trap (US-108):**
- Viết hook nhỏ `useFocusTrap(containerRef, active)` (không cần thư viện ngoài — modal ít, tự viết đủ): lưu `document.activeElement` trước khi mở, focus phần tử đầu tiên trong modal, cycle Tab bên trong, restore focus khi đóng.
- Áp cho `ExportModal` trước, các popover nhỏ (annotation/scene edit) sau nếu còn thời gian.

**Timeline keyboard nav (US-109) — story lớn nhất:**
- `Timeline.tsx` thêm `tabIndex={0}` cho track chính, xử lý `onKeyDown`: `ArrowLeft/Right` seek ±1 frame (`1/fps`), `Shift+Arrow` ±1s, `[`/`]` gọi `setInPoint`/`setOutPoint` tại `currentTime` hiện có sẵn.
- Chọn block (zoom/annotation/scene) bằng bàn phím: mỗi `*Track.tsx` component thêm `tabIndex` + `onFocus` set "selected block", `Enter` mở popover edit đã có sẵn (annotation/scene), `Delete`/`Backspace` gọi đúng `remove*` action đã tồn tại từ Sprint 8/9/11 — tái dùng toàn bộ, chỉ thêm lối vào bàn phím.

**Contrast audit (US-111):**
- Dùng công cụ kiểm contrast (WebAIM hoặc devtools), lập danh sách cặp fail, đổi `text-gray-600` → `text-gray-400` (hoặc tương đương đủ 4.5:1) ở nơi là nội dung chính; giữ nguyên ở nơi thực sự là decorative/disabled (không bắt buộc theo WCAG).

**i18n foundation (US-112):**
- KHÔNG kéo `react-i18next`/`formatjs` vào ở giai đoạn này — quá nặng cho nhu cầu hiện tại (1 ngôn ngữ). Viết `strings/en.ts` dạng object phẳng + hook `useT()` trả về hàm tra cứu, chỉ để tách nội dung khỏi JSX. Khi thực sự cần ngôn ngữ 2, đổi sang thư viện thật là refactor nhỏ vì mọi chỗ đã đi qua `useT()`.

**Live regions (US-113):**
- `aria-live="polite"` cho export progress %, `aria-live="assertive"` cho lỗi/hoàn thành recording — dùng `<span className="sr-only">` ẩn về mặt hình ảnh nhưng đọc được bởi screen reader.

---

## Definition of Done

- [x] Chạy VoiceOver (⌘F5) qua toàn bộ flow chính (record → edit → export) — mọi nút bấm được đọc tên rõ nghĩa, không còn "button" trống
- [x] Mở ExportModal bằng phím, Tab không thoát ra ngoài modal, Escape đóng và focus quay lại đúng nút Export đã mở nó
- [x] Di chuyển playhead theo frame/giây và set in/out point chỉ bằng bàn phím (`←/→`, `Shift+←/→`, `[`/`]`, `S` để split)
- [ ] Chọn và sửa/xoá 1 zoom/annotation/scene block bằng `Tab`+`Enter`/`Delete` — **chưa làm, để lại cho lần sau** (mỗi `*Track.tsx` cần thêm `tabIndex` + state "block đang chọn" — việc riêng, không nằm trong thời lượng lần triển khai này)
- [x] Mọi interactive element hiện focus ring rõ ràng khi Tab tới (kiểm tra bằng bàn phím thực tế, không chỉ devtools `:focus`)
- [x] Công cụ contrast checker không còn cặp text-chính/nền nào dưới 4.5:1
- [x] Toàn bộ string trong ít nhất 3 component chính (RecordingControls, ExportModal, Timeline) đi qua `useT()`, không hardcode literal tiếng Anh trong JSX của các file đó
- [x] Bật Reduce Motion trong System Settings → animation trong app rút ngắn/tắt tương ứng, không còn spring bounce mạnh
- [x] `⌘K` mở command palette, gõ "export" tìm thấy action Export và thực thi đúng

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Dịch đầy đủ sang tiếng Việt/ngôn ngữ khác | US-112 chỉ làm hạ tầng — dịch thật cần quyết định thị trường mục tiêu trước, không nên đoán |
| Voice control / dictation cho annotation text | Ngoài phạm vi accessibility chuẩn (WCAG), thuộc nhóm "power feature" khác |
| High-contrast theme riêng | Contrast audit (US-111) nâng chuẩn nền hiện có lên AA là đủ cho phần lớn nhu cầu; theme riêng là công sức lớn hơn nhiều so với giá trị tăng thêm |

Sprint 12 làm app "tin được", Sprint 13 làm app "ai cũng dùng được" — cả hai đều không phải tính năng "wow" nhưng là điều kiện cần để sản phẩm trưởng thành vượt ra khỏi giai đoạn demo cá nhân.
