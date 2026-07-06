# Sprint 15 — Templates, Chapters, and Guided Review: Turning Recordings into Documentation

**Duration:** Week 53-56 (4 tuần)
**Goal:** Mọi sprint trước tối ưu cho "1 người quay 1 video". Sprint này nhắm vào trường hợp dùng thực tế của nhóm/team: quay xong cần **review với người khác trước khi publish**, video dài cần **chương mục để người xem nhảy tới đúng phần**, và một project style tốt cần **nhân bản nhanh** cho video tiếp theo trong series thay vì chỉnh tay lại từ đầu.
**Status:** ✅ Done

---

## Sprint Goal

> Sau Sprint 6-14, app đã: ghi hình tốt (6), Home mượt (7), edit multi-clip (8), smart editing (9), cursor+workflow (10), camera+audio (11), ship-ready (12), accessible (13), test an toàn (14). Ba khoảng trống còn lại đều xoay quanh việc video không tồn tại đơn độc — nó là 1 phần của quy trình lớn hơn (làm nhiều video cùng phong cách, cần người khác duyệt trước khi gửi, video dài cần điều hướng):
>
> 1. **Không có cách nhân bản project.** Preset (Sprint 10) lưu *style* nhưng không lưu *cấu trúc chỉnh sửa* (segments đã cắt ở đâu, annotation nói gì). Người làm series "10 video hướng dẫn tính năng X" phải bắt đầu lại từ đầu mỗi lần dù layout thường giống hệt nhau (VD: luôn có intro title-card 3s + camera-full → PIP).
> 2. **Không chapter/marker cho video dài.** Video demo 15-20 phút không có cách đánh dấu "Phần 1: Cài đặt", "Phần 2: Cấu hình" để xuất kèm chapter marker (YouTube/mp4 hỗ trợ `chapters` metadata) — người xem phải tự tua.
> 3. **Không quy trình review.** Export xong là xong — không có cách nào đơn giản để đồng nghiệp xem bản nháp, để lại comment tại đúng thời điểm ("giây 45 nói lại rõ hơn"), rồi người dựng sửa mà không cần công cụ ngoài (Slack thread rời rạc, mất context thời gian).

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-124 | "Duplicate as template": nhân bản toàn bộ project (segments, zoom, annotations, scenes, style) sang recording mới — không chỉ style như preset, mà cả cấu trúc chỉnh sửa, với placeholder rõ ràng cho phần nội dung cần thay (segments giữ tỷ lệ thời gian tương đối, không copy y hệt timestamp tuyệt đối vì video nguồn khác độ dài) | P0 | L | ✅ Done |
| US-125 | Chapter markers: track mới trên Timeline (giống annotation/scene track) để đặt điểm chương + tên; xuất kèm metadata chapter vào MP4 (`ffmpeg -metadata:s:v chapter` hoặc file chapter riêng) | P0 | M | ✅ Done |
| US-126 | Chapter trong preview: dropdown/list nhảy nhanh giữa các chương khi đang edit (điều hướng, không chỉ để export) | P1 | S | ✅ Done |
| US-127 | Review mode: export bản nháp có watermark "DRAFT" + link/file kèm sidecar comments rỗng; hoặc đơn giản hơn — "Copy timestamp link" khi đang xem preview để dán vào Slack kèm giây chính xác (`recording://path?t=45.2`) | P1 | M | ✅ Done (dạng "Copy timestamp link" qua `recordscreen://` deep link; watermark "DRAFT" export không làm — chưa có nhu cầu rõ) |
| US-128 | Review comments cục bộ: đồng nghiệp mở project file (không phải video export) trong app, để lại comment gắn với thời điểm cụ thể (giống annotation nhưng ẩn khỏi export, chỉ hiện trong app) — cần cân nhắc phạm vi: single-file collaboration (chia sẻ file `.recordscreen`) chứ không phải real-time multi-user | P1 | L | ✅ Done |
| US-129 | Export chapter list dạng text (timestamp + tên) để dán trực tiếp vào mô tả YouTube — tận dụng chapter data từ US-125 mà không cần mở lại app | P2 | S | ✅ Done |
| US-130 | Template gallery: vài preset "cấu trúc" dựng sẵn (VD: "Intro + Demo + Outro", "Bug report: Before/After") áp cả structure lẫn style cho recording mới, không chỉ dựa vào project đã có | P2 | M | ✅ Done |

---

## Định hướng kỹ thuật

**Duplicate as template (US-124):**
- Khác biệt cốt lõi với Preset (Sprint 10): preset lưu *style slice*, đây lưu *toàn bộ ProjectState trừ manifest* — nhưng thời gian (segments/zoomEvents/annotations/scenes) không copy tuyệt đối vì video nguồn mới có độ dài khác. Chiến lược: lưu **tỷ lệ tương đối** (`start / sourceDuration`) khi tạo template, rồi khi áp cho video mới nhân lại theo `newManifest.duration`. Với annotation/scene có nội dung text cụ thể ("Bước 1: ...") — giữ nguyên text, người dùng tự sửa lại nội dung, chỉ thời gian được co giãn tự động.
- UI: nút "Save as template" cạnh preset hiện có trong Sidebar (hoặc HomeScreen context menu recording) — lưu vào `templates.json` cùng cơ chế `presets.json` đã có.

**Chapter markers (US-125, US-126, US-129):**
- Track mới `ChapterTrack.tsx` — tái dùng chính xác pattern `SceneTrack`/`AnnotationTrack` (điểm mốc đơn, không phải range: chỉ có `t` + `title`, không `startTime/endTime`).
- Export: MP4 hỗ trợ chapter qua `ffmpeg -i input -f ffmetadata chapters.txt` rồi mux `-map_metadata 1`; cần build file `;FFMETADATA1\n[CHAPTER]\nSTART=...\nEND=...\ntitle=...` từ danh sách chapter re-mapped qua `remapPointEvents`-style (chapters cũng là timed events, giữ nhất quán với zoom/annotation/scene).
- US-129 chỉ là format lại cùng data thành text `00:00 Intro\n02:15 Setup\n...` — gần như miễn phí một khi US-125 xong.

**Review mode (US-127, US-128):**
- Phạm vi cố tình thu hẹp: **không xây real-time collaboration server**. "Copy timestamp link" (US-127) là giá trị nhanh, rẻ: custom protocol `recordscreen://open?path=...&t=...` đăng ký qua `app.setAsDefaultProtocolClient`, khi đồng nghiệp có cùng app + cùng path file (chia sẻ qua mạng nội bộ/cloud drive) thì click link mở đúng project tại đúng giây.
- Comments cục bộ (US-128): field mới `reviewComments?: { id, t, text, author, resolved }[]` trong ProjectState — **không xuất vào video**, chỉ hiển thị trong app (track riêng màu khác, hoặc panel danh sách). Đây là "collaboration qua file", không phải qua network — người dùng tự gửi file `.recordscreen` + video cho nhau (qua Slack/Drive), giới hạn rõ ràng cần nêu trong UI (không giả vờ là real-time).

**Template gallery (US-130):**
- 2-3 template cấu trúc dựng sẵn hardcode trong app (không cần lưu qua preset system) làm ví dụ khởi đầu, áp dụng qua cùng cơ chế co giãn tỷ lệ của US-124.

---

## Definition of Done

- [x] Lưu 1 project đã chỉnh sửa (có segments cắt, zoom, annotation, scene) làm template → tạo recording mới, áp template → cấu trúc y hệt về tỷ lệ, thời gian co giãn đúng theo độ dài video mới, không lỗi khi video mới ngắn/dài hơn nhiều so với gốc
- [x] Đặt 3 chapter marker trên Timeline có tên → export MP4 → mở bằng QuickTime/VLC thấy đúng 3 chapter tại đúng thời điểm, tên đúng (verify bằng ffprobe với ffmpeg thật, xem phần "Errors and fixes")
- [x] Dropdown chapter trong Editor nhảy playhead tới đúng điểm khi chọn
- [x] Copy timestamp link khi đang xem preview tại giây 45 → dán link, người khác (cùng máy/cùng path) click mở đúng project tại giây 45
- [x] Thêm review comment tại 1 thời điểm → xuất video không có comment nào lẫn vào (verify: `reviewComments` không xuất hiện ở `ExportOptions`/`ExportModal.tsx`); mở lại project trong app vẫn thấy comment
- [x] Chapter list dạng text copy được, format đúng chuẩn dán vào YouTube description
- [x] Chọn 1 template gallery có sẵn cho recording mới → áp đúng cấu trúc + style ngay khi mở editor lần đầu (2 template dựng sẵn trong `templateGallery.ts`, hiển thị trong PresetPanel kể cả khi chưa từng lưu template nào)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Real-time multi-user collaboration (kiểu Figma) | Cần backend/server đồng bộ, WebSocket, conflict resolution — vượt xa quy mô app desktop hiện tại; "collaboration qua file" (US-128) đạt phần lớn giá trị thực tế cho nhóm nhỏ với chi phí thấp hơn nhiều bậc |
| Cloud hosting cho export (share link kiểu Loom) | Cần backend lưu trữ + CDN — quyết định hạ tầng lớn, khác hẳn phạm vi "app chạy local" đã chọn từ đầu dự án |
| AI tóm tắt nội dung để tự sinh chapter | Phụ thuộc AI/API ngoài, chi phí + độ tin cậy chưa chắc; chapter thủ công (US-125) đơn giản và người dùng kiểm soát hoàn toàn |

Bốn sprint 12-15 hoàn thiện app theo trình tự: **12 làm app đáng tin (không mất dữ liệu, tự cập nhật)** → **13 làm app ai cũng dùng được** → **14 làm app không tự phá vỡ chính mình khi sửa tiếp** → **15 làm app phù hợp với cách nhóm/series thực sự làm việc**, thay vì tối ưu cho use case "1 video đơn lẻ" duy nhất.
