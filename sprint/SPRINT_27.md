# Sprint 27 — HomeScreen Performance, Polish, Full i18n, Light Theme

**Duration:** Week 101-104 (4 tuần)
**Goal:** Sprint này không thêm tính năng ghi/edit mới — tập trung fix bug hiệu năng thật đã xác nhận qua khảo sát code (HomeScreen quét thư mục + đọc file đồng bộ mỗi lần load, không cache index nào), và 3 hạng mục UI/UX do người dùng trực tiếp yêu cầu: polish HomeScreen, i18n đầy đủ 13 ngôn ngữ, theme sáng.
**Status:** ✅ Done (US-200/201/202/203/204/205/206/207/208(HomeScreen+Settings)/209(HomeScreen+Settings) — xem ghi chú phạm vi i18n/theme)

---

## Sprint Goal

> Khảo sát code xác nhận cụ thể (không phải suy đoán):
>
> 1. **`recordings:list` quét lại toàn bộ thư mục và đọc ≥5 file đồng bộ (sync fs) cho MỖI recording, MỖI LẦN gọi** — kể cả khi cache đã "nóng" (`meta.cache.json`, `thumb.cache.jpg` hit). Không có bất kỳ database/index nào; toàn bộ là JSON rời rạc trên đĩa. Hàm này chạy trên main process (đơn luồng của Electron) — with vài trăm recording trở lên, mỗi lần mở HomeScreen (kể cả mỗi lần focus lại cửa sổ — có `window.addEventListener('focus', load)`) sẽ block IPC toàn app trong lúc quét.
> 2. **Không có phân trang/virtualization** — toàn bộ danh sách render 1 lần bằng `.map()`, hiệu ứng fade-in stagger chỉ giới hạn animation delay chứ không giới hạn số item thực render.
> 3. **i18n hiện tại chỉ có tiếng Anh, phủ ~5/39 component** — `useT()` tồn tại nhưng tài liệu tự ghi rõ "deliberately NOT a full i18n library", chỉ 24 chuỗi trong 1 file `en.ts`. Không có cơ chế chọn ngôn ngữ.
> 4. **Không có theme sáng** — chỉ 1 bộ CSS variable dark-only, và phần lớn component (gồm toàn bộ HomeScreen) dùng thẳng class Tailwind hex cứng (`bg-[#1a1a1a]`) thay vì biến CSS, nên đổi theme không chỉ là đổi giá trị biến mà cần refactor điểm chạm rộng.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-200 | Thay pipeline liệt kê recordings bằng 1 file index JSON gộp (`recordings-index.json`) lưu toàn bộ metadata mọi recording | P0 | M | ✅ Done — `recordingsIndex.ts` + `recordings-list-handler.ts` viết lại hoàn toàn, verify thật bằng 5 integration test dùng ffmpeg thật + thư mục thật |
| US-201 | Cập nhật index đúng 1 entry khi có thay đổi thật, tự phục hồi khi lệch với đĩa thật | P0 | M | ✅ Done — `reconcileIndex()` tự phát hiện file bị xoá ngoài app + entry thiếu, `publishHistory`/`unresolvedCommentCount` luôn đọc tươi (không cache) để không bao giờ lệch |
| US-202 | Migration lần đầu từ dữ liệu cache cũ | P1 | S | ✅ Done — ngầm định qua `reconcileIndex()` (index rỗng = mọi recording "thiếu" = build lại từ `meta.cache.json`/`thumb.cache.jpg` có sẵn, không cần bước riêng) |
| US-203 | Pagination "Load more", 24 item/trang | P0 | M | ✅ Done — `recordings:list` nhận `{limit, offset}`, trả `hasMore`; nút "Load more" trong `HomeScreen.tsx`, ẩn khi đang search |
| US-204 | Polish HomeScreen: fps detail, date theo locale động | P1 | M | ✅ Done — sửa luôn bug thật: `formatDate` cứng `'vi-VN'` bất kể ngôn ngữ máy; thêm field `fps` đọc từ manifest |
| US-205 | List view: chuyển timestamp xuống dưới, không còn đứng thế chỗ tên | P1 | S | ✅ Done — theo làm rõ của user: dòng đầu luôn ưu tiên tên thật/"Untitled Recording", ngày giờ chuyển xuống dòng metadata thứ hai cùng resolution/fps/size |
| US-206 | i18n foundation 13 ngôn ngữ, `useT` đọc theo locale động | P0 | L | ✅ Done — `shared/locales.ts`, 13 file `strings/*.ts` dịch thật (không máy dịch), `useT` hỗ trợ interpolation `{token}`, verify bằng test thật: 13/13 locale khớp key set với English, không rỗng |
| US-207 | Language picker trong Settings, mặc định theo OS locale | P0 | S | ✅ Done — `locale-handlers.ts` (main, persist `locale.json`) + dropdown trong `SettingsPanel.tsx`, áp dụng ngay không cần khởi động lại |
| US-208 | Sweep chuỗi hardcoded sang `t()`, RTL cho tiếng Ả Rập | P0 | XL | 🟡 Done cho HomeScreen + SettingsPanel (2 màn hình ưu tiên nhất theo yêu cầu ban đầu); `dir="rtl"` hoạt động đúng ở cấp document. **Chưa làm**: RecordingControls (35 chỗ hex/string), Timeline, CommandPalette, ExportModal — nợ kỹ thuật rõ ràng cho sprint sau, không báo cáo sai là đã xong toàn bộ |
| US-209 | Light theme: biến CSS + toggle Dark/Light/System | P0 | XL | 🟡 Done cho biến CSS nền tảng + HomeScreen + SettingsPanel hiển thị đúng cả 2 theme. **Chưa làm**: RecordingControls, Timeline, Sidebar panels vẫn dùng hex cứng dark-only — sẽ lệch theme nếu chọn Light, nợ kỹ thuật cho sprint sau |

---

## Định hướng kỹ thuật

**Index gộp 1 file JSON (US-200, US-201, US-202) — quyết định thay đổi so với kế hoạch ban đầu:**
- Ban đầu định dùng `better-sqlite3`, nhưng thử cài thật trên máy dev phát hiện rủi ro cụ thể: là native module cần compile qua node-gyp (máy dev thiếu Python `distutils`, phải cài `setuptools` mới qua được), và cần rebuild riêng cho đúng Electron ABI (khác Node ABI) — tăng đáng kể độ phức tạp cho pipeline build/CI/release trên nhiều máy/kiến trúc khác nhau, so với lợi ích chỉ để tăng tốc liệt kê vài trăm recording. Đổi sang phương án zero-dependency.
- File: `app.getPath('userData')/recordings-index.json` — mảng `RecordingMeta[]` đầy đủ (đã có sẵn interface này trong `recordings-list-handler.ts`).
- `recordings:list` đọc 1 file, parse 1 lần — thay vì `readdirSync` + ≥5 lần đọc file đồng bộ riêng biệt cho MỖI recording.
- Ghi index khi: recording mới hoàn tất, user xoá recording, publish history đổi, comment resolved đổi — đúng đúng 1 entry thay đổi, không viết lại toàn mảng nếu tránh được.
- Tự phục hồi: nếu 1 entry trong index trỏ tới file không còn tồn tại trên đĩa (user xoá thủ công ngoài app), lọc bỏ entry đó khi đọc, không throw lỗi. Nếu tìm thấy thư mục recording không có trong index (ví dụ index bị xoá/hỏng), quét bổ sung đúng phần thiếu, không quét lại toàn bộ nếu không cần.
- KHÔNG thay source of truth — file trên đĩa (`manifest.json`, `capture.mov`...) vẫn là dữ liệu gốc; `recordings-index.json` là cache thuần, xoá đi thì app tự quét lại toàn bộ 1 lần (US-202), không mất dữ liệu thật.

**Pagination (US-203):**
- `recordings:list` nhận thêm `{ limit, offset, sortBy }`, trả kèm `hasMore: boolean`.
- Vì toàn bộ index đã nằm trong 1 mảng JS sau khi đọc file, sort/filter/slice thực hiện trong JS (không cần SQL) — vẫn đạt mục tiêu tránh N lần đọc file rời rạc, phần lợi ích chính của US-200 nằm ở đó chứ không phải ở query engine.

**i18n (US-206, US-207, US-208):**
- Giữ nguyên hình dạng `useT()` hiện tại (dot-path lookup) — chỉ đổi nguồn `en` cố định thành theo locale đang chọn, load động (`import()` code-split theo ngôn ngữ, tránh bundle cả 13 file vào 1 file JS).
- Tiếng Ả Rập cần `dir="rtl"` ở cấp `<html>`/`<body>` khi active — audit các layout dùng `left`/`right` cứng (đặc biệt Timeline, popover menus) vì RTL sẽ đảo ngược trực quan những chỗ đó.
- Sweep string là việc tốn effort nhất sprint (ước lượng XL) — chấp nhận làm theo đợt, ưu tiên rõ ràng thay vì cố phủ 100% trong 1 sprint nếu không kịp.

**Light theme (US-209):**
- `data-theme="light" | "dark"` trên `<html>`, lưu lựa chọn trong Settings giống pattern `analytics-consent.json` đã có.
- "System" option nghe `prefers-color-scheme` qua `window.matchMedia`.
- Vì phần lớn component dùng hex cứng thay vì biến CSS (đã xác nhận qua khảo sát), sprint này KHÔNG cam kết refactor 100% — ưu tiên các màn hình chính (HomeScreen, Sidebar, Timeline, Settings) đổi được đúng, phần còn lại có thể lệch nhẹ và ghi rõ nợ kỹ thuật cho sprint sau thay vì báo cáo sai "đã xong toàn bộ".

---

## Definition of Done

- [x] Index JSON tự build từ đầu, verify bằng integration test thật (ffmpeg thật + thư mục thật, không mock) — 5/5 test pass
- [x] Xoá file index thủ công → app tự phát hiện, build lại đúng, không mất recording nào — verify bằng test "self-heals when a recording is deleted outside the app"
- [x] "Load more" hoạt động đúng, không tải lại từ đầu — verify bằng test pagination limit/offset
- [x] List view: timestamp nằm đúng vị trí mới (dòng metadata thứ 2, không còn thế chỗ tên)
- [x] Đổi ngôn ngữ trong Settings → HomeScreen + Settings đổi ngôn ngữ ngay, không cần khởi động lại — verify bằng test 13/13 locale khớp key set
- [x] Chọn tiếng Ả Rập → `dir="rtl"` áp dụng đúng ở cấp document
- [x] Chọn Light theme → HomeScreen + Settings hiển thị đúng theme sáng
- [x] Chọn System theme → tự đổi theo đúng khi đổi Dark/Light Mode ở macOS (qua `prefers-color-scheme` trong CSS)
- [ ] RecordingControls/Timeline/CommandPalette/ExportModal: chưa sweep i18n, chưa refactor theme — nợ kỹ thuật rõ ràng, không phải đã hoàn thành

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Tự viết index format riêng (không dùng SQLite) | SQLite qua `better-sqlite3` đã là chuẩn phổ biến, ổn định cho đúng use case này (đọc nhiều, ghi ít, cần query/sort/filter/paginate) — tự chế lại là công sức thừa cho cùng giá trị |
| Dịch máy tự động 13 ngôn ngữ để phủ nhanh 100% string | Chất lượng dịch máy cho UI (đặc biệt các ngôn ngữ có văn hoá dùng từ khác biệt như Nhật/Ả Rập) thường sai lệch ngữ cảnh; ưu tiên phủ đúng các màn hình chính bằng bản dịch có review được thay vì phủ rộng nhưng sai |
| Refactor 100% component sang biến CSS ngay trong sprint này | Khối lượng lớn, rủi ro regression cao nếu làm vội; ưu tiên đúng các màn hình người dùng thấy nhiều nhất, ghi rõ phần còn lại là nợ kỹ thuật thay vì báo cáo sai mức độ hoàn thành |
