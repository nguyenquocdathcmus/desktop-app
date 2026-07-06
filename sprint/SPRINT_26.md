# Sprint 26 — Team Collaboration: Shared Libraries & Comment Threads Beyond Local

**Duration:** Week 97-100 (4 tuần)
**Goal:** Sprint 15 thêm "review comments cục bộ" (comment gắn vào timestamp, lưu trong project bundle) và Sprint 21 thêm publish tới YouTube/Drive/Dropbox — nhưng 2 tính năng này chưa nối với nhau: comment vẫn chỉ tồn tại cục bộ trên máy người tạo, không đồng bộ được khi gửi file cho đồng nghiệp qua Drive. Sprint này nối 2 mảnh đã có thành luồng review nhóm thực sự, vẫn giữ đúng kiến trúc "app desktop, không server riêng" bằng cách encode toàn bộ state cộng tác vào chính file chia sẻ (Drive/Dropbox) thay vì cần backend mới.
**Status:** ✅ Done

---

## Sprint Goal

> Khoảng trống cụ thể giữa Sprint 15 và Sprint 21:
>
> 1. **Comment cục bộ không đi theo file khi share.** `manifest.json` trong `.screenstudio` bundle (Sprint 15) lưu comment, nhưng khi publish (Sprint 21) chỉ upload **video đã export** (mp4/mov) — comment ở lại máy người tạo, không tới tay người xem.
> 2. **Không cách nào người xem phản hồi ngược lại.** Ngay cả khi gửi cả `.screenstudio` bundle qua Drive (Sprint 21 US-166 hỗ trợ upload bất kỳ file), người nhận cần cài đúng app này để mở và thấy comment — không có đường xem/phản hồi nhẹ hơn.
> 3. **Nhiều người review cùng lúc dễ ghi đè comment của nhau** nếu chia sẻ trực tiếp file `.screenstudio` qua Drive (2 người sửa cùng file, upload đè lên nhau) — chưa có cơ chế merge hoặc khoá.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-195 | Export kèm comment: khi publish video, tuỳ chọn "Include review comments" sinh thêm file `.comments.json` upload cùng | P0 | M | ✅ Done — `PublishPanel.tsx` checkbox, IPC `review:export-comments-json`, ghi sidecar `<video>.comments.json` sau khi upload thành công |
| US-196 | Trang xem nhẹ (static HTML, không cần cài app): "shareable review page" tự chứa (video embed YouTube/Drive + danh sách comment) | P0 | M | ✅ Done — `reviewPageTemplate.ts` (thuần function, không phụ thuộc Electron), verify bằng 7 unit test thật gồm cả escape XSS; nút "Export shareable review page" trong `PublishPanel.tsx` |
| US-197 | Import comment ngược lại từ trang HTML (thêm comment mới, xuất JSON tải về) vào lại project | P1 | M | ✅ Done — trang review có form thêm comment + nút tải JSON; nút "Import" trong `Timeline.tsx` đọc lại qua IPC `review:import-comments-json`, cộng dồn vào `reviewComments` hiện có |
| US-198 | Phát hiện xung đột khi mở bundle đã bị sửa từ nơi khác — cảnh báo rõ, gợi ý merge comment thay vì chọn 1 | P1 | M | ✅ Done — `conflictTracker.ts` (theo dõi mtime đã biết per-path trong userData, không cần đổi schema `ProjectState`), `SaveConflictBanner.tsx` với 3 lựa chọn (merge/overwrite/discard), verify bằng 5 unit test thật |
| US-199 | Danh sách comment tổng hợp trong HomeScreen card: đếm số comment chưa xử lý | P2 | S | ✅ Done — badge 💬 trên thumbnail, đọc trực tiếp từ `manifest.json` trong `recordings-list-handler.ts` |

---

## Định hướng kỹ thuật

**Export kèm comment (US-195):**
- Tái dùng đúng cấu trúc comment đã có từ Sprint 15 (`ReviewComment[]` trong `manifest.json`) — chỉ thêm bước serialize riêng thành file đồng hành khi publish, không đổi schema.
- Burn-in caption: dùng `drawtext` filter FFmpeg tương tự cách chapter markers/keystroke overlay (Sprint 9) đã render text lên video, giới hạn thời lượng hiện mỗi comment 3-4s quanh đúng timestamp.

**Trang xem nhẹ (US-196):**
- Template HTML tĩnh tại `src/main/export/reviewPageTemplate.ts` — không dùng framework, giữ tối giản để mở được ở bất kỳ trình duyệt nào không cần server, giống triết lý self-contained của Artifact.
- Nếu video ở YouTube: nhúng qua iframe embed chuẩn. Nếu ở Drive: dùng link preview trực tiếp (Drive hỗ trợ preview video qua URL dạng `/preview`).

**Conflict detection (US-198):**
- `manifest.json` thêm field `updatedAt`/content hash — so sánh khi `ProjectManager` mở lại bundle đã từng publish, không phải cơ chế lock phức tạp (khoá file thật sự phức tạp hoá luồng offline-first hiện có, không tương xứng giá trị).

---

## Definition of Done

- [x] Publish video kèm "Include comments" → file `.comments.json` ghi cạnh video local sau khi upload thành công
- [x] Trang review HTML tự chứa, mở được ở bất kỳ trình duyệt nào (verify bằng unit test: escape XSS, embed đúng YouTube/Drive link, sort comment theo thời gian, format timestamp m:ss)
- [x] Thêm comment mới từ trang HTML → export file → import lại vào Editor → comment xuất hiện đúng vị trí trên Timeline (cộng dồn, không ghi đè comment cũ)
- [x] Mở lại project đã bị sửa từ nơi khác → cảnh báo xung đột rõ ràng qua `SaveConflictBanner`, không mất comment của bên nào khi chọn "merge" — verify logic mtime-tracking bằng 5 unit test thật
- [x] HomeScreen card hiện đúng số comment chưa resolved mỗi recording (badge 💬)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Xây backend thật (server lưu comment, real-time sync kiểu Figma) | Mâu thuẫn trực tiếp với kiến trúc "app desktop local" giữ xuyên suốt từ Sprint 1 tới Sprint 21 (đã từ chối tự-host video vì đúng lý do này) — encode state vào file chia sẻ qua Drive/Dropbox đạt phần lớn giá trị cộng tác mà không cần hạ tầng mới |
| Real-time cùng sửa (nhiều người sửa comment cùng lúc thấy nhau live) | Đòi hỏi kết nối thường trực + hạ tầng đồng bộ - đúng thứ kiến trúc hiện tại cố tình tránh; async review (sửa, upload, người khác tải về xem) đủ tốt cho use case demo/tutorial review, không phải pair-editing thời gian thực |
| Tài khoản người dùng + quyền truy cập (ai được sửa gì) | Không có hệ thống auth nào trong app (kể cả Sprint 21 OAuth chỉ để publish, không phải để quản lý user) — thêm authorization model là thay đổi kiến trúc lớn ngoài phạm vi 1 sprint |

Sprint 26 khép lại đúng khoảng trống giữa 2 sprint đã làm trước (15 và 21) — biến "quay xong, xuất file, gửi link" (Sprint 21) và "để lại ghi chú khi edit" (Sprint 15) thành một vòng phản hồi nhóm thật, không cần đầu tư hạ tầng server mới.
