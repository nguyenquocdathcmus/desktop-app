# Sprint 20 — True Multi-Display Support: Recording Across Multiple Monitors Correctly

**Duration:** Week 73-76 (4 tuần)
**Goal:** Khảo sát xác nhận `cursor-tracker` ghi toạ độ cursor **tuyệt đối trên toàn hệ thống** (global screen coordinates), không biết display nào đang được quay — với setup nhiều màn hình (rất phổ biến ở đúng đối tượng dùng app này: developer, người làm demo sản phẩm), cursor event sẽ sai lệch bất cứ khi nào con trỏ rời khỏi display đang ghi, hoặc khi có màn hình phụ ở bên trái/trên (toạ độ âm) khiến zoom-tracking (Sprint 4) và synthetic cursor (Sprint 10) tính toán sai vị trí. Sprint này làm cho recording đa màn hình chính xác tuyệt đối, và thêm khả năng chuyển display giữa lúc đang quay.
**Status:** ✅ Done (US-162 🟡 Partial — spike only, xem ghi chú)

---

## Sprint Goal

> Ba khoảng trống cụ thể phát hiện khi khảo sát:
>
> 1. **Cursor coordinate không được clip/offset theo display đang quay.** `cursor-tracker` dùng `CGEventTap` toàn hệ thống, ghi toạ độ theo hệ quy chiếu macOS global (display chính luôn ở gốc 0,0; display phụ bên trái sẽ có toạ độ X âm). `ZoomPathGenerator.ts` và synthetic cursor (Sprint 10) chuẩn hoá toạ độ bằng chia cho `manifest.width/height` — đúng cho single-display nhưng **sai hoàn toàn** khi: (a) đang quay display phụ không phải display chính (offset không được trừ đi), (b) cursor rời sang display khác trong lúc quay (event vẫn được ghi nhưng nằm ngoài khung hình, gây zoom "nhảy" tới vị trí vô nghĩa).
> 2. **Không cách nào đổi display đang quay giữa chừng.** Người demo chuyển sang trình chiếu Keynote ở màn hình phụ giữa buổi quay — hiện tại phải dừng ghi, chọn lại display, ghi tiếp thành file riêng rồi tự ghép ngoài app.
> 3. **Danh sách display trong `RecordingControls` không hiển thị layout vật lý thật.** Hiện chỉ là danh sách phẳng (card ngang hàng) — người dùng có 3 màn hình xếp không theo hàng ngang chuẩn dễ chọn nhầm display vì không có sơ đồ trực quan như System Settings > Displays.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-159 | Clip cursor events theo display bounds đang quay: `cursor-tracker` (hoặc `RecordingSession` khi xử lý cursor.json sau khi ghi) lọc bỏ event nằm ngoài `displayBounds`, chuyển toạ độ tuyệt đối → tương đối (trừ offset display gốc) trước khi ghi vào cursor.json | P0 | M | ✅ Done |
| US-160 | Sửa lại `generateZoomEvents`/synthetic cursor để luôn nhận toạ độ đã chuẩn hoá theo display từ US-159 — audit lại toàn bộ chỗ đang giả định toạ độ bắt đầu từ (0,0) | P0 | M | ✅ Done |
| US-161 | Display layout picker trực quan: sơ đồ vị trí tương đối các màn hình (giống System Settings > Displays) thay vì danh sách card phẳng, click đúng vị trí để chọn display cần quay | P1 | M | ✅ Done |
| US-162 | Chuyển display giữa lúc quay (nếu kỹ thuật cho phép trong scope sprint): dừng nhẹ capture hiện tại, khởi động lại trên display mới, nối liền vào cùng 1 file hoặc tạo segment mới tự động nối vào timeline (tái dùng `segments[]` Sprint 8) — quyết định hướng tiếp cận cụ thể đầu sprint dựa trên độ phức tạp thực tế của việc restart SCStream giữa chừng | P1 | L | 🟡 Partial (spike only) |
| US-163 | Cảnh báo trước khi quay nếu display đã chọn có độ phân giải/tỷ lệ khung hình bất thường (ultrawide, vertical monitor) — điều chỉnh gợi ý resolution export phù hợp thay vì mặc định 16:9 | P2 | S | ✅ Done |
| US-164 | Test đa màn hình thủ công có hướng dẫn rõ trong `test/TEST_CASES.md`: các cấu hình cần test (2 màn ngang hàng, màn phụ bên trái/trên, độ phân giải khác nhau mỗi màn) — vì CI (Sprint 14) không thể test multi-monitor tự động | P2 | S | ✅ Done |

**Ghi chú US-162 (spike, không ship code):** `SCStream` (ScreenCaptureKit) hỗ trợ `updateContentFilter(_:)`/`updateConfiguration(_:)` từ macOS 13+ — về lý thuyết cho phép đổi display đang quay mà không cần dừng hẳn `stopCapture()`/tạo `SCStream` mới, tránh gián đoạn file output. Tuy nhiên xác nhận điều này hoạt động đúng thực tế (không mất frame, `AVAssetWriter` không lỗi khi input resolution đổi giữa chừng nếu display mới có kích thước khác, không có frame đen/artifact khi chuyển) đòi hỏi phần cứng multi-monitor thật để test trực tiếp — không có trong môi trường triển khai phiên này (không thể giả lập bằng CI hay đo tự động). Kết luận: khả thi về mặt API, nhưng rủi ro ship code chưa kiểm chứng bằng phần cứng thật cao hơn giá trị của story P1 này trong sprint. Đề xuất cho sprint sau: implement `updateContentFilter` trong `main.swift`, test thủ công trên máy có ít nhất 2 display thật với các độ phân giải khác nhau trước khi ship.

---

## Định hướng kỹ thuật

**Cursor coordinate normalization (US-159, US-160):**
- `RecordingSession` đã biết `displayBounds` (đang dùng để ghi vào manifest) — thêm bước hậu xử lý cursor.json ngay sau khi ghi xong: đọc từng event, nếu `x/y` nằm ngoài `[displayBounds.x, displayBounds.x + width]` thì loại bỏ (cursor đã rời màn hình đang quay), nếu nằm trong thì trừ `displayBounds.x/y` để có toạ độ tương đối 0-based.
- Đây là điểm sửa **một lần duy nhất** ở nguồn cursor data — mọi nơi tiêu thụ (`ZoomPathGenerator`, `PreviewCanvas` cursor overlay, synthetic cursor export Sprint 10, face-detector không liên quan vì face-detector đọc webcam riêng) tự động đúng theo, không cần sửa từng nơi.
- Trường hợp window-mode (không phải display-mode): cursor cũng cần clip theo `sourceRect` của window, không chỉ display — audit kỹ khi implement vì đây là 2 hệ quy chiếu khác nhau (window nằm trong display, đã có logic crop trong `main.swift`).

**Display layout UI (US-161):**
- `screen.getAllDisplays()` trả về `bounds: { x, y, width, height }` tuyệt đối — đủ dữ liệu vẽ sơ đồ tỷ lệ (scale toàn bộ xuống kích thước UI nhỏ, giữ tỷ lệ tương đối giữa các display).
- Component mới thay thế phần list card hiện tại trong `RecordingControls.tsx`, giữ nguyên `selectDisplay` action đã có.

**Chuyển display giữa chừng (US-162) — story rủi ro cao nhất:**
- Cần spike kỹ thuật đầu sprint: `SCStream` có cho phép update `SCContentFilter` giữa chừng không dừng hẳn, hay bắt buộc phải `stopCapture()` + tạo `SCStream` mới? Nếu bắt buộc phải restart, chấp nhận có 1 khoảng gián đoạn ngắn (vài trăm ms) giữa 2 đoạn — xử lý như 2 segment riêng nối vào `segments[]`, giống cách ripple-delete tạo khoảng trống trên timeline (Sprint 8) nhưng ngược lại (nối thêm thay vì xoá).
- Nếu độ phức tạp vượt ngân sách sprint, hạ xuống thành "spike + ghi kết luận khả thi/không khả thi" thay vì ép ship nửa vời.

---

## Definition of Done

- [x] Setup 2 màn hình, màn phụ đặt bên trái màn chính (toạ độ âm) → quay màn chính → zoom/cursor overlay hiển thị đúng vị trí — verify bằng test thật với binary thật: chạy `capture` binary build từ code đã sửa, xác nhận emit `{"originX":0,"originY":0,"pointsToPixels":2}` cho display chính Retina; logic trừ origin âm verify bằng `test/unit/cursor-rebase.test.ts`. Cần test thủ công thật trên phần cứng 2 màn hình theo TC-091/092 trước khi release
- [x] Trong lúc quay display chính, di chuột sang display phụ rồi quay lại → không có "cú nhảy zoom" — `rebaseCursorEvents` lọc bỏ event ngoài `[0, captureWidthPx] × [0, captureHeightPx]`, verify bằng test `drops events that fall outside the captured frame`
- [x] Display picker hiển thị đúng layout tương đối của các màn hình thật — `DisplayLayoutPicker.tsx` vẽ theo tỷ lệ thật từ `DisplayInfo.x/y` (thêm field mới, lấy từ `screen.getAllDisplays()[i].bounds`)
- [ ] (US-162) đổi display giữa lúc quay — không ship, chỉ spike (xem ghi chú US-162 phía trên): `SCStream.updateContentFilter` khả thi về API nhưng cần phần cứng thật để kiểm chứng, không có trong môi trường này
- [x] Tài liệu ghi rõ kết luận spike US-162, lý do kỹ thuật, và đề xuất hướng cho sprint sau
- [x] `test/TEST_CASES.md` có mục multi-display (TC-091 đến TC-095) với các cấu hình cụ thể cần test thủ công trước mỗi release

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Quay đồng thời nhiều display (side-by-side trong 1 video) | Use case hẹp hơn nhiều so với "chọn đúng 1 display và quay chính xác" — ưu tiên đúng cái cơ bản trước khi mở rộng |
| Auto-follow cursor sang display khác (quay display đang có cursor, tự chuyển) | Phức tạp hoá đáng kể logic capture, hành vi khó đoán cho người dùng; display picker rõ ràng (US-161) + chuyển thủ công (US-162) minh bạch hơn |
| Hỗ trợ display ảo/AirPlay (Sidecar, Luna Display) | Phụ thuộc hành vi hệ thống bên thứ 3 không kiểm soát được, rủi ro tương thích cao so với giá trị |

Đây là sprint "sửa nền móng" — bug cursor-coordinate cho multi-display đã tồn tại từ Sprint 2 (khi `cursor-tracker` được viết) nhưng chỉ lộ rõ tác hại sau khi Sprint 4 (zoom) và Sprint 10 (synthetic cursor) xây thêm lên trên nó. Đúng tinh thần: sửa gốc rễ một lần, mọi tính năng phụ thuộc tự động đúng theo.
