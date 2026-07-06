# Sprint 6 — Audio Reliability + Webcam Compositing + Error UX

**Duration:** Week 17-20 (4 tuần)
**Goal:** Đóng các lỗ hổng giữa "state đã model" và "thực sự hoạt động" — webcam ghép vào export, device frame render đúng, lỗi hiển thị cho người dùng thay vì console — cộng nền tảng cho editing (autosave, undo/redo).
**Status:** ✅ Done (tất cả user stories hoàn thành)

---

## Sprint Goal

> Phase 4 — độ tin cậy & hoàn thiện trải nghiệm. Sprint 5 để lại webcam overlay "preview only, not recorded to disk" và device frame chưa chắc chắn render trong export. Backlog audit (xem PLAN.md / trao đổi 2026-07-01) xác nhận thêm: webcam-in-export và deviceFrame-in-export là hai gap lớn nhất, cùng với việc toàn bộ lỗi (permission mic/camera, start/stop recording) hiện chỉ log console, không báo cho người dùng.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-043 | Webcam overlay compositing vào export (không chỉ preview) | P0 | L | ✅ Done |
| US-044 | Device frame (macbook/browser/iphone) render đúng trong Exporter.ts | P0 | M | ✅ Done |
| US-045 | Error surfacing UI: toast/banner cho mic, camera, recording start/stop failures | P0 | M | ✅ Done |
| US-046 | Permission-denied UX: hướng dẫn mở System Settings khi mic/camera/screen recording bị từ chối | P1 | S | ✅ Done |
| US-047 | Audio setup feedback: live VU meter cho mic trước khi ghi | P1 | M | ✅ Done |
| US-048 | System Audio status chip trong RecordingControls (rõ ràng khi Window mode tắt system audio) | P1 | S | ✅ Done |
| US-049 | Autosave project state (debounced, dựa trên isDirty) | P1 | M | ✅ Done |
| US-050 | Undo/redo cho project edits (background, zoom, cursor settings, trim) | P2 | L | ✅ Done |
| US-051 | Kiểm tra & fix lệch audio/video do thứ tự start mic-recorder vs capture start | P1 | S | ✅ Done |
| US-052 | Recording state header: hiển thị display/window đang quay + pause/resume | P2 | M | ✅ Done |

---

## Definition of Done

- [ ] Ghi có bật webcam → export ra file có webcam overlay đúng vị trí/kích thước đã chọn
- [ ] Chọn device frame (macbook/browser/iphone) → export ra file có frame đó
- [ ] Mic/camera permission bị từ chối → UI hiển thị thông báo rõ ràng, có nút mở System Settings
- [ ] Mọi lỗi start/stop recording hiển thị cho người dùng (không chỉ console.error)
- [ ] VU meter hiển thị mức mic realtime trong RecordingControls trước khi bấm Start
- [ ] Chuyển sang Window mode → chip "System Audio" hiển thị trạng thái tắt kèm tooltip giải thích
- [ ] Project tự động lưu sau X giây không thao tác hoặc khi rời khỏi app, không cần bấm Save thủ công
- [x] Undo/redo hoạt động cho các thao tác chỉnh sửa chính trong editor (⌘Z/⌘⇧Z + nút trong ControlBar, debounce 400ms gộp thao tác kéo liên tục thành 1 bước)
- [ ] Audio và video đồng bộ khi review lại recording có mic bật
- [x] Header hiển thị display/window đang quay (tên lấy từ `displays`/`windows` theo `displayId`/`windowId` trong status)
- [x] Pause/Resume: bấm Pause giữa lúc ghi → không tạo thêm frame mới trong output, bấm Resume → video liền mạch không có đoạn đứng hình; mic và webcam track pause/resume đồng bộ theo screen capture

### Ghi chú kỹ thuật — US-052 Pause/Resume

`SCStream` (ScreenCaptureKit) không có API pause native, nên thay vì dừng/khởi động lại stream, cách chọn là: `VideoWriter` (Swift) nhận lệnh `pause`/`resume` qua stdin từ Electron, **bỏ qua** (không ghi) mọi frame trong lúc paused, và trừ tổng thời gian đã pause khỏi PTS của các frame ghi sau đó — nên file output liền mạch, không có đoạn đứng hình hay giật hình tại điểm resume. Áp dụng cùng cơ chế shift PTS cho audio track để giữ đồng bộ. Mic (`MediaRecorder` trong renderer) và webcam (`MediaRecorder` trong `WebcamFloat`) dùng API `pause()/resume()` native của `MediaRecorder`, được gọi đồng thời với lệnh pause/resume gửi xuống capture binary.
