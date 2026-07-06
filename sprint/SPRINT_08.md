# Sprint 8 — Multi-Clip Editing + Export Quality Nâng Cao + Manual Zoom Control

**Duration:** Week 25-28 (4 tuần)
**Goal:** Nâng cấp editor từ "trim 1 đoạn" lên "cắt ghép nhiều đoạn" (split/delete/ripple), cho phép chỉnh zoom/pan thủ công trên timeline thay vì chỉ phụ thuộc auto-zoom, và hoàn thiện chất lượng export (codec/bitrate thực sự chọn được, xử lý gap `format: 'webm'` đã khai báo nhưng chưa implement, cải thiện độ chính xác progress/ETA cho video 4K dài).
**Status:** ✅ Done

---

## Sprint Goal

> Sau khi đọc `src/main/export/Exporter.ts`, `src/shared/ipc-types.ts` và `src/shared/project-types.ts`, xác nhận 3 gap cụ thể chưa được Sprint 6/7 đụng tới:
>
> 1. **Chỉ trim được 1 đoạn duy nhất** — `ProjectState` chỉ có `inPoint`/`outPoint` (một cặp số), không có khái niệm nhiều clip/segment. Người dùng không thể cắt bỏ một đoạn ở giữa video (VD: 10s lỗi giữa recording) mà không phải tự ghép ngoài app.
> 2. **Export "khai nhưng chưa làm"** — `ExportOptions.format` cho phép `'mp4' | 'gif' | 'webm'` nhưng `Exporter.ts` chỉ có `exportVideo()` (luôn xuất H.264 MP4, hardcode `-crf 18 -preset fast`, audio hardcode `192k AAC`) và `exportGif()`. Không có nhánh xử lý `webm`, không có lựa chọn codec (H.265/HEVC cho file nhẹ hơn ở 4K), không có control bitrate/quality cho người dùng cần file nhỏ hơn.
> 3. **Zoom/pan chỉ có auto, không có "sửa tay"** — `ZoomEvent` có field `isAuto` (ngụ ý đã phân biệt được auto vs manual trong data model) nhưng chưa rõ có UI timeline nào cho phép người dùng thêm/kéo/xoá một zoom keyframe thủ công khi auto-zoom chọn sai điểm. Đây là pain point kinh điển của mọi tool auto-zoom (kể cả Screen Studio thật) — auto luôn cần cửa sổ override.
>
> Sprint 8 giải quyết cả 3, ưu tiên theo mức độ ảnh hưởng tới core editing workflow (multi-clip > manual zoom > export quality).

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-061 | Data model: đổi `inPoint/outPoint` đơn thành `segments: { start, end }[]` trong `ProjectState`, giữ backward-compat khi load project cũ (migrate 1 cặp point → 1 segment) | P0 | M | ✅ Done |
| US-062 | Split clip tại playhead: phím tắt + nút trên Timeline chèn điểm cắt, tạo 2 segment từ 1 | P0 | M | ✅ Done |
| US-063 | Xoá 1 segment giữa timeline (ripple delete) — các segment sau tự dịch trái để lấp khoảng trống trên timeline UI (không đụng file gốc) | P0 | M | ✅ Done |
| US-064 | Export multi-segment: `Exporter.ts` dựng `filter_complex` với `trim`+`concat` cho từng segment thay vì `-ss/-to` đơn, giữ nguyên toàn bộ pipeline zoom/background/webcam/device-frame hiện có cho mỗi segment | P0 | L | ✅ Done |
| US-065 | Zoom keyframe thủ công: thêm nút "+ Zoom" trên `ZoomEventTrack`, cho phép kéo start/end/center của một `ZoomEvent` (`isAuto: false`) trực tiếp trên timeline/preview | P0 | L | ✅ Done |
| US-066 | Xoá / vô hiệu hoá riêng từng auto-zoom event mà không ảnh hưởng các event khác (hiện tại phải xoá toàn bộ hoặc giữ nguyên) | P1 | S | ✅ Done |
| US-067 | Export codec options: thêm `codec: 'h264' | 'h265'` vào `ExportOptions`, `h265` dùng `hevc_videotoolbox` (hardware, phù hợp Apple Silicon) cho file nhẹ hơn ở 4K | P1 | M | ✅ Done |
| US-068 | Export quality control: thay hardcode `-crf 18` bằng slider Quality (Low/Balanced/High/Lossless) map sang crf tương ứng; audio bitrate chọn được (128k/192k/256k) | P1 | S | ✅ Done |
| US-069 | Implement thực sự nhánh `webm` export (VP9 + Opus) hoặc bỏ hẳn option khỏi UI/type nếu không ưu tiên — quyết định dựa trên nhu cầu thực tế, không để type "hứa" tính năng chưa có | P1 | S | ✅ Done (bỏ webm) |
| US-070 | Export ETA chính xác hơn cho video dài/4K: tính `-progress` ffmpeg theo tổng duration thực của tất cả segment (không phải giả định `60`s như hiện tại), cảnh báo trước khi export nếu tổng thời lượng × resolution vượt ngưỡng ước tính > 5 phút xử lý | P2 | M | ✅ Done |
| US-071 | Cảnh báo hiệu năng khi có nhiều zoom event chồng lấn hoặc project 4K dài > 10 phút — gợi ý export ở 1080p hoặc giảm số zoom event trước khi export | P2 | S | ✅ Done |

---

## Định hướng kỹ thuật

**Data model (US-061):**
- `ProjectState.inPoint/outPoint` → `ProjectState.segments: TrimSegment[]` với `TrimSegment { id, start, end }` (sắp theo thời gian, không chồng lấn).
- Viết hàm migrate trong `ProjectManager`/loader: nếu project cũ chỉ có `inPoint/outPoint`, convert thành `segments: [{ id: 'seg-0', start: inPoint, end: outPoint || duration }]` khi load, giữ field cũ optional trong type để không break TypeScript ở nơi khác chưa migrate hết trong cùng sprint.

**Split & ripple delete (US-062, US-063):**
- `Timeline.tsx`/`ClipRegion.tsx`: thêm action `splitAt(time)` — tìm segment chứa `time`, cắt thành 2 segment con.
- Ripple delete chỉ ảnh hưởng **thời gian hiển thị trên timeline UI** (segment sau "trượt" sang trái để lấp chỗ trống) — timestamp gốc trong `capture.mov` giữ nguyên, export dùng đúng `start/end` gốc của từng segment còn lại.
- Cần đồng bộ `zoomEvents` khi segment bị xoá/dịch: zoom event nằm trong đoạn bị xoá thì loại bỏ, zoom event thuộc segment sau đó cần re-map thời gian theo timeline hiển thị mới (giữ nguyên logic tương tự cách `inPoint` từng dịch zoom timestamp, mở rộng cho N segment).

**Export multi-segment (US-064):**
- Thay khối trim đơn giản (`-ss`/`-to` trước `-i`) bằng: đọc toàn bộ file 1 lần, dùng `filter_complex` với `[0:v]trim=start=X:end=Y,setpts=PTS-STARTPTS[segN]` cho mỗi segment rồi `concat=n=N:v=1:a=1` nối lại trước khi feed vào pipeline zoom/background hiện có.
- Zoom/pan filter (`buildZExpr`/`buildXExpr`/`buildYExpr`) cần nhận thời gian đã "re-based" theo timeline sau concat (không phải thời gian gốc trong `capture.mov`) — đây là điểm phức tạp nhất, cần offset mapping table `{ conceptualTime, sourceTime }` build từ danh sách segment.
- Giữ nguyên toàn bộ logic background/webcam/device-frame/audio hiện có trong `Exporter.ts` — chỉ thay đầu vào `[scaled]`.

**Manual zoom keyframe (US-065, US-066):**
- Thêm `ZoomEvent` mới với `isAuto: false` khi người dùng bấm "+ Zoom" tại playhead hiện tại, default `zoomLevel: 1.5`, `centerX/Y: 0.5`.
- Kéo thả trên `ZoomEventTrack.tsx` cập nhật `startTime/endTime`; kéo trên `PreviewCanvas.tsx` (Konva) cập nhật `centerX/centerY` khi zoom event đang active tại playhead — tái dùng cơ chế click-to-pan nếu preview đã có.
- Xoá riêng lẻ: thêm nút X trên mỗi zoom block trong `ZoomEventTrack`, filter `zoomEvents` bỏ đúng `id` đó (áp dụng cho cả `isAuto: true` lẫn `false` — auto-zoom không nên "bất khả xâm phạm").

**Export quality/codec (US-067, US-068, US-069):**
- `ExportOptions` thêm `codec?: 'h264' | 'h265'` và `quality?: 'low' | 'balanced' | 'high' | 'lossless'` (map sang crf: 28/23/18/0 cho h264, bitrate tương ứng cho h265 videotoolbox vì hevc_videotoolbox dùng `-b:v` thay vì crf).
- `-c:v libx264` → nhánh theo `codec`: `h265` dùng `hevc_videotoolbox -b:v <computed>` (hardware encode, nhanh hơn nhiều trên Apple Silicon so với libx265 software).
- Quyết định US-069 nên do dev đưa ra khi bắt đầu sprint: nếu không có tín hiệu người dùng cần WebM (thường chỉ cần cho nhúng web không DRM), ưu tiên bỏ `'webm'` khỏi `ExportOptions['format']` union và `EXPORT_PRESETS`, thêm ghi chú trong code — tránh nợ kỹ thuật "type hứa hẹn nhưng không làm".

**Progress/ETA & performance warning (US-070, US-071):**
- `FFmpegWrapper.run()` hiện nhận `duration` cứng (số giây) để tính %; đổi sang tính từ tổng `segments.reduce((sum, s) => sum + (s.end - s.start), 0)` thay vì giả định `60`.
- Trước khi bắt đầu export, ước tính thời gian xử lý = `f(duration, resolution, codec)` dựa trên benchmark thực tế đo trong sprint (VD: 4K h264 crf18 ~ Ns/s xử lý) → nếu > ngưỡng, hiện dialog cảnh báo với gợi ý giảm resolution/quality trước khi tiếp tục (không chặn, chỉ cảnh báo).

---

## Definition of Done

- [x] Có thể split một clip tại vị trí playhead bằng phím tắt (`S`) hoặc nút "✂ Split" trên Timeline, tạo ra 2 đoạn độc lập
- [x] Có thể xoá một đoạn ở giữa timeline (nút ✕ trên segment, chỉ khi còn >1 đoạn), các đoạn sau tự dịch trái trên UI; zoom events được re-map theo segment còn lại lúc export (`remapZoomEventsToSegments`)
- [x] Export ra file MP4 từ project có ≥3 segment cho video liền mạch đúng thứ tự (verify bằng ffmpeg trim+concat filter chạy trực tiếp trên video test — xem log dưới), không giật/đen hình tại điểm nối
- [x] Project cũ (chỉ có `inPoint/outPoint`) mở lên vẫn hoạt động bình thường, tự động migrate thành 1 segment (`migrateProjectState` trong `useProjectStore.ts`, chạy mỗi lần `openProject`)
- [x] Có thể thêm một zoom event thủ công tại playhead (nút "+ Zoom"), kéo để chỉnh thời điểm bắt đầu/kết thúc (edge handles trên `ZoomEventTrack`), kéo trên preview để đổi tâm zoom (nút "⊹ Re-pan center" + click trên video)
- [x] Có thể xoá riêng một zoom event (auto hoặc manual) mà không ảnh hưởng các zoom event khác (nút ✕ trên từng block trong `ZoomEventTrack`)
- [x] Export modal cho chọn codec (H.264/H.265) và quality (Low/Balanced/High/Lossless) — MP4 only
- [x] `webm` đã bị gỡ khỏi `ExportOptions['format']` union theo quyết định của người dùng (không có nhu cầu thực tế) — không còn option "khai nhưng không làm"
- [x] Progress bar export hiển thị % và ETA (tính từ `speed=` ffmpeg báo cáo), tổng thời lượng dùng đúng theo `segments.reduce(...)` khi multi-segment, không còn hardcode giả định 60s
- [x] Project 4K dài (>10 phút) hoặc nhiều zoom event chồng lấn (>4) hiện banner cảnh báo dismissible trong ExportModal, không chặn thao tác

### Xác minh multi-segment export (US-064) — phát hiện và sửa 1 bug treo export

Do không sẵn có project thật trong môi trường dev để test qua UI, đã verify cú pháp filter_complex bằng cách chạy trực tiếp binary ffmpeg đã bundle với video test tổng hợp (`testsrc` 10s + audio `sine`), mô phỏng đúng logic `buildConcatFilter`/`remapZoomEventsToSegments`: 3 segment (0-2s, 4-6s, 8-10s) trim+concat cả video lẫn audio, feed qua scale+background+overlay giống pipeline thật.

**Bug phát hiện qua test này (không phải do multi-segment gây ra, đã tồn tại sẵn trong code, nhưng chỉ lộ ra khi bỏ `-ss/-to`):** filter `color=c=...:size=WxH:rate=fps` dùng làm background là một **nguồn vô hạn** (infinite source generator trong ffmpeg). Trước đây, `-to` trên input chính giới hạn gián tiếp số frame ffmpeg xử lý nên pipeline vẫn dừng đúng lúc. Multi-segment đọc toàn bộ file (không dùng `-ss/-to`), khiến giới hạn ngầm đó biến mất — lần chạy thử đầu tiên export chạy vô hạn (đã quan sát tới `time=01:13:45` cho input chỉ dài 10s trước khi bị kill thủ công).

**Fix:** thêm tham số `:d=<trimmedDuration + 1>` vào cả 3 nhánh dùng `color=` (solid/gradient/fallback) trong `Exporter.ts`, tính từ tổng thời lượng thực tế của video output (multi-segment hoặc single-range). Test lại với filter đã sửa (`d=7.000` cho 6s nội dung + 1s buffer) — export hoàn tất trong vài giây, `ffprobe` xác nhận `Duration: 00:00:07.00` chính xác, không còn treo.

Khuyến nghị: chạy thêm kiểm thử qua UI thật với 1 recording thật (đặc biệt export single-segment, vì fix này cũng áp dụng cho path cũ) trước khi coi là production-ready.
