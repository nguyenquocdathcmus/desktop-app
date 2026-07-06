# Sprint 25 — Capture & Export Quality Ceiling: HDR, High-FPS, Larger-Than-4K

**Duration:** Week 93-96 (4 tuần)
**Goal:** Toàn bộ pipeline capture/export hiện chuẩn hoá quanh "4K60 HEVC" (Sprint 1 gốc, nhắc lại xuyên suốt PLAN.md và nhiều sprint). Phần cứng Apple Silicon hiện tại (M-series đời mới) và màn hình ProMotion/XDR phổ biến hơn ở đúng nhóm dùng app này (developer, người làm nội dung kỹ thuật) đã vượt xa mức đó — quay 120fps màn hình ProMotion để slow-motion demo animation UI, hay giữ HDR gốc khi quay nội dung có HDR (video preview, ảnh HDR). Sprint này nâng trần chất lượng capture/export mà không phá vỡ mặc định hiện tại (vẫn 4K60 SDR cho phần lớn user).
**Status:** ✅ Done (US-189/190/191/193 verified against real hardware/ffmpeg; US-193 audit also fixed a real pre-existing zoom-export bug unrelated to HDR — xem `test/RESULTS/sprint-25-hdr-fps-verification.md`; US-194 deferred)

---

## Sprint Goal

> Ba giới hạn hiện tại phát hiện khi khảo sát:
>
> 1. **`capture` binary cứng `minimumFrameInterval = 1/60`** — không tận dụng được display ProMotion (120Hz) dù `SCStreamConfiguration` hỗ trợ, hạn chế khả năng quay slow-motion mượt cho demo animation/micro-interaction (đúng use case app nhắm tới: demo sản phẩm UI).
> 2. **Pixel format `kCVPixelFormatType_32BGRA` không giữ HDR.** Quay lại nội dung HDR thật (video HDR đang phát, ảnh HDR trong Photos) sẽ bị tone-map về SDR ngay từ lúc capture — mất thông tin không thể khôi phục ở bước export.
> 3. **Export không có tuỳ chọn giữ bit-depth cao hơn 8-bit.** `libx264`/HEVC export hiện tại mặc định 8-bit — nội dung quay từ nguồn HDR (nếu US-190 làm được) sẽ bị cắt xuống ngay khi xuất, làm hỏng toàn bộ giá trị của việc capture HDR.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-189 | Tuỳ chọn frame rate cao hơn 60fps (90/120fps) cho display hỗ trợ ProMotion: `RecordingControls` phát hiện refresh rate thật của display đã chọn, hiện tuỳ chọn nếu > 60Hz | P0 | M | ✅ Done — `DisplayInfo.refreshRate` (từ `Display.displayFrequency`, xác nhận thật `120` trên máy có ProMotion), fps picker trong `RecordingControls.tsx` + `ExportModal.tsx`; sửa luôn 1 bug thật: manifest từng ghi cứng `fps: 60` bất kể giá trị thật đã dùng |
| US-190 | Capture HDR: đổi pixel format sang `kCVPixelFormatType_ARGB2101010LEPacked` (10-bit) khi display/nội dung là HDR, giữ qua VideoToolbox HEVC 10-bit trong intermediate file | P1 | L | ✅ Done — verify thật trên Liquid Retina XDR display: `ffprobe` xác nhận `hevc (Main 10)`, `bt2020nc/bt2020/smpte2084`; đo bandwidth thật (~1.4x so SDR, không phải 2x như dự đoán ban đầu) |
| US-191 | Export giữ 10-bit HDR (HEVC Main10 profile) khi nguồn là HDR — tuỳ chọn rõ ràng trong Export modal, mặc định vẫn SDR/8-bit trừ khi user chủ động bật | P1 | M | ✅ Done — đổi hướng kỹ thuật sau khi phát hiện `hevc_videotoolbox` không tạo được session Main10 thật + không bake color tag đúng: dùng `libx265` + `-x265-params colorprim/transfer/colormatrix` (duy nhất cách verify được qua `ffprobe` thật), test thật `test/integration/export-hdr.test.ts` (4 test, tất cả pass) |
| US-192 | Cảnh báo dung lượng thực tế trước khi bật 120fps/HDR | P1 | S | ✅ Done — dùng đúng số đo thật (~1.4x, không phải 2x) trong `RecordingControls.tsx` |
| US-193 | Audit pipeline export đảm bảo hoạt động đúng với input 10-bit/120fps — không giả định 8-bit/60fps cứng ở bất kỳ đâu | P0 | M | ✅ Done — audit phát hiện **bug thật, có sẵn từ trước, không liên quan HDR**: `buildZExpr`/`buildXExpr`/`buildYExpr` dùng biến `t` trong biểu thức `zoompan`, nhưng `zoompan` chỉ nhận biến `time` — mọi export có `zoomEvents` đã luôn fail âm thầm (ffmpeg reject filter graph). Đã sửa + thêm test thật `export-real-ffmpeg.test.ts` (zoom events) và `export-hdr.test.ts` (zoom trên pipeline 10-bit) — cả 2 pass qua ffmpeg thật |
| US-194 | Preset export mới "ProRes" | P2 | S | 🔲 Deferred — để sprint sau |

---

## Định hướng kỹ thuật

**High frame rate (US-189):**
- `swift/capture/Sources/capture/ScreenCapture.swift` — đọc `display.maximumRefreshRate` (hoặc dùng `CGDisplayMode`) để giới hạn lựa chọn UI đúng theo phần cứng thật, không hiện 120fps cho display 60Hz.
- `minimumFrameInterval` trong `SCStreamConfiguration` set động theo lựa chọn, không còn hardcode.

**HDR capture (US-190):**
- Điểm rủi ro nhất sprint: `ARGB2101010LEPacked` tăng đáng kể băng thông write-to-disk — cần đo thật hiệu năng trên máy dev trước khi cam kết ship, giống tinh thần thận trọng đã áp dụng các sprint trước với tính năng chưa đo được.
- Nếu hiệu năng không đạt (dropped frames khi ghi 4K120 HDR đồng thời), hạ xuống chỉ hỗ trợ HDR ở 60fps hoặc thấp hơn — ghi rõ giới hạn thay vì ép hỗ trợ mọi tổ hợp.

**Export HDR (US-191):**
- FFmpeg: `-c:v hevc_videotoolbox -profile:v main10 -pix_fmt p010le` thay vì `yuv420p` mặc định khi HDR bật.
- Zoom/blur/annotation filter (`boxblur`, overlay) cần verify hoạt động đúng trên `p010le` — một số filter FFmpeg giả định 8-bit, audit kỹ trước khi ship.

---

## Definition of Done

- [ ] Trên display ProMotion thật, chọn 120fps → recording thật, phát lại mượt 120fps, không dropped frame nghiêm trọng (đo bằng log frame count thật vs kỳ vọng)
- [ ] Quay nội dung HDR thật (video HDR phát trên display HDR) → file capture giữ đúng dải màu HDR (verify bằng `ffprobe` xem `color_transfer`/`color_primaries` đúng HDR, không phải BT.709 SDR)
- [ ] Export với HDR bật → file HEVC Main10 phát đúng màu trên thiết bị hỗ trợ HDR (QuickTime Player làm chuẩn tham chiếu)
- [ ] Cảnh báo dung lượng hiện đúng trước khi bật tổ hợp nặng nhất (4K120 HDR)
- [ ] Zoom/blur/annotation vẫn hoạt động đúng trên input 10-bit — không có lỗi filter hoặc crash export
- [ ] Nếu HDR capture (US-190) không đạt hiệu năng chấp nhận được trong sprint, ghi rõ giới hạn cụ thể đo được, hạ P2/sprint sau thay vì ship nửa vời

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| 8K capture | Không có display 8K phổ biến ở nhóm dùng app này (dev/demo sản phẩm); ProMotion + HDR giá trị thực tế cao hơn nhiều so với độ phân giải vượt 4K |
| Tự động bật HDR/high-fps mặc định khi phát hiện phần cứng hỗ trợ | Rủi ro dung lượng file tăng đột biến ngoài kỳ vọng user không để ý bật; giữ nguyên tắc "tính năng nặng luôn opt-in" đã áp dụng nhất quán (Sprint 19 blur không mặc định bật, Sprint 21 publish không tự động) |
| ProRes làm định dạng capture gốc (thay HEVC lossless hiện tại) | Dung lượng file lớn hơn đáng kể so với HEVC lossless hiện có mà không tăng thêm giá trị cho capture gốc (ProRes hữu ích ở bước *xuất* cho hậu kỳ, không phải bước ghi) |

Sprint 25 nhắm đúng nhóm power-user đã dùng app một thời gian (không phải người mới) — nâng trần chất lượng cho ai cần, giữ nguyên trải nghiệm mặc định đơn giản cho phần lớn còn lại.
