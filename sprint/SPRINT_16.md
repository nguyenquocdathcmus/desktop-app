# Sprint 16 — Proxy Preview Performance: Editing Long 4K Recordings Without Stutter

**Duration:** Week 57-60 (4 tuần)
**Goal:** `PreviewCanvas.tsx` phát trực tiếp `capture.mov` gốc — với recording 4K dài (đúng use case mà cảnh báo hiệu năng Sprint 8 đã cảnh báo nhưng chưa xử lý tận gốc), scrubbing timeline giật, seek chậm, CPU cao khi chỉ đang xem preview không export. Sprint này thêm proxy video độ phân giải thấp cho việc edit mượt, giữ nguyên chất lượng gốc cho export.
**Status:** ✅ Done (US-137 profiling 🟡 Partial — no Intel test machine available)

---

## Sprint Goal

> Khảo sát xác nhận `PreviewCanvas.tsx` gán thẳng `src={file://manifest.videoPath}` — không có bước tạo bản xem trước độ phân giải thấp nào. Với recording 4K60 (RecordingSession vẫn ghi lossless HEVC ở độ phân giải capture gốc trước khi cap `maxHeight: 1080` chỉ áp cho *capture*, không áp cho *edit sau này* nếu người dùng bật lại full-res), mỗi lần seek trên Timeline buộc trình duyệt decode frame HEVC 4K — trên máy không có GPU mạnh, việc này giật rõ rệt và ăn pin nhanh khi edit lâu.
>
> Đây là vấn đề kinh điển trong editor video chuyên nghiệp (Premiere, Resolve đều có "proxy workflow") nhưng app hiện chưa có khái niệm này — mọi sprint trước tối ưu *export* (Sprint 8 multi-segment, Sprint 10 codec) nhưng chưa ai tối ưu *trải nghiệm edit* cho file nặng. Cảnh báo hiệu năng ở Sprint 8 (US-071) chỉ cảnh báo trước export — không giải quyết việc edit đã giật từ trước đó.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-131 | Sinh proxy video (720p H.264, ultrafast preset) song song nền ngay sau khi recording dừng — không chặn việc mở editor, dùng bản gốc tạm thời trong lúc proxy đang render | P0 | L | ✅ Done |
| US-132 | `PreviewCanvas` phát proxy thay vì bản gốc khi có sẵn; toggle "Full quality preview" cho người muốn xem đúng màu/nét (đánh đổi giật lấy chính xác) | P0 | M | ✅ Done |
| US-133 | Toạ độ zoom/annotation/webcam luôn tính theo *tỷ lệ normalized* (đã đúng từ đầu — zoomEvent dùng 0-1) nên không cần đổi gì khi chuyển qua lại proxy/gốc; viết test xác nhận điều này thay vì giả định | P0 | S | ✅ Done |
| US-134 | Cache proxy theo mtime (pattern giống thumbnail/silence cache Sprint 7/9) — không render lại nếu video không đổi; xoá proxy khi xoá recording | P1 | S | ✅ Done |
| US-135 | Progressive proxy: nếu proxy chưa xong khi mở editor lần đầu, hiện % tiến độ nhỏ góc dưới preview, tự động chuyển từ gốc sang proxy khi xong mà không giật hình | P1 | M | ✅ Done |
| US-136 | Giảm tải Timeline: virtualize `AudioWaveform` canvas draw cho video dài (chỉ vẽ đoạn đang trong viewport nếu sau này thêm zoom-timeline; hiện tại vẽ toàn bộ waveform 1 lần — audit xem có đáng tối ưu ở độ dài nào) | P2 | S | ✅ Done (audit) |
| US-137 | Memory/CPU profiling pass: đo trước/sau proxy trên máy Intel (không Apple Silicon) với recording 4K 10 phút, publish số liệu vào doc sprint | P2 | S | 🟡 Partial |

---

## Định hướng kỹ thuật

**Proxy generation (US-131, US-134):**
- Sau `RecordingSession.stop()`, spawn ffmpeg nền (không chặn `setState({ state: 'done' })`): `-vf scale=-2:720 -c:v libx264 -preset ultrafast -crf 28 -c:a copy proxy.mp4` cạnh `capture.mov`.
- Cache: `proxy.mp4` + ghi mtime nguồn vào tên hoặc file cache riêng (`proxy.cache.json`), tương tự pattern `thumb.cache.jpg`/`silence.cache.json` đã có — kiểm tra mtime trước khi render lại.
- Nếu người dùng mở editor trước khi proxy xong: `PreviewCanvas` dùng bản gốc như hiện tại, tự chuyển khi proxy sẵn sàng (US-135).

**PreviewCanvas source switching (US-132, US-133):**
- Thêm state cục bộ `useProxy` (default true nếu proxy tồn tại), source video đổi giữa `capture.mov`/`proxy.mp4` — vì mọi toạ độ zoom/annotation/webcam đã normalized 0-1 từ đầu thiết kế (Sprint 4), **không cần scale lại gì** khi đổi nguồn phát. US-133 chỉ là viết test xác nhận giả định này đúng, không phải code mới.
- Toggle "Full quality" trong ControlBar hoặc Sidebar — tắt = dùng proxy (mặc định), bật = dùng gốc.

**Progressive proxy (US-135):**
- IPC event `proxy:progress`/`proxy:ready` broadcast tương tự export progress; `PreviewCanvas` lắng nghe, chuyển `src` khi ready — cần giữ nguyên `currentTime` khi swap (video mới `currentTime = oldTime` sau `loadedmetadata`).

**Profiling (US-137):**
- Không có máy Intel thật trong môi trường dev hiện tại — cân nhắc dùng Instruments (Time Profiler) trên Apple Silicon với video 4K dài để đo CPU decode trước/sau, ghi rõ giới hạn của phép đo (không phải Intel thật) vào kết quả.
- **Kết luận thực tế:** không có môi trường nào (Intel lẫn Instruments session) khả dụng trong phiên triển khai này để chạy phép đo có số liệu thật — đánh dấu 🟡 Partial thay vì tự bịa số liệu. Việc còn lại: chạy Instruments Time Profiler thật trên 1 recording 4K 10 phút, so sánh % CPU trung bình khi seek liên tục 30s với proxy bật/tắt, dán kết quả vào đây.

**Waveform audit (US-136):**
- Đọc `AudioWaveform.tsx`: canvas được vẽ theo `canvas.offsetWidth` (số cột pixel thực tế trên màn hình), không phải theo số sample âm thanh hay theo giây video — nghĩa là chi phí vẽ đã là O(chiều rộng canvas hiển thị), không phải O(thời lượng video). Video 2 phút hay 2 giờ đều vẽ cùng số cột nếu Timeline không có tính năng zoom-in (hiện chưa có).
- **Kết luận:** không cần virtualize thêm ở thời điểm này — việc này chỉ trở nên cần thiết nếu sau này thêm zoom-timeline (phóng to 1 đoạn Timeline khiến canvas logic rộng hơn viewport). Không viết code đầu cơ cho tính năng chưa tồn tại.

---

## Definition of Done

- [x] Recording 4K 5+ phút → mở editor, seek liên tục trên Timeline mượt (proxy 720p ultrafast thay thế nguồn decode nặng)
- [x] Proxy sinh ra không chặn việc mở editor ngay sau khi dừng ghi — `generateProxyInBackground` chạy fire-and-forget ngay sau `RECORDING_STOP`, không `await`
- [x] Toggle "Full quality preview" chuyển đúng giữa proxy/gốc, giữ nguyên vị trí playhead khi chuyển (dựa vào `currentTime`-sync effect đã có, chạy lại khi `videoReady` re-fire sau khi đổi `src`)
- [x] Zoom event/annotation/webcam PIP hiển thị đúng vị trí y hệt khi xem qua proxy lẫn bản gốc — `test/unit/proxy-coordinate-invariance.test.ts` xác nhận `getZoomAtTime` không nhận tham số độ phân giải, tọa độ luôn 0-1
- [x] Xoá 1 recording → proxy cache liên quan cũng bị xoá — `proxy.mp4` nằm cùng thư mục session, `recordings:delete` đã `rmSync(dir, { recursive: true })` xoá luôn, không cần thêm logic riêng
- [x] Export vẫn luôn dùng `capture.mov` gốc — `Exporter.ts` không đổi, chỉ đọc `manifest.videoPath`; proxy chỉ được tham chiếu trong `PreviewCanvas.tsx`

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| GPU-accelerated preview render (Metal/WebGL compositor riêng thay `<video>` HTML) | Đúng hướng "chuẩn công nghiệp" nhưng là viết lại toàn bộ preview pipeline — rủi ro cao, không tương xứng với vấn đề cụ thể (proxy giải quyết 80% với 20% công sức) |
| Auto-giảm proxy resolution theo cấu hình máy (detect GPU) | Phức tạp hoá logic mà lợi ích không rõ so với 1 toggle đơn giản để người dùng tự chọn |
| Background rendering ưu tiên theo vùng đang xem (chỉ proxy đoạn gần playhead trước) | Over-engineering cho video thường <30 phút; proxy toàn bộ 720p ultrafast đã đủ nhanh để không cần tối ưu thêm |

Sprint này khác các sprint tính năng trước — không thêm khả năng chỉnh sửa mới, mà làm những khả năng đã có (zoom, split, annotation, scenes) **dùng được mượt mà** trên đúng loại nội dung mà tính năng đó nhắm tới (video demo dài, thường quay ở 4K vì máy hiện đại mặc định vậy).
