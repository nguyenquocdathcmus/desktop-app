# Sprint 22 — Đóng nốt nợ kỹ thuật: Multi-Display Switch & Notification Auto-Detect

**Duration:** Week 81-84 (4 tuần)
**Goal:** Sprint 20 và 19 để lại 2 hạng mục Blocked không phải vì thiếu khả năng kỹ thuật mà vì thiếu **dữ liệu/phần cứng kiểm chứng** trong môi trường triển khai lúc đó. Sprint này không phải feature mới — là sprint "trả nợ có kế hoạch": chuẩn bị đúng loại dữ liệu/điều kiện còn thiếu, rồi hoàn thiện 2 hạng mục đó với cùng tiêu chuẩn (không ship heuristic/API chưa kiểm chứng) đã áp dụng trước đây.
**Status:** 🟡 Partial (US-172/173/174/175 ✅ Done; US-176/177 🔴 still Blocked — xem ghi chú)

---

## Sprint Goal

> Đối chiếu 2 khoản nợ cụ thể:
>
> 1. **US-154 (Sprint 19) — Auto-detect notification banner.** Lý do Blocked: không có video chứa notification macOS thật để đo tỷ lệ false-positive/false-negative của heuristic diff-frame. Đây là nợ **dữ liệu**, không phải nợ code — có thể trả bằng cách tự tạo bộ fixture tổng hợp (synthetic) mô phỏng đúng đặc trưng đã mô tả (rectangle góc trên-phải, xuất hiện đột ngột, tồn tại 3-5s, biến mất) cộng với ghi thật một số lần notification thật trên máy dev để đối chiếu.
> 2. **US-162 (Sprint 20) — Chuyển display giữa lúc quay.** Lý do Blocked: cần phần cứng multi-monitor thật để xác nhận `SCStream.updateContentFilter` không rớt frame/không lỗi `AVAssetWriter`. Nợ **phần cứng** — sprint này giả định điều kiện test đã có (hoặc dùng máy ảo/màn hình phụ qua AirPlay/Sidecar tạm thời chỉ để test, không phải tính năng chính thức) để hoàn thiện implementation đã spike xong.
>
> Nguyên tắc xuyên suốt: nếu đến giữa sprint vẫn không kiểm chứng được, tiếp tục giữ Blocked và ghi rõ lý do — không hạ chuẩn để "cho có" tính năng.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-172 | Bộ synthetic fixture cho notification banner: script tạo video test tổng hợp (overlay rectangle động theo đúng timing/vị trí notification macOS thật: 360×80px góc trên-phải, fade-in 0.2s, tồn tại 3-5s, fade-out) dùng ffmpeg `drawbox`/`overlay`, đa dạng theo nội dung nền (video có chuyển động nhiều/ít) | P0 | M | ✅ Done — `scripts/generate-notification-fixtures.sh` |
| US-173 | Thu thập 10-15 clip ngắn có notification macOS thật (Slack, Mail, Calendar, Messages) trên máy dev thật, làm test set đối chiếu với fixture tổng hợp — đo heuristic có generalize từ synthetic sang thật hay không | P0 | S | 🔴 Blocked — môi trường triển khai không thể trigger notification macOS thật trong quy trình tự động; quy trình thủ công cụ thể ghi trong `test/RESULTS/sprint-22-notification-heuristic.md`, cần 1 dev chạy tay 1 lần trước khi bật US-154 mặc định |
| US-174 | Implement + đo heuristic diff-frame US-154 trên bộ dữ liệu tổng hợp (US-172): công bố rõ precision/recall đo được, ngưỡng quyết định ship P1 (false-positive rate < 5%) | P0 | L | ✅ Done — `NotificationDetector.ts`, đo thật 100% recall / 0% FP trên fixture tổng hợp (`test/integration/notification-detector.test.ts`), chi tiết trong `test/RESULTS/sprint-22-notification-heuristic.md` |
| US-175 | US-158 (cảnh báo pre-export nếu còn notification chưa xử lý) — nút "Detect notifications" trong Timeline, luôn cần 1 click xác nhận mỗi gợi ý, không tự động blur | P1 | S | ✅ Done — `Timeline.tsx` (`handleDetectNotifications`), IPC `notifications:detect` |
| US-176 | Hoàn thiện `SCStream.updateContentFilter` cho chuyển display giữa lúc quay (US-162 Sprint 20): implement trong `main.swift`, test thật trên hardware 2+ màn hình độ phân giải khác nhau, đo dropped-frame count trước/sau chuyển | P1 | L | 🔴 Blocked — máy triển khai sprint này chỉ có 1 display vật lý (`system_profiler SPDisplaysDataType` xác nhận), không thể đo dropped-frame/artifact thật khi chuyển filter giữa 2 display có độ phân giải khác nhau |
| US-177 | Nối 2 đoạn ghi (trước/sau chuyển display) vào `segments[]` timeline nếu US-176 buộc phải restart `SCStream` thay vì update mượt — tái dùng đúng hạ tầng multi-clip Sprint 8 | P1 | M | 🔴 Blocked (phụ thuộc trực tiếp US-176) |

---

## Định hướng kỹ thuật

**Synthetic fixture generator (US-172):**
```bash
ffmpeg -i base.mov -filter_complex \
  "[0:v]drawbox=x=W-380:y=20:w=360:h=80:color=black@0.85:t=fill:enable='between(t,5,9)'[v]" \
  -map "[v]" notification_synthetic.mov
```
Script tại `scripts/generate-notification-fixtures.sh` — tham số hoá vị trí/thời lượng/nội dung nền để tạo ma trận test case, không chỉ 1 file.

**Đo heuristic (US-174):**
- Output không chỉ "hoạt động/không" mà bảng số liệu cụ thể: true positive, false positive, false negative trên từng clip, tổng hợp precision/recall.
- Lưu kết quả đo vào `test/RESULTS/sprint-22-notification-heuristic.md` — quyết định ship hay tiếp tục Blocked dựa trên số liệu này, không dựa trên cảm giác "có vẻ ổn".

**Multi-display switch (US-176, US-177):**
- Nếu không có hardware 2 màn hình thật khi sprint bắt đầu, hạ ngay xuống Blocked từ đầu sprint thay vì cố gắng đến cuối — tiết kiệm effort, đúng tinh thần đã áp dụng ở Sprint 20.

---

## Definition of Done

- [x] Bộ fixture tổng hợp notification tạo được, đa dạng 7 kịch bản (4 positive, 3 negative) — `scripts/generate-notification-fixtures.sh`
- [ ] Test set 10-15 clip notification thật thu thập xong — **Blocked**, quy trình thủ công ghi rõ trong `test/RESULTS/sprint-22-notification-heuristic.md`, cần dev chạy tay
- [x] Bảng đo precision/recall của heuristic công bố trong `test/RESULTS/sprint-22-notification-heuristic.md` — 100% recall, 0% false-positive trên fixture tổng hợp
- [x] Ship US-154 ở dạng "gợi ý cần xác nhận" (nút Detect notifications trong Timeline) dựa trên kết quả đo tổng hợp đạt ngưỡng — gắn nhãn rõ "experimental" cho tới khi có đo đạc từ dữ liệu thật (US-173)
- [x] US-158 tương đương: mỗi gợi ý hiện confidence, yêu cầu 1 click "Blur this" hoặc "Dismiss" — không có cảnh báo pre-export riêng vì US-154 giờ chạy on-demand trong Timeline thay vì passive background scan
- [ ] Multi-display switch (US-162/176/177): giữ Blocked — máy triển khai chỉ có 1 display vật lý, không đo được dropped-frame/artifact thật

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Bỏ qua US-154/US-162, chuyển thẳng sang tính năng mới | 2 hạng mục này chặn đúng nhóm user chính (người demo sản phẩm, dev nhiều màn hình) — để nợ tích luỹ thêm 5 sprint nữa sẽ khó quay lại vì code xung quanh tiếp tục thay đổi |
| Ship US-154 không cần đo số liệu, chỉ cần "trông có vẻ hoạt động" | Đúng chính rủi ro sprint 19 đã cảnh báo: heuristic sai tạo cảm giác an toàn giả, tệ hơn không có tính năng |

Sprint 22 là sprint duy nhất trong 5 sprint mới không thêm tính năng — mục đích là đóng nợ kỹ thuật đúng cách trước khi mở rộng phạm vi tiếp.
