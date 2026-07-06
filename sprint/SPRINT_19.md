# Sprint 19 — Sensitive Content Redaction: Blur What Shouldn't Be Shared

**Duration:** Week 69-72 (4 tuần)
**Goal:** App quay lossless mọi pixel trên màn hình — bao gồm mật khẩu gõ ra, số thẻ ngân hàng, email cá nhân, Slack riêng tư đang mở nền, notification bất ngờ hiện lên giữa lúc demo. Khảo sát xác nhận **không có bất kỳ cơ chế redaction/blur nào** trong toàn bộ codebase. Đây là rủi ro thật, không phải rủi ro giả định: người dùng quay demo sản phẩm thường quên tắt notification, để lộ tab trình duyệt khác, hoặc gõ nhầm mật khẩu vào ô tìm kiếm. Sprint này thêm công cụ để chủ động che thông tin nhạy cảm cả lúc quay lẫn lúc edit.
**Status:** ✅ Done (US-154/US-158 🔴 Blocked — xem ghi chú)

---

## Sprint Goal

> Ba quan sát dẫn tới sprint này:
>
> 1. **Không có "safe zone" khi quay.** Ứng dụng quay toàn bộ những gì hiển thị, không có cách nào định trước một vùng màn hình cố định (VD: khay hệ thống hay hay hiện notification) để tự động che mờ trong suốt quá trình quay.
> 2. **Không có cách sửa sau khi đã quay.** Nếu người dùng phát hiện lộ thông tin nhạy cảm sau khi dừng ghi (thường là lúc này mới nhận ra), cách duy nhất hiện tại là xoá cả recording và quay lại từ đầu — không có công cụ "che 1 vùng trong 1 khoảng thời gian" giống annotation/zoom đã có.
> 3. **Keystroke overlay (Sprint 9) có thể vô tình lộ thêm thông tin.** Badge phím tắt hiện `⌘⇧5` là an toàn, nhưng nếu tương lai mở rộng hiện cả nội dung gõ thường (không nằm trong roadmap hiện tại nhưng cần cảnh giác), đây là điểm cần rào chắn thiết kế ngay từ đầu.
>
> Cấu trúc kỹ thuật cho tính năng chính (US-153 blur region) tái sử dụng chính xác pattern "timed range event" đã dùng 4 lần (zoomEvents, annotations, scenes, chapters) — không phải hệ thống mới, chỉ là ứng dụng thứ 5 của cùng 1 pattern đã chứng minh hiệu quả.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-152 | Định nghĩa vùng che cố định trước khi quay: kéo 1 hoặc nhiều rectangle cố định trên preview chọn display/window, luôn bị blur trong toàn bộ recording (dùng cho khay hệ thống, vùng hay có notification) | P0 | M | ✅ Done (rút gọn, xem ghi chú) |
| US-153 | Blur region theo thời gian (sau khi quay): track mới trên Timeline (giống annotation) định nghĩa `{ id, startTime, endTime, x, y, width, height, intensity }` — vùng bị làm mờ trong khoảng thời gian đó, chỉnh sửa được trong Editor với preview real-time | P0 | L | ✅ Done |
| US-154 | Auto-detect notification banner: phát hiện heuristic đơn giản (vùng hình chữ nhật xuất hiện đột ngột góc trên phải, tồn tại vài giây rồi biến mất — đặc trưng notification macOS) trong lúc quay, gợi ý blur region tương ứng để người dùng xác nhận 1 click thay vì tự vẽ | P1 | L | 🔴 Blocked |
| US-155 | Export áp blur: `Exporter.ts` thêm filter `boxblur`/`gblur` với `enable='between(t,...)'` giới hạn theo toạ độ vùng, cường độ chỉnh được; re-map theo multi-segment/speed qua hàm remap timed-events dùng chung | P0 | M | ✅ Done |
| US-156 | Preview blur real-time: CSS `filter: blur()` overlay đúng vị trí/thời gian trong `PreviewCanvas`, khớp với export | P0 | S | ✅ Done |
| US-157 | Face blur tự động (tái dùng face-detector Sprint 11): tuỳ chọn tự động blur khuôn mặt trong webcam nếu người dùng muốn ẩn danh tính khi chia sẻ demo nội bộ nhưng không muốn lộ mặt ra ngoài | P2 | M | ✅ Done |
| US-158 | Cảnh báo trước khi export nếu recording chứa notification chưa xử lý (dựa vào US-154 nhưng chưa có blur region tương ứng) — nhắc nhở cuối trước khi gửi file đi | P2 | S | 🔴 Blocked (phụ thuộc US-154) |

**Ghi chú US-152:** Không sửa Swift capture binary (đúng theo phương án B đã ghi sẵn trong "Định hướng kỹ thuật" — giữ khả năng gỡ/sửa blur sau nếu quay nhầm vùng). Thay vào đó thêm nút "+ Safe zone" trong Timeline (`Timeline.tsx` → `handleAddSafeZoneBlur`) tạo 1 blur region phủ **toàn bộ thời lượng** (`startTime: 0, endTime: duration`), mặc định đặt ở góc trên-phải (nơi notification macOS thường xuất hiện) — người dùng kéo/resize như blur region thường để đặt đúng vùng cần che suốt cả recording. Đơn giản hơn UI "vẽ trước khi quay" nhưng đạt cùng giá trị cốt lõi và tái dùng toàn bộ hạ tầng US-153 đã có, không cần thêm state machine mới cho giai đoạn "trước khi ghi".

**Ghi chú US-154/US-158 (Blocked):** Heuristic diff-frame cho notification banner cần dữ liệu thật (video có notification macOS xuất hiện) để kiểm chứng độ chính xác — môi trường triển khai phiên này không có cách tạo notification thật để test, và ship 1 heuristic chưa kiểm chứng rủi ro tạo cảm giác an toàn giả (đúng rủi ro mà chính doc sprint đã cảnh báo cho hướng OCR bị loại). Đúng theo điều khoản đã ghi sẵn trong "Định hướng kỹ thuật": *"Nếu heuristic không đủ tin cậy trong thời gian sprint, hạ xuống P2/để sprint sau — không ép ship tính năng phát hiện sai nhiều gây phiền hơn giúp."* US-158 phụ thuộc trực tiếp vào US-154 nên cũng Blocked theo.

---

## Định hướng kỹ thuật

**Vùng che cố định lúc quay (US-152):**
- UI trong `RecordingControls.tsx`: sau khi chọn display/window, cho phép kéo 1+ rectangle overlay trên preview thumbnail của display đó — lưu toạ độ normalized 0-1 theo `StartOptions`.
- Áp dụng: đơn giản nhất là blur ngay trong `capture` binary (Core Image `CIGaussianBlur` áp lên vùng cố định mỗi frame trước khi ghi) — nhưng điều này làm mất khả năng "gỡ blur sau nếu quay nhầm vùng". Cân nhắc thay thế: capture như bình thường, nhưng tự động tạo 1 blur region (US-153) full-duration ngay khi tạo project mới — giữ được linh hoạt sửa sau, đơn giản hoá capture binary (không đổi Swift).

**Blur region timeline (US-153, US-155, US-156):**
- `ProjectState` thêm `blurRegions?: BlurRegion[]` — timed range event thứ 5, cùng khuôn `remapRangeEvents` đã dùng cho zoom/annotation/scene/chapter.
- Track UI: sao chép chính xác cấu trúc `AnnotationTrack.tsx` (kéo edge, nút ✕, nhưng thêm việc kéo/resize rectangle trên preview thay vì chỉ vị trí điểm).
- Export filter: `boxblur=luma_radius=${intensity}:enable='between(t,START,END)'` áp trong 1 nhánh riêng crop-blur-overlay-lại (crop vùng, blur, overlay đè lên đúng vị trí gốc) — không blur toàn khung hình.
- Preview: absolutely-positioned div với `backdrop-filter: blur()` đè lên đúng vị trí — khớp trực quan với export.

**Auto-detect notification (US-154):**
- Heuristic đơn giản trên cursor-tracker hoặc phân tích frame định kỳ: không cần ML nặng — macOS notification luôn xuất hiện góc trên-phải với kích thước/animation đặc trưng. Có thể đủ để phát hiện bằng diff frame đơn giản (vùng thay đổi đột ngột, tồn tại 3-5s, rồi biến mất) hơn là computer vision phức tạp.
- Nếu heuristic không đủ tin cậy trong thời gian sprint, hạ xuống P2/để sprint sau — không ép ship tính năng phát hiện sai nhiều gây phiền hơn giúp.

**Face blur (US-157):**
- Tái dùng thẳng `faceCropPath` đã có từ Sprint 11 (`webcam:detect-faces`) — thay vì crop theo mặt, áp blur theo bounding box mặt. Chi phí thêm rất thấp vì hạ tầng detect đã tồn tại.

---

## Definition of Done

- [x] Vẽ 1 vùng blur trên Timeline → preview hiện đúng vùng mờ trong đúng khoảng thời gian đó — `BlurRegionTrack.tsx` + `PreviewCanvas.tsx` (`activeBlurRegions`, `backdrop-filter: blur()`)
- [x] Export ra file → vùng đã định nghĩa bị mờ đúng thời điểm, phần còn lại rõ nét bình thường — verify bằng ffmpeg thật: `test/integration/export-real-ffmpeg.test.ts` (2 test case) + verify thủ công bằng `edgedetect`+`signalstats` cho thấy edge energy trong vùng blur (~0.44) thấp hơn hẳn ngoài vùng (~1.25-1.5), xác nhận blur thực sự làm giảm chi tiết high-frequency chứ không chỉ "không crash"
- [x] Nhiều blur region cùng lúc (2+ vùng chồng thời gian khác vị trí) hoạt động đúng — test `does not break termination with 2 overlapping-in-time, different-position regions` (real ffmpeg)
- [x] Blur region hoạt động đúng khi project có multi-segment — dùng chung `remapRangeEvents` với zoom/annotation/scene/chapter, cùng cơ chế re-map đã verify từ Sprint 14/15
- [x] Bật face blur cho webcam → khuôn mặt bị làm mờ trong cả preview lẫn export — `WebcamPanel.tsx` toggle + `Exporter.ts` split/crop/boxblur/overlay theo `faceCropPath`; verify real ffmpeg với cả 2 case (có/không có face samples)
- [ ] Auto-detect notification — không đạt do thiếu dữ liệu notification thật để kiểm chứng độ tin cậy trong phiên này; hạ xuống Blocked theo đúng điều khoản đã ghi sẵn trong doc, không ship heuristic chưa kiểm chứng

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| OCR + auto-detect text nhạy cảm (số thẻ, email) bằng Vision text recognition | Kỹ thuật khả thi (Vision framework có `VNRecognizeTextRequest`) nhưng rủi ro false negative cao (bỏ sót) tạo cảm giác an toàn giả — nguy hiểm hơn không có tính năng; để dành khi có thời gian làm kỹ và test kỹ hơn nhiều |
| Blur toàn bộ theo mặc định, người dùng phải chủ động "un-blur" | Đảo ngược UX quá mạnh so với kỳ vọng người dùng hiện tại (ghi lossless rõ nét là giá trị cốt lõi); redaction nên là công cụ chủ động thêm vào, không phải rào cản mặc định |
| Chia sẻ blur template giữa các recording (kiểu preset) | Vùng cần che thường khác nhau mỗi lần quay (notification xuất hiện ngẫu nhiên) — giá trị thấp so với công sức xây preset riêng cho blur |

Đây là sprint duy nhất trong roadmap trực tiếp giải quyết rủi ro **rò rỉ thông tin thật** — khác các sprint UX/tính năng trước, tính năng ở đây có thể ngăn một sự cố thực sự (gửi nhầm demo có lộ mật khẩu) thay vì chỉ cải thiện trải nghiệm.
