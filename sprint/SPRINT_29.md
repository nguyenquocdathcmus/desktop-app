# Sprint 29 — Bug thật đang tồn tại trong dự án

**Duration:** Week 109 (1 tuần)
**Goal:** Khảo sát toàn bộ codebase (agent Explore khảo sát sâu 10 khu vực rủi ro cao nhất, sau đó từng phát hiện được tự verify lại bằng cách đọc trực tiếp code — không tin báo cáo mù quáng) để tìm bug thật đang tồn tại, không phải suy đoán hay style nitpick. 6 bug được agent báo cáo, 1 bug (autosave race — xem mục "Đã loại bỏ" bên dưới) bị loại sau khi verify vì kết luận sai: Electron IPC trên cùng kênh renderer→main là FIFO nên thứ tự ghi file cuối cùng luôn đúng, không có race thật như agent mô tả.
**Status:** ✅ Done — vòng 1: 6/6 bug xác nhận đã fix. Vòng 2 (khảo sát khu vực chưa kiểm tra ở vòng 1: Swift source, export pipeline sâu hơn, presets, conflictTracker, proxy): 5/5 bug xác nhận đã fix, 1 kết luận của agent (presets-handlers race) bị loại vì cùng lý do sai như "autosave race" ở vòng 1. `npm run typecheck` sạch, test suite pass, `npm run build` thành công.

---

## Bug đã xác nhận và cần fix

| ID | Bug | File:dòng | Mức độ | Status |
|----|-----|-----------|--------|--------|
| BUG-01 | `RecordingSession.reset()` không `await capture.stop()` → session có thể chuyển `idle` trong khi tiến trình capture cũ chưa thực sự thoát, khiến `start()` kế tiếp ném lỗi `CaptureProcess already running` | `src/main/recording/RecordingSession.ts:364-366` | High | ✅ Fixed |
| BUG-02 | `export-handlers.ts`: `EXPORT_CANCEL` set `exporting = false` ngay lập tức, không đợi `EXPORT_START`'s `finally` chạy xong → guard `if (exporting)` không chặn được export thứ 2 chồng lên export bị cancel đang teardown, có thể ghi đè/hủy nhầm tiến trình ffmpeg đang chạy hợp lệ | `src/main/ipc/export-handlers.ts:36-39` | High | ✅ Fixed |
| BUG-03 | `billing-handlers.ts`: `authService.getAccessToken()` không kiểm tra hết hạn (chỉ `restoreSession()` lúc khởi động app mới check, `autoRefreshToken: false`) → token hết hạn sau ~1h khiến mọi query Supabase âm thầm thất bại (lỗi bị bỏ qua, chỉ destructure `data`), user Pro bị hiển thị nhầm thành Free | `src/main/auth/AuthService.ts:153-158`, `src/main/ipc/billing-handlers.ts:37,73` | Critical | ✅ Fixed |
| BUG-04 | `reconcileIndex()` đọc index tại T0, `await Promise.all(...)` nhường event loop, rồi ghi đè bằng snapshot T0 → nếu `recordings:delete`/`recordings:rename` chạy xen giữa, thay đổi đó bị ghi đè mất (recording đã xóa "tái xuất hiện" trong index tới lần reconcile kế tiếp) | `src/main/ipc/recordings-list-handler.ts:222-252` | Medium | ✅ Fixed |
| BUG-05 | `useAuthStore.initAuth()` gọi `window.api.onAuthStatusChanged(...)` mỗi lần được gọi, bỏ qua hàm hủy đăng ký trả về → nếu `initAuth()` từng bị gọi lại (HMR trong dev, remount trong tương lai), listener cộng dồn | `src/renderer/src/store/useAuthStore.ts:38` | Low | ✅ Fixed |
| BUG-06 | `loadAuthBillingConfig()`'s dev-mode path đi lên **3 cấp** từ `__dirname` (`'../../../.env.auth'`), nhưng file build thật `out/main/index.js` chỉ cần **2 cấp** để chạm gốc repo — đường dẫn tính ra rơi ra NGOÀI thư mục project hẳn, `.env.auth` không bao giờ được tìm thấy trong dev, mọi cấu hình Supabase Cloud bị bỏ qua và app luôn dùng `LOCAL_DEFAULTS` (127.0.0.1) dù đã cấu hình Cloud đầy đủ. Vì Supabase Local đã bị dừng (`supabase stop`), mọi request auth thất bại với "fetch failed" — đây chính là lỗi user báo cáo trực tiếp khi thử sign up. | `src/main/config/env.ts:74` (cũ) | Critical | ✅ Fixed |

## Cách phát hiện BUG-06

User báo "sign up bị lỗi fetch failed" trong app thật. Verify bằng cách tính chính xác `path.join()` với `__dirname` giả lập đúng vị trí thật của `out/main/index.js` sau build — xác nhận đường dẫn cũ (`../../../.env.auth`) trỏ tới `/Users/macone/Documents/projects/personal/.env.auth` (ngoài repo, không tồn tại), còn đường dẫn mới (`../../.env.auth`) trỏ đúng `<repo-root>/.env.auth`. Sau khi sửa, verify lại bằng script signUp thật dùng đúng logic resolve path đã sửa — nhận về lỗi "email rate limit exceeded" (giới hạn tần suất thật của Supabase, do đã test nhiều lần) thay vì "fetch failed", xác nhận request đã kết nối thành công tới đúng Cloud project.

Thêm test `test/unit/auth-billing-config.test.ts` pin cứng quan hệ giữa `__dirname` thật (trong `out/main/index.js`) và vị trí file `.env.auth` ở gốc repo, để một thay đổi path trong tương lai không thể âm thầm phá lại lần nữa mà không có test đỏ báo trước.

---

## Bug vòng 2 (khu vực chưa khảo sát ở vòng 1)

| ID | Bug | File:dòng | Mức độ | Status |
|----|-----|-----------|--------|--------|
| BUG-07 | `muxChapters()` gọi `unlinkSync(outputPath)` **trước** `renameSync(tmpOut, outputPath)` khi mux chapter metadata sau export chính đã thành công — nếu process chết hoặc `renameSync` throw (disk full, EXDEV) giữa 2 lệnh, file export đã hoàn thành bị xóa vĩnh viễn dù export chính không hề lỗi | `src/main/export/Exporter.ts:884-885` | High | ✅ Fixed |
| BUG-08 | `remapPointEvents()` dùng so sánh bao gồm cả 2 biên (`e.t >= seg.start && e.t <= seg.end`) — 2 segment liền kề chia sẻ đúng 1 điểm biên (do `splitSegmentAt` tạo ra) khiến 1 event đúng tại điểm đó (chapter, keystroke badge, click sound) bị nhân đôi trong video xuất ra, ở 2 thời điểm output khác nhau | `src/main/export/Exporter.ts:116-129` | Medium | ✅ Fixed |
| BUG-09 | `eventTapCallback` trong cursor-tracker nhận `.tapDisabledByTimeout`/`.tapDisabledByUserInput` (macOS tự tắt tap khi callback treo quá lâu, hoặc khi có ứng dụng khác vào chế độ secure-input) nhưng chỉ `break`, không gọi lại `CGEvent.tapEnable` — tap bị tắt vĩnh viễn cho tới hết phiên ghi, cursor/click/scroll/keystroke ngừng ghi âm thầm không báo lỗi | `swift/cursor-tracker/Sources/cursor_tracker/main.swift:60-62` | High | ✅ Fixed |
| BUG-10 | `conflictTracker.ts` chỉ dựa vào `mtimeMs` để phát hiện file bị sửa bên ngoài app — trên filesystem có độ phân giải mtime thấp (FAT32: 2s, một số SMB/network share tệ hơn), 2 lần ghi khác nhau trong cùng khung mtime cho ra cùng giá trị, khiến thay đổi từ đồng nghiệp (qua Drive/Dropbox sync — chính use case tính năng này nhắm tới) bị ghi đè mất không cảnh báo | `src/main/project/conflictTracker.ts:40-44` | Medium | ✅ Fixed (giảm thiểu, không loại bỏ hoàn toàn — xem ghi chú) |
| BUG-11 | `proxy-handlers.ts` gọi `unlinkSync(outPath)` không cần thiết trước `renameSync(tmpPath, outPath)` — comment tự nhận "atomic" nhưng chính unlink riêng lẻ đó phá vỡ tính atomic thật của `renameSync` một mình; nếu app chết giữa 2 lệnh, `proxy.mp4` bị xóa không có gì thay thế, buộc re-encode lại từ đầu ở lần mở app kế tiếp | `src/main/ipc/proxy-handlers.ts:46-48` | Low | ✅ Fixed |

### Đã loại bỏ ở vòng 2 (kết luận của agent sai)

- **"presets-handlers.ts race điều kiện đọc-sửa-ghi"** — agent cho rằng `presets:save`/`presets:delete`/`presets:set-default` có thể chạy xen kẽ nhau như bug đã fix ở `recordings-list-handler.ts`. Khác biệt quan trọng: các handler này **hoàn toàn đồng bộ** (không có `await` nào bên trong, chỉ `readFileSync`/`writeFileSync`), trong khi `reconcileIndex()` (bug thật ở vòng 1) có `await Promise.all(...)` ở giữa — chính khoảng `await` đó mới nhường event loop cho lệnh khác chen vào. Một handler `ipcMain.handle` hoàn toàn đồng bộ luôn chạy trọn vẹn (đọc rồi ghi) trong một tick trước khi Node xử lý message IPC tiếp theo — không có cách nào 2 lệnh như vậy xen kẽ nhau thật sự. Cùng loại sai lầm phân tích như "autosave race" ở vòng 1.

### Ghi chú về BUG-10

Không sửa triệt để bằng cách đổi sang content-hash (sẽ tốn effort lớn hơn nhiều, và `manifest.json` có thể lớn — chứa lịch sử cursor/zoom event — hash mỗi lần save không rẻ). Thay vào đó thêm `size` (từ `statSync`) làm tín hiệu thứ 2 đi kèm mtime: 2 lần ghi khác nhau cho ra cùng mtime VÀ cùng byte count khó xảy ra hơn nhiều so với chỉ trùng mtime. Không phải đảm bảo tuyệt đối, nhưng cải thiện thật với chi phí gần như bằng 0 (đã có `statSync` sẵn ở mọi call site).

## Đã loại bỏ sau khi verify (kết luận của agent sai) — vòng 1

- **"Autosave race làm mất dữ liệu"** (`useProjectStore.ts saveProject()`) — agent cho rằng 2 lần gọi `saveProject()` chồng lấp có thể ghi file theo thứ tự sai do "OS scheduling không đảm bảo thứ tự". Đã verify: `project:save` IPC handler (`project-handlers.ts:28`) là hàm **đồng bộ** (`writeFileSync` chặn luồng), và Electron đảm bảo các lệnh `ipcRenderer.invoke` trên cùng một kênh được `ipcMain.handle` xử lý đúng thứ tự gửi đi (FIFO) khi handler không có `await` bên trong khiến nó trả lời trước khi xử lý request tiếp theo. Vì vậy dù 2 lần `saveProject()` có chồng lấp về mặt thời gian ở phía renderer, thứ tự ghi trên đĩa vẫn luôn đúng thứ tự gọi — file cuối cùng luôn là bản mới nhất. Không có mất dữ liệu thật ở đây.

---

## Ghi chú

- BUG-03 và BUG-05 là lỗi tự tôi viết ở Sprint 28 (Auth/Billing) — không phải lỗi tồn đọng lâu năm.
- BUG-01, BUG-02, BUG-04, BUG-07, BUG-08, BUG-09, BUG-10, BUG-11 là lỗi tồn tại từ trước, chưa từng được phát hiện qua các sprint fix bug trước đây.
- BUG-09 (cursor-tracker) là bug duy nhất nằm trong Swift source — cần rebuild binary để có hiệu lực thật (đã build dev arm64, copy vào `resources/bin/cursor-tracker`, ký lại; **trước khi release cần chạy `scripts/build-swift.sh`** để có bản universal arm64+x86_64 đúng chuẩn).

## Cách fix từng bug

- **BUG-01**: `RecordingSession.reset()` đổi thành `async`, `await this.capture.stop()` trước khi set `idle`. Cả 2 call site (`recording-handlers.ts` RECORDING_START — await thật để chặn race; `index.ts` will-quit — fire-and-forget có chủ đích vì chỉ cần gửi SIGTERM trước khi app thoát, không cần chờ).
- **BUG-02**: Bỏ dòng `exporting = false` khỏi `EXPORT_CANCEL` handler — giờ chỉ có `EXPORT_START`'s `finally` clear cờ, đảm bảo nó chỉ về `false` khi `doExport()` (bao gồm cả trường hợp bị kill) đã thực sự settle. Verify: `FFmpegWrapper`'s `close` event luôn reject/resolve promise của `run()` kể cả sau SIGTERM/SIGKILL, nên `finally` không bao giờ bị treo.
- **BUG-03**: Thêm `AuthService.getValidAccessToken()` (async, refresh trước nếu token còn dưới 60s hoặc đã hết hạn — cùng ngưỡng `restoreSession()` dùng), thay thế `getAccessToken()` (sync, không check hạn) ở cả 2 nơi gọi trong `billing-handlers.ts`. Thêm biến thể `{ signedIn: true; error: string }` vào `SubscriptionInfo` để phân biệt "lỗi truy vấn thật" với "user chưa từng subscribe" — trước đây bị gộp làm một, khiến lỗi im lặng hiển thị nhầm thành Free. `AccountPanel.tsx` cập nhật để hiện nút disabled "Không kiểm tra được gói" thay vì "Nâng cấp lên Pro" khi có lỗi.
- **BUG-04**: `reconcileIndex()` giờ ghi phần xóa stale-entries ngay (không có `await` xen giữa nên an toàn), nhưng phần entries mới xây (sau `await Promise.all(...)`) được ghi bằng `upsertIndexEntry()` — hàm này tự đọc index tươi ngay trước khi ghi, giống hệt cách `recordings:delete`/`recordings:rename` đã làm, nên 2 IPC call chạy xen kẽ nhau không còn ghi đè lẫn nhau nữa.
- **BUG-05**: `useAuthStore` thêm field `_unsubscribeStatusChanged`, `initAuth()` gọi unsubscribe cũ (nếu có) trước khi đăng ký listener mới — tối đa 1 listener sống tại một thời điểm bất kể gọi lại bao nhiêu lần.
- **BUG-07**: Xóa dòng `unlinkSync(outputPath)` — `renameSync` một mình đã atomic và tự ghi đè đích tồn tại trên POSIX, không cần xóa trước.
- **BUG-08**: `remapPointEvents()` đổi từ `[seg.start, seg.end]` (đóng cả 2 đầu) sang `[seg.start, seg.end)` (nửa mở) cho mọi segment, trừ segment CUỐI CÙNG trong mảng (giữ đóng ở đầu cuối để không làm rớt event đúng tại điểm kết thúc toàn bộ timeline).
- **BUG-09**: Thêm biến toàn cục `globalEventTap: CFMachPort?` khai báo trước hàm callback (Swift top-level code chạy tuần tự như script — biến `let tap` khai báo sau callback không nhìn thấy được từ bên trong nó), gán ngay sau `tapCreate()` thành công, gọi `CGEvent.tapEnable(tap:enable:)` lại trong nhánh `.tapDisabledByTimeout`/`.tapDisabledByUserInput`. Build lại bằng `swift build -c release`, verify compile sạch (lần đầu thử forward-reference trực tiếp bị compiler báo lỗi thật `cannot find 'tap' in scope`, đổi sang global var thì build thành công).
- **BUG-10**: Thêm `size` vào `conflictTracker.ts`'s tracked state, so sánh cả mtime và size khi phát hiện xung đột. Cập nhật `project-handlers.ts` truyền `statSync(...).size` ở cả 2 nơi gọi `recordKnownMtime`. Cập nhật + bổ sung test trong `conflict-tracker.test.ts` (thêm 2 test case mới cho tình huống mtime giống nhau nhưng size khác).
- **BUG-11**: Xóa dòng `unlinkSync(outPath)` — cùng lý do như BUG-07.

## Verify

```
npm run typecheck   # sạch
npx vitest run      # pass (không có regression)
npm run build       # thành công
swift build -c release (trong swift/cursor-tracker/) # sạch, binary copy vào resources/bin/
```

Không có test tự động mới cho các bug race condition/timing (BUG-01, 02, 03, 04, 05, 07, 08, 09, 11) — khó test đơn vị đáng tin cậy mà không dựng lại toàn bộ IPC/process/Swift binary thật; rủi ro test giả tạo che giấu race thay vì bắt được nó. Đã verify từng bug bằng cách đọc trực tiếp code liên quan (đường đi thật của giá trị qua các hàm), và với BUG-09 bằng cách build lại binary thật. BUG-10 có test tự động vì đây là logic thuần so sánh giá trị, không phải race/timing.
