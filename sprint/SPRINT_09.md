# Sprint 9 — Smart Editing: Tự Động Cắt Khoảng Lặng + Speed Ramping + Annotations

**Duration:** Week 29-32 (4 tuần)
**Goal:** Biến editor từ "công cụ trang trí video" thành "công cụ tiết kiệm thời gian thật sự": tự động phát hiện & cắt khoảng lặng (dead air), tăng tốc đoạn nhàm chán theo từng segment, thêm text/callout annotations, xuất dọc 9:16 cho social, và render keystroke overlay vào export (data đã capture sẵn nhưng đang bị bỏ phí).
**Status:** ✅ Done

---

## Sprint Goal

> Sprint này do chính người thực hiện Sprint 6-8 đề xuất, dựa trên nguyên tắc: **tính năng đáng làm nhất là tính năng tiết kiệm thời gian cho người dùng nhiều nhất trên mỗi video họ làm**. Sau Sprint 8, app đã có đủ "cơ bắp" (multi-segment, manual zoom, codec options) — nhưng người làm video demo/tutorial vẫn phải tự làm 3 việc tốn thời gian nhất bằng tay:
>
> 1. **Cắt khoảng lặng thủ công.** Một video demo 10 phút thô thường có 2-4 phút dead air (suy nghĩ, chờ app load, gõ nhầm). Hiện tại người dùng phải nghe lại toàn bộ, tự tìm từng khoảng lặng rồi split + delete từng đoạn. Đây là lý do #1 người ta trả tiền cho Screen Studio thật. **Hạ tầng đã sẵn sàng**: Sprint 8 đã có `segments[]` + split/ripple-delete + export concat — chỉ cần thêm bước "tự động đề xuất chỗ cắt" bằng `silencedetect` của ffmpeg.
> 2. **Đoạn gõ phím/chờ đợi dài lê thê.** Không phải chỗ nào cũng nên cắt — đoạn gõ code, điền form nên **tua nhanh 2-4×** thay vì cắt bỏ (giữ tính liên tục). Cần speed control per-segment.
> 3. **Không có cách nào chú thích.** Video hướng dẫn cần text/callout ("Bấm vào đây", "Bước 1: ..."). Hiện tại phải export rồi mở CapCut/Premiere chỉ để thêm chữ — phá vỡ toàn bộ giá trị "one-tool workflow".
>
> Cộng thêm 2 gap "gần như miễn phí" phát hiện khi đọc code: (a) keystroke events (`keydown` + `display` như `⌘⇧5`) **đã được cursor-tracker ghi vào cursor.json từ Sprint 4** nhưng chỉ hiện overlay lúc đang quay, chưa bao giờ render vào export — người xem tutorial rất cần thấy phím tắt; (b) video demo ngày nay đăng lên TikTok/Shorts/Reels (9:16) nhiều hơn YouTube ngang — app chưa có cách xuất dọc tử tế.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-072 | Tự động phát hiện khoảng lặng: chạy `silencedetect` trên audio track, hiển thị các vùng lặng (> ngưỡng ~1.5s) trên timeline dưới dạng vùng mờ đề xuất cắt | P0 | M | ✅ Done |
| US-073 | "Remove all silences" 1-click: chuyển toàn bộ vùng lặng đã phát hiện thành ripple-delete (tái dùng `segments[]` + `splitSegmentAt`/`removeSegment` từ Sprint 8), có thể undo, có thể bỏ chọn từng vùng trước khi apply | P0 | L | ✅ Done |
| US-074 | Speed control per-segment: chọn 1 segment trên timeline → set tốc độ 1×/1.5×/2×/4×; preview đổi `playbackRate`, export dùng `setpts`+`atempo` cho đúng segment đó | P0 | L | ✅ Done |
| US-075 | Text annotations: thêm text overlay có `startTime`/`endTime`/`position`/`style` (tối thiểu: heading + body, màu, nền pill); hiện trong preview + track riêng trên timeline, render vào export bằng `drawtext` | P0 | L | ✅ Done |
| US-076 | Keystroke overlay trong export: đọc `keydown` events từ cursor.json (đã có field `display`), render badge phím tắt vào export bằng `drawtext` với fade in/out; toggle bật/tắt trong sidebar | P1 | M | ✅ Done |
| US-077 | Xuất dọc 9:16 (TikTok/Shorts/Reels): thêm aspect ratio option trong ExportModal; crop thông minh theo tâm zoom hiện hành (đã có `centerX/centerY` per zoom event) thay vì crop giữa cứng | P1 | M | ✅ Done |
| US-078 | Noise reduction cho mic: toggle "Reduce background noise" trong export options, thêm `afftdn` vào audio filter chain — 1 dòng filter, giá trị lớn cho người quay ở môi trường ồn | P1 | S | ✅ Done |
| US-079 | Hiển thị vùng lặng trên `AudioWaveform` (nền đỏ nhạt) để người dùng thấy trước khi bấm detect — tăng niềm tin vào auto-cut | P2 | S | ✅ Done |

---

## Định hướng kỹ thuật

**Silence detection & removal (US-072, US-073, US-079):**
- Main process: handler mới `audio:detect-silence` spawn ffmpeg `-i capture.mov -af silencedetect=noise=-35dB:d=1.2 -f null -`, parse stderr lấy các cặp `silence_start`/`silence_end`, trả về `{ start, end }[]`. Chạy async, cache kết quả theo mtime của video (giống pattern thumbnail cache Sprint 7).
- Renderer: store thêm `silenceRegions: { start, end, selected }[]`; vẽ lên timeline như các vùng amber mờ; nút "Detect silences" trong sidebar hoặc trên timeline.
- "Remove all": với mỗi vùng lặng được chọn (co lại 0.15s mỗi đầu để không cắt cụt tiếng), gọi tuần tự `splitSegmentAt(start)`, `splitSegmentAt(end)`, `removeSegment(giữa)` — toàn bộ đi qua store hiện có nên **undo/redo hoạt động sẵn** (Sprint 6) và export multi-segment hoạt động sẵn (Sprint 8). Không cần code export mới.
- Lưu ý: sau khi apply, timestamps của vùng lặng còn lại không đổi (segments giữ source-time), nên apply theo thứ tự từ **cuối về đầu** không cần re-map.

**Speed per-segment (US-074):**
- `TrimSegment` thêm field optional `speed?: number` (default 1). Migrate: field optional nên project cũ không cần chuyển đổi.
- Preview: `PreviewCanvas` set `video.playbackRate = activeSegment.speed` theo playhead; cần map "conceptual time ↔ source time" trong playback store khi có speed ≠ 1 (điểm phức tạp nhất của story này).
- Export: trong `buildConcatFilter`, segment có speed S ≠ 1 thêm `setpts=PTS/S` (video) và `atempo=S` (audio; atempo chỉ nhận 0.5-2.0 nên 4× = `atempo=2.0,atempo=2.0`).
- Zoom events nằm trong segment tăng tốc: chia thời lượng theo S khi re-map trong `remapZoomEventsToSegments`.

**Text annotations (US-075):**
- `ProjectState` thêm `annotations: Annotation[]` với `{ id, text, startTime, endTime, x, y, style: 'heading' | 'pill' | 'plain', color }` (normalized 0-1 position, source-time giống zoomEvents).
- Preview: absolutely-positioned div trên video frame (giống cursor highlight overlay), kéo để đổi vị trí, double-click để sửa text.
- Timeline: track mỏng mới (giống `ZoomEventTrack`, tái dùng pattern kéo edge + nút ✕ từ Sprint 8).
- Export: `drawtext=text='...':x=...:y=...:enable='between(t,START,END)'` + `box=1:boxcolor=black@0.5:boxborderw=12` cho style pill. Escape text cẩn thận (`'`, `:`, `\` là ký tự đặc biệt của drawtext). Font: dùng SF Pro system path hoặc bundle 1 font TTF vào resources để render ổn định.
- Annotations cũng phải đi qua `remapZoomEventsToSegments`-style re-map khi multi-segment (viết hàm remap dùng chung cho "timed events").

**Keystroke trong export (US-076):**
- Data đã có: cursor.json chứa `{ type: 'keydown', display: '⌘⇧5', t }`. Lọc bỏ ký tự thường (chỉ giữ combo có modifier — giống logic KeystrokeOverlay.tsx đang làm với `metaKey/ctrlKey/altKey`).
- Export: mỗi keydown thành 1 `drawtext` với `enable='between(t,T,T+1.5)'` + `alpha='...'` fade; giới hạn ~30 badge/video để filtergraph không phình (quá thì gộp các phím liền nhau <300ms thành 1 badge).
- Cùng cơ chế re-map source-time → conceptual-time như annotations.

**Vertical export (US-077):**
- `ExportOptions` thêm `aspectRatio?: '16:9' | '9:16' | '1:1'`; ExportModal thêm picker (default 16:9, giữ nguyên hành vi cũ).
- 9:16: sau bước zoompan/scale, crop `ih*9/16 : ih` với `x` theo `centerX` của zoom event đang active (expr `between(t,...)` giống buildXExpr) — vùng người dùng đang zoom vào cũng chính là vùng đáng giữ khi crop dọc. Ngoài vùng zoom: crop giữa.
- Background/padding render theo canvas dọc (W/H hoán đổi), giữ nguyên pipeline còn lại.

**Noise reduction (US-078):**
- `ExportOptions.denoiseMic?: boolean`; trong audio chain chèn `afftdn=nf=-25` trước `aformat`. Toggle trong ExportModal cạnh audio bitrate.

---

## Definition of Done

- [x] Bấm "Detect silences" trên video có khoảng lặng → các vùng lặng hiện trên timeline trong <5s (video 10 phút), ngưỡng mặc định bắt được khoảng nghĩ ~1.5s+ nhưng không bắt nhịp nói chuyện bình thường
- [x] Bấm "Remove all silences" → các vùng lặng biến thành ripple-delete, ⌘Z hoàn tác được toàn bộ về trạng thái trước khi apply, export ra video liền mạch không dead air
- [x] Có thể bỏ chọn từng vùng lặng riêng lẻ trước khi apply (không phải all-or-nothing)
- [x] Set segment tốc độ 2× → preview phát nhanh 2× đúng đoạn đó, export ra video + audio nhanh 2× đúng đoạn đó, các đoạn khác giữ 1×, zoom events không lệch thời gian
- [x] Thêm text annotation, kéo đổi vị trí trên preview, chỉnh thời gian trên timeline → export ra video có đúng text tại đúng vị trí/thời điểm, kể cả khi project có multi-segment
- [x] Bật keystroke overlay → export hiện badge phím tắt (⌘C, ⌘⇧5...) đúng thời điểm bấm, có fade, không hiện ký tự gõ văn bản thường
- [x] Chọn 9:16 trong ExportModal → file xuất ra đúng tỷ lệ dọc, khung hình bám theo vùng đang zoom thay vì crop giữa cứng nhắc
- [x] Bật "Reduce background noise" → audio xuất ra giảm rõ tiếng ồn nền (quạt, máy lạnh) mà giọng nói không bị méo
- [x] Toàn bộ tính năng mới hoạt động đúng với cả project single-segment lẫn multi-segment, project cũ mở lên không lỗi (mọi field mới đều optional)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Cloud sync / share link | Cần backend + auth + hosting — vượt phạm vi app desktop hiện tại, giá trị chưa rõ khi chưa có user base |
| Motion blur cho zoom (signature Screen Studio) | `minterpolate` cực chậm (realtime × 20+), giá trị thẩm mỹ < giá trị thời gian của silence removal; để sprint sau nếu còn nhu cầu |
| AI voiceover / transcript | Cần model/API ngoài, chi phí + phức tạp cao; silence detection bằng ffmpeg đạt 80% giá trị với 5% công sức |
| Multi-track timeline (nhiều video nguồn) | Thay đổi kiến trúc lớn; use case chính (1 recording → 1 video demo) chưa cần |

Nguyên tắc xuyên suốt: **mọi story P0 đều tái sử dụng hạ tầng Sprint 8** (segments, split/delete, export concat, re-map events) — chi phí biên thấp, giá trị người dùng cao nhất trên mỗi giờ dev.


---

## Ghi chú triển khai (thực tế sau khi code)

- **Silence detection** ([audio-handlers.ts](../src/main/ipc/audio-handlers.ts)): `silencedetect=noise=-35dB:d=1.2`, cache `silence.cache.json` theo mtime. Vùng lặng co 0.15s mỗi đầu khi apply, apply từ cuối về đầu (source-time bất biến nên không cần re-map). Undo được nhờ history store Sprint 6.
- **Speed per-segment**: `TrimSegment.speed?`, badge trên segment block (click cycle 1→1.5→2→4×). Preview đổi `playbackRate` theo segment tại playhead (playhead vẫn chạy theo source-time — đơn giản hoá so với thiết kế "map conceptual↔source" ban đầu, đủ để preview đúng cảm giác tốc độ). Export: `setpts=PTS/S` + chuỗi `atempo` (2.0×2.0 cho 4×) trong `buildConcatFilter`; mọi timed event (zoom/annotation/keystroke/scene/click) đi qua `remapRangeEvents`/`remapPointEvents` có tính speed.
- **Annotations**: track riêng trên Timeline (`AnnotationTrack.tsx`), click block mở popover sửa text/style/màu; kéo trên preview đổi vị trí. Export dùng `drawtext` với font Helvetica hệ thống; dấu `'` được thay bằng `’` typographic để né escaping hell của drawtext.
- **Keystroke export**: renderer lọc combo có modifier (⌘⌃⌥) từ cursorEvents, gộp <300ms, cap 30; render badge bottom-center với alpha fade. Không cần đọc lại cursor.json ở main process.
- **9:16 / 1:1**: canvas W tính từ H theo aspect; nguồn scale-to-height rồi `crop` với `x` expression bám `centerX` của zoom event active (`buildCropXExpr`), mặc định crop giữa.
- **Denoise**: `afftdn=nf=-25` chèn vào audio chain khi bật toggle.
