# Bug thật: Window mode ghi toàn màn hình thay vì đúng 1 cửa sổ

## Triệu chứng

User chọn "Window" trong RecordingControls, chọn đúng 1 cửa sổ cụ thể (ví dụ VSCode) — recording ra vẫn là **toàn bộ màn hình**, không phải crop đúng cửa sổ đã chọn.

## Nguyên nhân gốc (xác nhận bằng test thật, không suy đoán)

`swift/capture/Sources/capture/main.swift`'s window-capture path dùng:

```swift
filter = SCContentFilter(display: display, excludingWindows: [])
config.sourceRect = CGRect(x: win.frame.origin.x - displayBounds.origin.x, ...)
```

Tức là: filter theo toàn bộ display, rồi dùng `SCStreamConfiguration.sourceRect` để crop lại đúng vùng cửa sổ. **`sourceRect` không hoạt động trên macOS 26.5.1** — verify bằng một Swift executable độc lập, tách hoàn toàn khỏi code app:

1. In ra `sourceRect` thật đang được set — đúng giá trị, đúng hệ toạ độ (point, tương đối so với display).
2. `config.width`/`config.height` đặt đúng bằng kích thước cửa sổ đã crop.
3. Pixel buffer thật trả về từ `SCStreamOutput` đúng kích thước đã khai báo.
4. Nhưng **nội dung** pixel buffer đó là toàn bộ display bị scale để vừa khung — không phải vùng đã crop.

Test cả 3 phương án `SCContentFilter`:

| Phương án | Kết quả |
|---|---|
| `SCContentFilter(desktopIndependentWindow:)` | Crash `CGS_REQUIRE_INIT` — comment cũ trong code đã ghi đúng, vẫn còn crash trên macOS 26.5.1 |
| `SCContentFilter(display:excludingWindows:[])` + `sourceRect` | Build/run không lỗi nhưng **không crop** — ghi lại pixel thật xác nhận vẫn là full display |
| `SCContentFilter(display:including:[win])` | **Hoạt động đúng** — pixel buffer thật chỉ chứa đúng nội dung cửa sổ, verify bằng ảnh trích từ file `.mov` thật |

## Cách sửa

`main.swift` — nhánh `args.windowId != 0`:
- Đổi `SCContentFilter(display: display, excludingWindows: [])` → `SCContentFilter(display: display, including: [win])`.
- Xoá toàn bộ logic tính/gán `sourceRect` (không còn cần thiết — `including:` tự crop đúng).
- `config.width`/`config.height` giữ nguyên bằng kích thước cửa sổ (đã đúng từ trước).

## Verify thật

Build binary thật (`swift build -c release`), ký ad-hoc, chạy trực tiếp với `--window-id <id>` lấy từ `--list-windows`, ghi 3-4 giây, trích 1 frame bằng `ffmpeg`, xem ảnh thật — xác nhận đúng crop đúng cửa sổ, không còn full display. Đã copy binary đã sửa vào `resources/bin/capture` (arm64, dev). **Trước khi release**: chạy lại `scripts/build-swift.sh` để có universal binary (arm64 + x86_64) đúng chuẩn ký/đóng gói.

## Không đổi

- Không đổi bất kỳ file TypeScript/React nào — bug hoàn toàn nằm ở Swift capture binary, luồng UI/IPC chọn window đã đúng từ trước.
- `typecheck`, `build`, và 82 unit test vẫn pass sau khi sửa (không có test nào phủ trực tiếp hành vi crop pixel thật của ScreenCaptureKit — đây là giới hạn hợp lý vì cần binary thật + hiển thị thật trên máy, không thể mock).
