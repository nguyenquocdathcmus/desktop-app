# Sprint 10 — Synthetic Cursor + Style Presets + Publish Workflow

**Duration:** Week 33-36 (4 tuần)
**Goal:** Ba trụ cột: (1) **cursor tổng hợp** — quay màn hình KHÔNG kèm cursor, vẽ lại cursor từ dữ liệu tracking → cursor phóng to được, mượt hơn, ẩn được (đây là bí quyết làm video Screen Studio thật "mượt" khác hẳn QuickTime); (2) **style presets** — lưu toàn bộ style (background/padding/cursor/frame) thành preset tái sử dụng, ai làm nhiều video đều cần sự nhất quán; (3) **publish nhanh** — đặt tên recording, xuất nhiều định dạng 1 click, kéo file thẳng ra Slack/Finder.
**Status:** ✅ Done

---

## Sprint Goal

> Tiếp nối nguyên tắc Sprint 9 (giá trị thật trên mỗi video người dùng làm), Sprint 10 nhắm vào 3 quan sát từ code + sản phẩm:
>
> 1. **Cursor đang bị "nướng cứng" vào video.** Đã kiểm tra `swift/capture/main.swift`: `SCStreamConfiguration.showsCursor` không được set (mặc định `true`) — cursor hệ thống nằm luôn trong pixel của capture.mov. Hệ quả: không thể phóng to cursor (video tutorial trên màn Retina cursor bé tí), không thể làm mượt chuyển động cursor thật (chỉ smooth được overlay highlight), không thể ẩn cursor. Trong khi đó **toàn bộ dữ liệu vị trí cursor đã được ghi ở 60fps vào cursor.json từ Sprint 2** — tắt `showsCursor` đi và tự vẽ cursor từ data là con đường Screen Studio thật đã đi, và là nâng cấp chất lượng hình ảnh lớn nhất còn lại. Tin tốt đã xác minh: ffmpeg bundle build với `--enable-libass` → có thể render cursor chuyển động mượt trong export bằng ASS subtitle track (`\move` interpolation) thay vì phải dựng hàng nghìn nhánh expression.
> 2. **Người làm video định kỳ phải chỉnh lại style mỗi lần.** Mỗi recording mới đều reset về `DEFAULT_PROJECT_STATE` — người làm series tutorial phải chỉnh lại background/padding/cursor settings y hệt nhau video này qua video khác. Preset = làm 1 lần, dùng mãi.
> 3. **Từ "export xong" đến "gửi được cho người khác" vẫn nhiều bước.** Recordings không có tên (search Sprint 7 chỉ lọc được theo ngày vì không có gì khác để lọc); muốn cả bản 16:9 + 9:16 + GIF phải export 3 lần ngồi chờ; muốn gửi file phải mở Finder tìm rồi kéo. Ba fix nhỏ, cộng lại đáng kể.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-080 | Capture không kèm cursor: set `showsCursor = false` trong capture binary (kèm flag `--show-cursor` để giữ hành vi cũ làm fallback), preview vẽ cursor ảo từ cursor.json tại đúng vị trí/thời điểm | P0 | L | ✅ Done |
| US-081 | Render cursor ảo trong export: sinh file ASS subtitle từ cursor.json (mỗi cặp sample là 1 event `\move` — libass nội suy vị trí), overlay qua filter `ass=` (đã xác minh ffmpeg bundle có `--enable-libass`) | P0 | L | ✅ Done |
| US-082 | Cursor style options: slider kích thước (1×–3×), ẩn cursor hoàn toàn, tăng độ smooth (moving-average window) — áp dụng cho cả preview lẫn export vì giờ cursor là synthetic | P0 | M | ✅ Done |
| US-083 | Style presets: nút "Save as preset" lưu `{ background, padding, cornerRadius, cursorSettings, deviceFrame }` vào app data; picker preset trong sidebar; chọn "default preset" tự áp cho mọi recording mới | P0 | M | ✅ Done |
| US-084 | Đặt tên recording: field `title` trong meta cache, sửa được từ HomeScreen (double-click) và Editor header; search Sprint 7 lọc được theo tên thật thay vì chỉ ngày/id | P1 | S | ✅ Done |
| US-085 | Batch export: chọn nhiều target trong ExportModal (VD: MP4 16:9 + MP4 9:16 + GIF) → chạy tuần tự 1 click, progress theo từng target, tên file có hậu tố (`-vertical`, `.gif`) | P1 | M | ✅ Done |
| US-086 | Quick share: sau khi export xong — nút "Copy file" (file vào clipboard, paste thẳng vào Slack/iMessage) và icon kéo-thả file ra ngoài app (Electron `startDrag`) | P1 | S | ✅ Done |
| US-087 | Click sound effects: toggle thêm âm "click" nhẹ tại mỗi click event trong export (mix qua `amix` với file WAV bundle) — tăng cảm giác "alive" cho video demo không lời | P2 | S | ✅ Done |
| US-088 | [Experiment] Motion blur khi zoom chuyển cảnh: thử `minterpolate`/`tblend` chỉ trong các cửa sổ transition (`enable='between(t,...)'`), đo tốc độ export — nếu chậm >3× thì dừng và ghi lại kết luận, không ship | P2 | M | ✅ Done (không ship — xem kết luận) |

---

## Định hướng kỹ thuật

**Synthetic cursor — capture (US-080):**
- `main.swift`: `config.showsCursor = false` mặc định; thêm arg `--show-cursor` bật lại (an toàn khi cursor-tracker thiếu Accessibility permission — RecordingSession tự fallback về baked cursor nếu không có cursor.json).
- Preview (`PreviewCanvas.tsx`): đã có `cursorPos` (binary search theo thời gian) dùng cho highlight — vẽ thêm ảnh cursor (SVG arrow chuẩn macOS, bundle sẵn) tại vị trí đó, scale theo `cursorSettings.size`. Áp smoothing hiện có (`CursorSmoother` moving average) lên vị trí trước khi vẽ.
- Đồng bộ thời gian: cursor.json timestamps là epoch ms, video bắt đầu tại `manifest.createdAt` — logic normalize đã có sẵn trong `cursorAtTime`, tái dùng.

**Synthetic cursor — export (US-081):**
- Route chính: **ASS subtitle track**. Sinh file `.ass` tạm: mỗi cặp sample cursor liên tiếp (downsample còn ~20Hz sau smoothing) thành 1 Dialogue event `{\move(x1,y1,x2,y2)}` + glyph cursor bằng ASS vector drawing (`{\p1}m 0 0 l ...`) hoặc ký tự ➤ xoay. Overlay bằng filter `ass=cursor.ass` sau bước zoompan (toạ độ phải nhân theo scale/zoom — nếu phức tạp quá, chèn **trước** zoompan với toạ độ gốc video, để zoompan phóng cả cursor theo — tự nhiên hơn và đơn giản hơn, chọn hướng này làm mặc định).
- Fallback nếu ASS gặp giới hạn: render cursor track thành webm alpha trong renderer (canvas + MediaRecorder, cơ chế giống webcam recording hiện có) rồi `overlay` trong ffmpeg — chậm hơn nhưng chắc chắn hoạt động. Quyết định sau spike 1-2 ngày đầu sprint.
- Multi-segment: cursor events phải re-map source-time → conceptual-time — dùng chung hàm remap "timed events" viết ở Sprint 9 (US-075/076).

**Style presets (US-083):**
- Main process: `presets.json` trong `app.getPath('userData')`; IPC `presets:list/save/delete/set-default`.
- `newProjectFromManifest`: nếu có default preset → spread lên trên `DEFAULT_PROJECT_STATE`.
- UI: dropdown ở đầu Sidebar + nút save; không cần preview thumbnail cho preset ở phase này (chỉ tên).

**Rename recording (US-084):**
- Ghi `title` vào `meta.cache.json` hiện có (cùng file cache Sprint 7, thêm field — cache invalidation theo mtime không ảnh hưởng vì title do user đặt, đọc/ghi riêng key). IPC `recordings:rename`.
- HomeScreen: double-click tên → input inline; search filter thêm `title`.

**Batch export (US-085):**
- `ExportModal`: section "Export targets" dạng checkbox list; renderer gọi `startExport` tuần tự từng target (main process đã chặn export song song bằng flag `exporting` — giữ nguyên, chạy queue phía renderer).
- Progress UI: "Target 2/3 — 45%".

**Quick share (US-086):**
- Copy file: `clipboard.writeBuffer('NSFilenamesPboardType', ...)` hoặc `clipboard.write({ ... })` với file path (macOS); test paste vào Slack/Finder/iMessage.
- Drag out: `ipcMain.on('ondragstart')` + `event.sender.startDrag({ file, icon })` — pattern chuẩn Electron.

**Click sounds (US-087):**
- Bundle 1 file `click.wav` (~50ms); trong export, mỗi click event (đã có trong cursor.json) thêm 1 input `-i click.wav` là không khả thi với nhiều click → dùng `adelay` + `amix`: 1 input click.wav, split N lần với delay khác nhau, cap ~50 clicks (gộp click liền nhau). Nếu filtergraph phình quá: pre-render track click bằng cách nối silence+click trong 1 pass riêng rồi mix 2 pass.

**Motion blur experiment (US-088):**
- Timebox 2 ngày. Đo trên video 1080p 60s có 5 zoom events: export time với/không `minterpolate=fps=60:mi_mode=mci` trong `enable` windows. Ghi kết quả vào cuối file sprint này. Ship chỉ khi chậm thêm <50%; ngược lại đóng story với kết luận "không đáng".

---

## Definition of Done

- [x] Recording mới không còn cursor hệ thống trong pixel video; preview và export đều hiện cursor ảo tại đúng vị trí, khớp thời gian với video (không lệch quá 1 frame ở 60fps)
- [x] Nếu cursor tracking thất bại (thiếu Accessibility permission) → tự fallback quay kèm cursor hệ thống như cũ, không bao giờ ra video "mất cursor"
- [x] Kéo slider cursor size 2× → cursor to gấp đôi trong cả preview lẫn file export; chọn "hide cursor" → video sạch không cursor
- [x] Lưu preset từ project đang mở → mở recording mới → preset picker áp lại đúng toàn bộ style; set default preset → recording mới tự có style đó ngay khi mở editor
- [x] Đặt tên recording từ HomeScreen → tên hiện trên card, search theo tên hoạt động, tên giữ nguyên sau khi app restart
- [x] Chọn 3 target export (16:9 + 9:16 + GIF) → 1 click ra đủ 3 file với hậu tố tên đúng, progress hiển thị theo từng target, cancel giữa chừng giữ lại các file đã xong
- [x] Sau export: bấm "Copy file" → paste được file vào Slack/Finder; kéo icon file từ modal thả ra Desktop được
- [x] Bật click sounds → export có âm click đúng thời điểm click chuột, âm lượng không át giọng nói
- [x] US-088 có kết luận rõ ràng ghi trong file này (ship / không ship + số liệu đo)
- [x] Toàn bộ tính năng hoạt động với cả project cũ (không title, không preset, cursor baked) — mọi field mới optional, không breaking change

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Webcam scene layouts (PIP → fullscreen camera theo timeline) | Giá trị cao nhưng estimate XL (data model scenes + preview compositor + export layout switching) — xứng đáng làm trụ cột riêng của Sprint 11 thay vì nhét ép vào đây |
| Cloud sync / share link | Vẫn cần backend; "Copy file + drag out" (US-086) đạt 70% giá trị share với 5% công sức |
| Custom cursor image do người dùng upload | Chờ US-080/081 ổn định đã; thêm sau chỉ là swap asset |
| Auto-update UI / crash reporting | Hạ tầng shipping, không phải giá trị người dùng trực tiếp; làm khi chuẩn bị release công khai |

Trụ cột lớn nhất (synthetic cursor, US-080→082) là khoản đầu tư "chất lượng hình ảnh" duy nhất còn lại có thể khiến người xem hỏi "video này làm bằng tool gì?" — đúng loại giá trị đã đưa Screen Studio thật đi lên. Phần còn lại (preset, rename, batch, share) là các khoản "lãi kép workflow": nhỏ từng cái, nhưng người dùng chạm vào mỗi ngày.


---

## Ghi chú triển khai (thực tế sau khi code)

- **Capture cursor-less**: flag thực tế là `--hide-cursor` (opt-in hiding, ngược với thiết kế `--show-cursor` ban đầu — an toàn hơn: mặc định giữ hành vi cũ). Main process chỉ bật khi Accessibility granted; `manifest.cursorHidden` chỉ true khi cursor.json thực sự tồn tại lúc stop → không bao giờ ra video "mất cursor".
- **ASS cursor** ([CursorAss.ts](../src/main/export/CursorAss.ts)): renderer chuẩn bị path (smooth + downsample 15Hz + normalize 0-1) gửi qua `ExportOptions.cursorPath`; main sinh `.ass` với arrow vector `{\p1}` + `\move` interpolation, áp filter `ass=` **trước** trim/speed/zoompan → cursor "dính" vào frame nguồn, mọi splice/speed/zoom tự đúng. Trường hợp `-ss` (single-segment) shift timestamp bằng tham số `timeShift`.
- **Presets**: `presets.json` trong userData; PresetPanel ở đầu Sidebar (save/apply/★ default/xoá); default preset spread vào project mới trong `newProjectFromManifest`.
- **Rename**: title lưu `title.txt` riêng trong recording dir (không nhét vào meta.cache.json như thiết kế ban đầu — cache bị invalidate theo mtime sẽ làm mất title). Double-click tên trên HomeScreen (cả grid lẫn list) để sửa; search lọc theo title.
- **Batch export**: 2 checkbox "Also export 9:16" / "Also export GIF" chạy tuần tự, progress "Target i/n — label". Không làm full multi-config list — 2 target phụ này cover 90% nhu cầu.
- **Quick share**: copy qua pasteboard type `public.file-url`; drag-out qua `webContents.startDrag`. Nút hiện ngay trong done-banner của ExportModal (kèm Show in Finder).
- **Click sounds**: không bundle WAV — dùng lavfi `sine=frequency=1400` 0.06s + `asplit`+`adelay`+`amix`, cap 40 click.

## Kết luận US-088 — Motion blur: KHÔNG SHIP

Benchmark trên ffmpeg bundle (8.1.2), video test 1080p:
1. `minterpolate` **không hỗ trợ timeline `enable`** — ffmpeg báo thẳng "Timeline ('enable' option) not supported with filter 'minterpolate'" → toàn bộ ý tưởng "chỉ áp trong transition window" phá sản ở tầng filter.
2. Áp full-clip: 5s video 1080p mất **30.0s** xử lý so với baseline 1.1s = **chậm 26.6×** — vượt xa tiêu chí ship (<1.5×).

Phương án khả thi còn lại (segment riêng minterpolate rồi concat) sẽ đưa độ phức tạp filtergraph lên mức không tương xứng với giá trị thẩm mỹ. Đóng story, không ship; nếu tương lai cần "cảm giác mượt" thì hướng đi đúng là tăng fps capture + spring easing (đã có) chứ không phải frame interpolation.
