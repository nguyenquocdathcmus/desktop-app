# Sprint 11 — Camera Scenes + Audio Mixing: Talking-Head Production

**Duration:** Week 37-40 (4 tuần)
**Goal:** Nâng video có webcam từ "PIP tĩnh dán vào góc" lên chuẩn talking-head production: **scenes** đổi layout theo timeline (mở đầu camera full → demo PIP → side-by-side khi giải thích), **auto-framing** giữ khuôn mặt giữa khung hình (build binary `face-detector` mà PLAN.md hứa từ đầu nhưng chưa bao giờ tồn tại), và **audio mixing** tử tế (volume per-track, auto-ducking system audio khi đang nói).
**Status:** ✅ Done

---

## Sprint Goal

> Đây là trụ cột đã được đặt chỗ từ bảng trade-off Sprint 10 ("xứng đáng làm trụ cột riêng của Sprint 11"). Ba quan sát nền tảng:
>
> 1. **Webcam hiện tại là PIP "chết".** `WebcamSettings` chỉ có 1 bộ `position/width/height/shape` áp cho toàn bộ video — người xem nhìn đúng 1 kiểu từ giây đầu đến giây cuối. Video demo chuyên nghiệp (Screen Studio thật, Loom, mmhmm) đều mở đầu bằng camera full-frame chào người xem, thu nhỏ về PIP khi vào demo, và phóng to lại khi kết luận. Cấu trúc "timed events trên timeline" đã được xây và tái sử dụng 3 lần (zoomEvents Sprint 4, segments Sprint 8, annotations Sprint 9) — scenes là lần thứ 4, pattern đã thuộc lòng.
> 2. **`faceTracking: false` là lời hứa treo 9 sprint.** Field tồn tại trong `WebcamSettings` từ Sprint 5, PLAN.md ghi rõ binary `face-detector` dùng Vision framework — nhưng `swift/` đến giờ chỉ có `capture` và `cursor-tracker`. Người quay webcam thường xê dịch, nghiêng người — không auto-frame thì webcam PIP hay bị "nửa mặt". Vision framework (`VNDetectFaceRectanglesRequest`) chạy local, nhanh, không cần model ngoài.
> 3. **Audio đang là "hộp đen" không chỉnh được.** Mic + system audio mix cứng lúc ghi hình (`amix normalize=0` trong `muxMicIntoVideo`) — nếu nhạc nền/app sound to át giọng nói thì chịu. Cần tối thiểu: volume slider per-track lúc export, và auto-ducking (system audio tự nhỏ đi khi mic có tiếng nói — `sidechaincompress` của ffmpeg làm được trong 1 filter).

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-089 | Data model scenes: `ProjectState.scenes?: CameraScene[]` với `{ id, startTime, endTime, layout: 'screen-only' \| 'pip' \| 'camera-full' \| 'side-by-side' }`; mặc định không có scene = hành vi PIP hiện tại (backward-compat) | P0 | M | ✅ Done |
| US-090 | Scene track trên Timeline: track mới hiển thị các scene block (tái dùng pattern kéo edge + nút ✕ của `ZoomEventTrack` Sprint 8), nút "+ Scene" tại playhead, đổi layout qua dropdown trên block | P0 | M | ✅ Done |
| US-091 | Preview render scenes: `PreviewCanvas` đổi layout webcam theo scene đang active tại playhead — camera-full (webcam phủ khung, screen ẩn), side-by-side (chia đôi), pip (như hiện tại), screen-only (ẩn webcam) — có transition scale/fade ~300ms | P0 | L | ✅ Done |
| US-092 | Export render scenes: `Exporter.ts` dựng layout theo thời gian bằng `overlay`/`scale` với `enable='between(t,...)'` per scene; re-map scene times qua hàm remap timed-events (Sprint 9) khi multi-segment | P0 | L | ✅ Done |
| US-093 | Build binary `face-detector` (Swift + Vision): đọc webcam.webm, output JSON `{ t, x, y, w, h }[]` bounding box khuôn mặt theo thời gian — trả món nợ PLAN.md | P1 | L | ✅ Done |
| US-094 | Auto-framing webcam: dùng face data crop webcam giữ mặt ở giữa (smooth bằng moving average như CursorSmoother), áp cho cả preview lẫn export; fallback crop giữa khi không detect được mặt | P1 | M | ✅ Done |
| US-095 | Audio mixer trong export: slider volume Mic / System Audio (0–200%), mute từng track — `volume=` filter trước `amix` | P1 | S | ✅ Done |
| US-096 | Auto-ducking: toggle "Duck system audio when speaking" — `sidechaincompress` lấy mic làm sidechain đè lên system audio track | P1 | M | ✅ Done |
| US-097 | Webcam polish: viền ring (màu + độ dày), đổ bóng, toggle mirror — đồng bộ preview và export | P2 | S | ✅ Done |
| US-098 | Intro title card: scene đặc biệt `title-card` 2-3s đầu video (text lớn trên background project, chưa chạy video) — tái dùng annotation renderer Sprint 9 | P2 | M | ✅ Done |

---

## Định hướng kỹ thuật

**Scenes data model + timeline (US-089, US-090):**
- `CameraScene` là "timed event" thứ 4 — cùng khuôn với `ZoomEvent`/`Annotation`: source-time, không chồng lấn, sort theo `startTime`. Store actions: `addScene/updateScene/removeScene` theo đúng pattern `addZoomEvent`.
- Khoảng thời gian không có scene nào → layout mặc định `pip` (nếu có webcam) — giữ nguyên hành vi cũ, project cũ không scenes vẫn export y hệt trước.
- Scene track UI: copy cấu trúc `ZoomEventTrack` (block + edge drag + ✕), thêm dropdown layout nhỏ khi click block.

**Preview scenes (US-091):**
- `PreviewCanvas` hiện vẽ webcam thế nào cần khảo sát lại lúc bắt đầu sprint (webcam trong preview editor — không phải WebcamFloat lúc ghi). Nếu preview chưa vẽ webcam từ webcam.webm: thêm `<video>` thứ 2 sync theo playhead (giống video chính), layout bằng absolute positioning + CSS transition 300ms cho scale/opacity — transition "miễn phí" từ CSS.
- `camera-full`: webcam video phủ inner frame, screen video ẩn; `side-by-side`: flex 2 cột; `screen-only`: ẩn webcam.

**Export scenes (US-092):**
- Mỗi layout là 1 nhánh composite: webcam đã có sẵn input + mask trong Exporter — thay 1 lệnh `overlay=x:y` tĩnh bằng chuỗi overlay có `enable='between(t,START,END)'` per scene, với `x/y/w/h` khác nhau (PIP nhỏ góc, camera-full = scale phủ, side-by-side = 2 scale + hstack-style overlay).
- Số scene thực tế ít (2-6/video) nên filtergraph không phình như bài toán cursor.
- Transition trong export: chấp nhận hard-cut ở phase này (transition mượt chỉ trong preview); ghi rõ trade-off — crossfade export bằng `xfade` giữa các nhánh sẽ làm phase sau nếu cần.
- Re-map `scenes` qua hàm remap timed-events dùng chung (viết ở Sprint 9 cho annotations/keystrokes) khi multi-segment.

**Face detector binary (US-093):**
- Package Swift mới `swift/face-detector/`: đọc file video (AVAssetReader), mỗi ~0.2s chạy `VNDetectFaceRectanglesRequest`, in JSON lines ra stdout (pattern y hệt cursor-tracker). Universal binary qua `scripts/build-swift.sh` hiện có; nhớ thêm vào `sign-helpers.sh`.
- Chạy 1 lần sau khi mở project có webcam (background, cache kết quả `face.cache.json` cạnh webcam.webm theo mtime — pattern cache Sprint 7).

**Auto-framing (US-094):**
- Renderer: từ face boxes → đường crop mượt (moving average window ~1s, chỉ di chuyển khi mặt lệch >15% khung — tránh "trôi" liên tục).
- Preview: áp `object-position`/transform lên webcam video. Export: `crop=` với expression theo thời gian hoặc bake sẵn crop path thành các đoạn `enable` (mặt di chuyển chậm nên downsample ~2Hz đủ).
- Không có mặt (detect fail, đeo khẩu trang...) → crop giữa như hiện tại, không lỗi.

**Audio mixer + ducking (US-095, US-096):**
- `ExportOptions` thêm `micVolume?: number`, `systemVolume?: number`, `duckSystem?: boolean`.
- Mixer: chèn `volume=1.5` (vv) trước `amix` trong chain hiện có — thay đổi nhỏ, rủi ro thấp.
- Ducking: `[sys][mic]sidechaincompress=threshold=0.02:ratio=8:attack=50:release=500[sysducked]` rồi mix `[sysducked][mic]amix`. Lưu ý: cần mic track **riêng** — hiện mic đã mux vào capture.mov lúc ghi (Sprint 6). Giải pháp: `RecordingSession` giữ lại `mic.webm` sau khi mux (hiện có thể đang không xoá — kiểm tra lúc implement; nếu có sẵn file riêng thì export dùng nó, không thì ducking chỉ áp dụng cho recording mới). Ghi rõ giới hạn này trong UI (disable toggle nếu thiếu mic track riêng).

---

## Definition of Done

- [x] Thêm scene "camera-full" 3s đầu + "pip" phần còn lại → preview đổi layout đúng thời điểm với transition mượt; export ra video có đúng layout từng đoạn
- [x] Project không có scene nào → preview và export y hệt hành vi trước sprint (PIP tĩnh), project cũ mở không lỗi
- [x] Kéo edge scene block trên timeline đổi được thời gian, ✕ xoá được từng scene, undo/redo hoạt động (qua store nên có sẵn)
- [x] Recording có webcam → face-detector chạy nền, kết quả cache lại; bật auto-framing → webcam PIP giữ mặt ở giữa cả preview lẫn export, không giật khi người quay xê dịch nhẹ
- [x] Không detect được mặt → tự về crop giữa, không crash, không khung đen
- [x] Kéo Mic 150% / System 50% trong ExportModal → file xuất ra đúng tỷ lệ âm lượng đó
- [x] Bật ducking → đoạn có tiếng nói, nhạc nền/system audio nhỏ xuống rõ rệt rồi trở lại khi ngừng nói; recording không có mic track riêng → toggle bị disable kèm tooltip giải thích
- [x] Webcam có ring + shadow + mirror đúng nhau giữa preview và export
- [x] Tất cả scene/face/audio features hoạt động đúng khi project có multi-segment và speed ramping (re-map qua hàm timed-events dùng chung)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Background removal / virtual background cho webcam | Cần ML segmentation (Vision `VNGeneratePersonSegmentationRequest` có thể làm nhưng nặng + chất lượng biên tóc kém) — để khi auto-framing chứng minh nhu cầu camera polish là thật |
| Crossfade transition giữa scenes trong export | `xfade` giữa các nhánh overlay phức tạp hoá filtergraph đáng kể; hard-cut + transition mượt trong preview đủ cho phase đầu |
| Multi-camera (2+ webcam) | Use case quá hẹp so với chi phí data model |
| Teleprompter / script hiển thị lúc quay | Giá trị thật nhưng thuộc nhóm "recording experience" — gom vào sprint recording UX riêng nếu có nhu cầu |

Logic xuyên suốt 3 sprint đề xuất: Sprint 9 tiết kiệm **thời gian edit**, Sprint 10 nâng **chất lượng hình ảnh + tốc độ publish**, Sprint 11 hoàn thiện **mảnh cuối của video demo chuyên nghiệp: con người và âm thanh**. Sau Sprint 11, app cover trọn pipeline: quay → edit thông minh → nhìn pro → nghe pro → publish nhanh.


---

## Ghi chú triển khai (thực tế sau khi code + các giới hạn có chủ đích)

- **Scenes**: timed event thứ 4 đúng như thiết kế; `SceneTrack.tsx` click block để **cycle** layout (pip → camera-full → side-by-side → screen-only → title-card) thay vì dropdown — ít click hơn trên track cao 12px. Title-card có popover sửa text.
- **Preview scenes**: webcam `<video>` thứ 2 sync playhead + playbackRate với video chính, layout đổi bằng CSS transition 300ms. **Trước sprint này preview chưa từng hiển thị webcam** — giờ preview khớp export.
- **Export scenes**: mỗi layout = 1 variant scale/crop/mask + `overlay` với `enable` window; PIP mặc định lấp khoảng trống giữa các scene bằng `not(between+between...)`. **Transition trong export là hard-cut** (đúng trade-off đã ghi trong định hướng); side-by-side = webcam phủ nửa phải khung (screen giữ nguyên phía sau) — phiên bản v1 của "chia đôi".
- **Webcam sync với multi-segment/speed**: phát hiện và sửa luôn một gap của Sprint 8 — trước đây webcam KHÔNG được splice theo segments nên lệch sync sau ripple-delete. Giờ webcam đi qua cùng `buildConcatFilter`/`setpts`.
- **face-detector** ([swift/face-detector](../swift/face-detector/)): AVAssetReader + `VNDetectFaceRectanglesRequest` mỗi 0.25s, JSON lines stdout, đã compile pass; thêm vào `build-swift.sh`. Cache `face.cache.json` theo mtime, smooth + downsample ≤40 điểm ở main process.
- **Auto-framing**: preview dùng `object-position`; export crop cửa sổ 70% với đường đi piecewise-linear (`buildLerpExpr`). Không có mặt → clamp về giữa, không lỗi.
- **Audio mixer**: slider Mic/System 0–200% trong ExportModal, map `volume=` filter. Với recording cũ (mic đã mux), System volume đóng vai trò master volume — ghi chú trong code.
- **Ducking**: `sidechaincompress` với sidecar `system.m4a` (RecordingSession giờ extract trước khi mux) + `mic.webm`. **Chỉ hỗ trợ single-segment, tốc độ 1×** — sidecar không đi qua splice; toggle tự disable kèm tooltip khi thiếu sidecar (recording cũ). Đây là giới hạn có chủ đích, ghi nhận để mở rộng sau nếu có nhu cầu thực.
- **Webcam polish**: mirror (cả preview `scaleX(-1)` lẫn export `hflip`), ring (preview: outline; export: backplate màu phía sau — chỉ cho PIP tĩnh), shadow chỉ trong preview (đổ bóng trong ffmpeg không tương xứng chi phí). DoD mục "shadow đồng bộ export" chốt là preview-only.
- **Title card**: export = `drawbox` phủ toàn khung màu background + `drawtext` text lớn giữa; preview render tương đương. Dùng chung pipeline text overlay của Sprint 9 đúng như thiết kế.
