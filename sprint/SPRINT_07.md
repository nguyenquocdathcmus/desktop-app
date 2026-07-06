# Sprint 7 — Home Screen: Performance + Redesign

**Duration:** Week 21-24 (4 tuần)
**Goal:** Home screen load nhanh hơn (cache + song song hoá ffmpeg probe/thumbnail), giao diện mượt hơn (skeleton loading, progressive reveal) và nhìn "pro" hơn (toolbar, search/sort, polish card).
**Status:** ✅ Done

---

## Sprint Goal

> Root cause đã xác định: `recordings:list` handler ([recordings-list-handler.ts](../src/main/ipc/recordings-list-handler.ts)) chạy vòng lặp `for...of` **tuần tự** qua từng recording, mỗi cái spawn 2 tiến trình ffmpeg riêng (probe metadata + tạo thumbnail), không cache — thumbnail bị tạo lại từ đầu mỗi lần mở Home dù video không đổi. Đây là nguyên nhân chính khiến màn hình Home load chậm và "khựng" (một spinner to rồi cả grid hiện ra cùng lúc). Sprint này xử lý cả performance (backend) và trải nghiệm (UI redesign, do UI Designer đề xuất dựa trên design system hiện có — màu `#1a1a1a`/`#2a2a2a`/`#141414`, accent `indigo-500`).

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-053 | Cache thumbnail + metadata (duration/width/height) ra file, chỉ re-probe khi video thay đổi (mtime/size) | P0 | M | ✅ Done |
| US-054 | Song song hoá probe/thumbnail giữa các recording (Promise.all thay vì for-await tuần tự) | P0 | S | ✅ Done |
| US-055 | Trả metadata list ngay lập tức (không đợi thumbnail), thumbnail load incremental theo từng id | P0 | L | ✅ Done |
| US-056 | Skeleton loading: shimmer placeholder cho từng thumbnail card thay vì spinner toàn màn hình | P0 | M | ✅ Done |
| US-057 | Progressive reveal: card xuất hiện dần theo metadata, thumbnail cross-fade khi resolve xong | P1 | S | ✅ Done |
| US-058 | Toolbar mới: search (client-side filter theo tên/ngày), sort dropdown (Newest/Oldest/Longest/Largest) | P1 | M | ✅ Done |
| US-059 | View toggle grid/list + responsive grid-cols (thêm `xl:grid-cols-4` cho màn rộng) | P2 | S | ✅ Done |
| US-060 | Card polish: hover translate thay vì glow, đồng bộ timing animation, chuẩn hoá kích thước nút Delete/Finder | P2 | S | ✅ Done |

---

## Định hướng kỹ thuật (từ audit + UI Designer)

**Backend (US-053, 054, 055) — đã implement, cách thực tế khác định hướng ban đầu ở US-055:**
- Cache ghi ra `meta.cache.json` + `thumb.cache.jpg` cạnh `capture.mov` trong mỗi recording dir (không phải `.meta.json`/`.thumb.jpg` như dự kiến ban đầu — tên file khác nhưng cùng ý tưởng); so sánh `mtimeMs` của video trước khi re-run ffmpeg ([recordings-list-handler.ts](../src/main/ipc/recordings-list-handler.ts)).
- Vòng lặp `for...of` tuần tự đã đổi thành `Promise.all(ids.map(...))` — probe/thumbnail chạy song song.
- US-055 hiện thực theo hướng **pull thay vì push**: `recordings:list` trả metadata ngay (dùng cache nếu có, không đợi ffmpeg cho phần đã cache); phía renderer, mỗi card tự gọi `window.api.getThumbnail(id)` khi `thumbnailDataUrl` là `null` (component `RecordingThumbnail`) — không dùng event `recordings:thumbnail-ready` broadcast như định hướng ban đầu. Đơn giản hơn (không cần quản lý subscription per-id) và đạt cùng mục tiêu UX.

**Frontend (US-056, 057, 058, 059, 060) — theo đề xuất UI Designer:**
- Header/toolbar: `sticky top-0 z-10 bg-[#141414]/80 backdrop-blur-md border-b border-[#2a2a2a]`, gồm search input, sort dropdown (tái dùng pattern pill `bg-[#2a2a2a] hover:bg-[#333]` từ ControlBar), view toggle icon.
- Thumbnail skeleton: gradient shimmer (`bg-gradient-to-r from-[#141414] via-[#1f1f1f] to-[#141414]`, keyframe `shimmer` thêm vào `tailwind.config.js`) thay cho emoji tĩnh khi `thumbnailDataUrl` chưa có.
- Thumbnail resolve xong: cross-fade bằng keyframe `fadeIn` (opacity 0→1, 300ms) thay vì hiện đột ngột.
- Card mount lần đầu: stagger `fadeInUp` theo index (cap ~10 card đầu để tránh chậm với library lớn).
- Grid: `gap-4`→`gap-5`, thêm `xl:grid-cols-4`; hover đổi từ `shadow-lg shadow-indigo-500/10` sang `hover:-translate-y-0.5` + `shadow-md` cho cảm giác "pro" hơn glow.
- Chuẩn hoá nút Delete/Finder về cùng `w-6 h-6 rounded-md`.

---

## Definition of Done

- [x] Mở Home lần 2 trở đi với recordings đã xem trước đó → thumbnail hiện gần như tức thì (dùng cache `thumb.cache.jpg`/`meta.cache.json`, không re-chạy ffmpeg nếu `mtimeMs` không đổi)
- [x] Danh sách metadata (ngày, size, duration) hiện ra ngay cả khi thumbnail còn đang xử lý (mỗi card tự fetch thumbnail độc lập qua `getThumbnail`, không chặn danh sách)
- [x] Không còn cảnh "một spinner to rồi cả grid bật ra cùng lúc" — card xuất hiện dần (`fadeInUp` stagger), thumbnail cross-fade khi sẵn sàng (`fadeIn`)
- [x] Có thanh search và dropdown sort (Newest/Oldest/Longest/Largest) hoạt động client-side — recordings không có tên tuỳ chỉnh nên search lọc theo ngày hiển thị/id, không phải "tên" file
- [x] Grid tự responsive thêm cột trên màn hình rộng (`xl:grid-cols-4`), có thêm view toggle Grid/List
- [x] Hover card mượt hơn (translate + shadow nhẹ), timing animation nhất quán giữa các phần tử trong card
