# Sprint 17 — Discoverability: Shortcuts Overlay, Contextual Tips, and a Real Onboarding Tour

**Duration:** Week 61-64 (4 tuần)
**Goal:** Sau 10+ sprint tính năng, app giờ có ⌘Z, `S` để split, `⌘K` (Sprint 13), kéo-thả trên nhiều track, click-to-cycle layout scene, click-to-toggle silence region — nhưng **không nơi nào liệt kê hết chúng**. Khảo sát xác nhận mỗi shortcut chỉ tồn tại dưới dạng tooltip rời rạc tại đúng chỗ nó dùng — không bảng tra cứu, không cách nào biết tính năng tồn tại trừ khi tình cờ hover đúng chỗ. Sprint này xây lớp "người dùng biết app có gì" cho toàn bộ những gì đã xây.
**Status:** ✅ Done (US-144 🟡 Partial — shared `<Tooltip>` skipped, see notes)

---

## Sprint Goal

> Đây là hệ quả tích luỹ, không phải lỗi của 1 sprint cụ thể: mỗi sprint (6 → 16) đều thêm đúng 1-2 tương tác mới theo đúng nguyên tắc "giá trị thật, không phải trang trí" — nhưng không sprint nào có nhiệm vụ "giúp người dùng *tìm ra* các tương tác đã cộng dồn". Kết quả sau 16 sprint: một người dùng mới mở app lần đầu (kể cả sau onboarding permission của Sprint 12) hoàn toàn không biết:
> - Có thể bấm `S` để split thay vì tìm nút
> - Silence detection tồn tại (nút nhỏ ẩn dưới waveform, chỉ hiện khi chưa detect)
> - Zoom event thủ công kéo được center trên preview (nút "Re-pan center" chỉ hiện khi playhead đúng trong 1 manual zoom event)
> - Scene layout đổi bằng cách *click vào block* (không có label "click to cycle" rõ ràng ở lần đầu nhìn thấy)
> - `⌘K` command palette tồn tại
>
> Đây chính là khoảng cách giữa "tính năng tồn tại" và "tính năng được dùng" — không có dữ liệu (chưa có analytics, xem Sprint 18) nhưng suy luận hợp lý: một tính năng ẩn sau hover-only tooltip sẽ có tỷ lệ dùng thấp hơn nhiều so với tiềm năng thật của nó.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-138 | Shortcuts overlay (`⌘/` hoặc nút "?" góc màn hình): bảng liệt kê toàn bộ phím tắt hiện có theo nhóm (Playback, Editing, Timeline, Export) — nội dung lấy từ cùng 1 nguồn dữ liệu duy nhất mà `⌘K` command palette (Sprint 13) đã dùng, tránh 2 nơi liệt kê lệch nhau | P0 | M | ✅ Done |
| US-139 | Contextual first-use hints: lần đầu 1 tính năng khả dụng xuất hiện trên màn hình (VD: lần đầu có ≥2 zoom event chồng lấn, lần đầu webcam được bật, lần đầu video dài >10 phút), hiện gợi ý nhỏ 1 lần duy nhất (dismissible, không lặp lại) — không phải tour ép buộc, chỉ "bạn có biết" đúng lúc liên quan | P0 | L | ✅ Done |
| US-140 | Interactive tour cho editor lần đầu mở (khác onboarding permission Sprint 12 — đây là tour *tính năng*, không phải *quyền*): 5-6 bước highlight Timeline/Sidebar/ExportModal, có thể bỏ qua và xem lại sau qua menu Help | P0 | L | ✅ Done |
| US-141 | "What's new" panel: sau khi auto-update (Sprint 12) cài bản mới, hiện tóm tắt ngắn tính năng mới của version đó — nội dung lấy từ changelog có cấu trúc, không phải full release notes kỹ thuật | P1 | M | ✅ Done |
| US-142 | Empty-state nâng cấp: thay vì chỉ text tĩnh, các khu vực trống (0 zoom event, 0 annotation, 0 scene) gợi ý hành động cụ thể kèm phím tắt ("Nhấn + Zoom hoặc kéo trên preview khi đang phát") | P1 | S | ✅ Done |
| US-143 | Help menu chuẩn macOS: mục "Keyboard Shortcuts" (mở US-138), "Show Tour Again" (mở US-140), "Report an Issue" (đã có từ Sprint 12 US-103, chỉ cần gom vào đúng menu) | P2 | S | ✅ Done |
| US-144 | Tooltip nhất quán: audit toàn bộ tooltip hiện có (rất nhiều, style khác nhau tuỳ component), chuẩn hoá thành 1 component `<Tooltip>` dùng chung — vừa nhất quán UI vừa dễ maintain khi thêm tooltip mới | P2 | S | 🟡 Partial |

---

## Định hướng kỹ thuật

**Nguồn dữ liệu shortcut duy nhất (US-138):**
- Trước sprint này, mỗi keydown handler (ControlBar ⌘Z, Timeline S, v.v.) tự định nghĩa rời rạc. Tạo `src/shared/shortcuts.ts`: mảng `{ id, keys, label, group, action }` — cả `⌘K` palette (Sprint 13) lẫn overlay `⌘/` mới đều render từ đây, và các component thực thi hành động cũng gọi qua registry này thay vì duplicate logic `onKeyDown` rời rạc. Đây là refactor nhỏ nhưng ngăn 2 nguồn sự thật lệch nhau về sau.

**Contextual hints (US-139):**
- Store nhỏ `useHintsStore`: `dismissedHints: Set<string>` lưu `userData/hints.json`. Component kiểm tra điều kiện kích hoạt (VD: `zoomEvents.filter(overlap).length >= 2 && !dismissed('overlap-zoom-hint')`) → hiện toast/popover 1 lần, bấm X hoặc tự hết sau vài giây → ghi vào dismissed, không hiện lại bao giờ (kể cả project khác).
- Danh sách hint ban đầu (không cần nhiều, chất lượng hơn số lượng): silence detection tồn tại, manual zoom re-pan, scene layout click-to-cycle, `⌘K` tồn tại.

**Tour (US-140):**
- Thư viện nhẹ tự viết (không cần kéo `react-joyride` nếu overlay đơn giản: dimmed backdrop + spotlight quanh 1 ref + tooltip mô tả + nút Next/Skip) — 5-6 bước cố định, lưu trạng thái "đã xem" giống US-139.
- Trigger: lần đầu Editor mở với 1 project thật (không phải lần đầu mở app — đó là onboarding permission Sprint 12).

**What's New (US-141):**
- File `CHANGELOG.md`có cấu trúc hoặc `changelog.json` đơn giản theo version, main process so sánh version đã lưu vs version hiện tại lúc khởi động, hiện panel nếu có bản ghi cho version mới.

---

## Definition of Done

- [x] `⌘/` mở bảng shortcut đầy đủ, nhóm rõ ràng, khớp 100% với danh sách trong `⌘K` — `ShortcutsOverlay.tsx` đọc trực tiếp từ `commands.ts` (cùng registry với `CommandPalette.tsx`), chỉ thêm 1 field `keys?` vào `Command` thay vì tạo file `shortcuts.ts` song song
- [x] Bật webcam lần đầu trong 1 project → hint xuất hiện đúng 1 lần gợi ý scene layout, không hiện lại ở project sau — `Hint id="scene-layout-cycle"` trong `Timeline.tsx`, dismissal lưu ở `dismissed-hints.json` trong `userData` (global, không theo project)
- [x] Mở Editor lần đầu (project đầu tiên sau khi cài) → tour tự động chạy, Skip hoạt động, "Show Tour Again" trong Help menu mở lại đúng tour đó bất kỳ lúc nào — `FeatureTour.tsx`, trigger qua `app:restart-tour` IPC từ menu Help
- [x] Sau auto-update, panel "What's New" hiện đúng 1 lần cho version vừa cài, không hiện lại khi mở app lần sau — `WhatsNewPanel.tsx` + `CHANGELOG` map trong `app-handlers.ts`, ack theo version vào `changelog-seen.flag`
- [x] Mọi khu vực trống có gợi ý hành động cụ thể kèm phím tắt — nâng cấp `ZoomPanel.tsx`; các track khác (Preset/Template/HomeScreen) đã có sẵn text tham chiếu hành động cụ thể từ trước, không cần sửa
- [ ] Toàn bộ tooltip dùng chung 1 component — **không làm**, xem "Vì sao chọn" bên dưới: audit thấy 60 chỗ dùng `title=` rải khắp app, retrofit toàn bộ là chi phí lớn cho lợi ích thẩm mỹ nhỏ so với 1 P2/S story; native `title=` vẫn accessible và nhất quán ở mức trình duyệt

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Video hướng dẫn nhúng trong app (embedded tutorial video) | Chi phí sản xuất nội dung cao, cần duy trì khi UI đổi; text/spotlight tour rẻ hơn và tự động khớp với UI thật |
| A/B test các biến thể onboarding | Cần hạ tầng analytics (Sprint 18) và số lượng người dùng đủ lớn để có ý nghĩa thống kê — chưa tới lúc |
| Gamification (badge, huy hiệu khi dùng đủ tính năng) | Không phù hợp với đối tượng người dùng chính (dev/creator làm việc nghiêm túc), rủi ro cảm giác "trẻ con hoá" sản phẩm |
| Retrofit toàn bộ 60 chỗ `title=` thành `<Tooltip>` chung (US-144) | Audit thực tế cho thấy quy mô sửa lớn (60 vị trí rải khắp app) so với lợi ích thẩm mỹ nhỏ của 1 story P2/Size-S; `title=` native đã accessible và hoạt động đúng — không đáng đánh đổi rủi ro regression trên diện rộng |

Sprint 17 là "sản phẩm nói cho chính nó nghe" — không thêm khả năng mới, chỉ đảm bảo 10 sprint khả năng đã xây trước đó thực sự được nhìn thấy và dùng tới.
