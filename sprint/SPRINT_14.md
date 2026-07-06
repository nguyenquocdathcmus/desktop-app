# Sprint 14 — Test Automation + CI + Regression Safety Net

**Duration:** Week 49-52 (4 tuần)
**Goal:** Khảo sát xác nhận thư mục `test/` chỉ chứa **tài liệu quy trình test thủ công** (BUG_REPORT_TEMPLATE.md, TEST_PLAN.md, TEST_CASES.md) — không một dòng test tự động nào tồn tại trong repo, không CI. Sau 9 sprint (6-14 nếu tính từ đầu) thay đổi liên tục vào `Exporter.ts`, `useProjectStore.ts`, và Swift binaries mà không có gì tự động phát hiện regression — bằng chứng cụ thể: bug "moov atom not found" và bug "dư 1s cuối video" ở sprint gần nhất chỉ phát hiện được nhờ chạy tay `ffmpeg` thật, không phải test tự động. Sprint này xây lưới an toàn để những lần sửa tiếp theo không lặp lại kiểu phát hiện bug bằng tay.
**Status:** ✅ Done (trừ US-121 XCTest Swift, US-122 visual regression Playwright)

---

## Sprint Goal

> 3 khoảng trống cụ thể quan sát được:
>
> 1. **`Exporter.ts` (~800 dòng filter_complex string-building) không có unit test nào.** Đây là file rủi ro cao nhất trong toàn bộ codebase — mỗi sprint (8, 9, 11) đều thêm nhánh filter mới (multi-segment, speed, annotations, scenes, ducking) vào cùng một hàm khổng lồ. Một lỗi cú pháp filter chỉ lộ ra khi *chạy ffmpeg thật* — điều mà tới giờ chỉ làm thủ công qua Bash trong mỗi phiên làm việc, không lặp lại được tự động cho lần sửa tiếp theo.
> 2. **`useProjectStore.ts` (history/undo, migrate, segments) không có test.** Logic migrate `inPoint/outPoint` → `segments[]`, debounce history, ripple-delete — đều là logic thuần (không phụ thuộc DOM/Electron) nên rất dễ unit test nhưng chưa có cái nào.
> 3. **Không CI.** Không GitHub Actions, không pre-push hook chạy typecheck. Lỗi TypeScript hiện chỉ được bắt khi ai đó chủ động chạy `tsc --noEmit` bằng tay (như đã làm xuyên suốt các sprint trước) — không có gì chặn một commit lỗi type được đẩy lên.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-116 | Thiết lập Vitest cho `src/`: cấu hình chạy test cho cả main process logic (Node) và renderer logic (jsdom) trong cùng 1 test runner | P0 | S | ✅ Done |
| US-117 | Unit test cho `Exporter.ts` filter builders: `buildZExpr/buildXExpr/buildYExpr`, `buildConcatFilter`, `remapRangeEvents/remapPointEvents`, `atempoChain` — test snapshot cú pháp filter string cho các trường hợp biên (0 segment, 1 segment, N segment, speed=1/2/4) | P0 | L | ✅ Done (21 test) |
| US-118 | Integration test "ffmpeg thật": script chạy filter output của `Exporter.ts` qua binary ffmpeg thật với video test tổng hợp (`testsrc`), assert output file hợp lệ + đúng duration — chính là quy trình đã làm thủ công ở Sprint 8/9, giờ tự động hoá và chạy lại được mỗi lần sửa | P0 | L | ✅ Done (4 test, verified red→green) |
| US-119 | Unit test `useProjectStore.ts`: migrate logic, undo/redo debounce, `splitSegmentAt`/`removeSegment`/`applyRemoveSilences` (đặc biệt thứ tự apply cuối-về-đầu không phá segment khác) | P0 | M | ✅ Done (13 test — migrate + segments; chưa test undo/redo debounce riêng) |
| US-120 | GitHub Actions CI: chạy `tsc --noEmit` (cả node + web config) + Vitest suite trên mọi PR/push, chặn merge nếu fail | P0 | M | ✅ Done |
| US-121 | Swift unit test cho `VideoWriter` pause/resume PTS math (`setPaused`, timestamp shift) bằng XCTest — logic thuần, test được không cần capture thật | P1 | M | 🔴 Blocked — chưa triển khai trong lần này, cần thiết lập XCTest target riêng |
| US-122 | Visual regression test nhẹ cho `PreviewCanvas`: snapshot render với Playwright/Electron test harness cho vài preset (background gradient, zoom active, webcam PIP) — bắt lỗi CSS/layout vỡ | P1 | L | 🔴 Blocked — cần Electron test harness riêng, chưa triển khai |
| US-123 | Pre-commit hook (husky hoặc tương đương) chạy typecheck nhanh trước khi cho phép commit — bắt lỗi sớm hơn CI | P2 | S | 🔴 Blocked — chưa triển khai |

---

## Định hướng kỹ thuật

**Vitest setup (US-116):**
- `vitest.config.ts` với 2 project: `node` (main process, `environment: 'node'`) và `web` (renderer, `environment: 'jsdom'`) — electron-vite đã có alias/path setup sẵn có thể tái dùng phần lớn config.
- Mock `electron` module (app.getPath, ipcMain) bằng file stub đơn giản cho phần main process test cần import gián tiếp.

**Exporter unit tests (US-117):**
- Test thuần chuỗi: gọi `buildZExpr([...])` với fixture ZoomEvent, assert chuỗi filter chứa đúng `between(t,...)` cho từng event, đúng thứ tự reverse (event sau cùng match trước theo cách if/else lồng nhau hiện tại).
- `remapRangeEvents`: fixture 3 segment với 1 segment bị "xoá" (không có trong list), assert event nằm trong đoạn xoá bị lọc, event xuyên biên bị clip đúng, offset cộng dồn đúng theo speed.
- Đây là nhóm test **nhanh, không cần ffmpeg**, chạy được trong CI mọi lần mà không cần binary nặng.

**ffmpeg integration test (US-118):**
- Script Node độc lập trong `test/integration/`: generate `testsrc` video ngắn (giống thao tác thủ công đã làm ở Sprint 8/9), gọi thẳng `exportVideo()` từ `Exporter.ts` với các `ExportOptions` fixture (multi-segment, speed, aspect 9:16, webcam giả), rồi `ffprobe` verify duration/streams của output.
- Chạy trong CI cần bundle ffmpeg binary cho runner (đã có sẵn trong `resources/bin/`, kiểm tra kích thước repo/Git LFS nếu cần) — nếu binary quá nặng cho CI, cân nhắc tải riêng trong workflow thay vì commit.
- Đây chính là automation của quy trình debug thủ công đã cứu 2 bug ở sprint trước — biến "phát hiện bằng tay 1 lần" thành "chặn regression mãi mãi".

**Store tests (US-119):**
- `migrateProjectState`: fixture project cũ (chỉ `inPoint/outPoint`, không `segments`) → assert kết quả đúng 1 segment với đúng start/end.
- `applyRemoveSilences`: fixture project với N segment + silence regions chồng lấn biên segment, assert kết quả cuối đúng và không "ăn nhầm" segment kế bên (test case đã ngầm giả định đúng khi code, giờ cần bằng chứng).

**CI (US-120):**
- `.github/workflows/ci.yml`: job `typecheck` (2 tsc command hiện có chạy tay xuyên suốt các sprint), job `test` (`vitest run`), chạy song song, matrix không cần thiết (chỉ macOS vì Swift binaries — nhưng CI test suite ở US-116/117/119 không cần macOS runner, chỉ US-118/121 cần).

---

## Definition of Done

- [x] `npm test` chạy toàn bộ unit test (Exporter filter builders + store logic) trong <10s, không cần ffmpeg/Electron thật
- [x] `npm run test:integration` sinh video test, export qua `Exporter.ts` thật, verify output bằng ffprobe — pass cho ít nhất: single-segment, multi-segment 3 đoạn, speed 2×, aspect 9:16
- [x] Test integration nói trên **tái tạo lại được** 2 bug đã sửa thủ công ở sprint trước (video treo do color= vô hạn, dư 1s cuối) dưới dạng regression test — cố tình revert fix để xác nhận test đỏ, rồi un-revert để xác nhận xanh
- [x] Mọi PR tự động chạy typecheck + unit test qua GitHub Actions, merge bị chặn nếu có bước fail
- [ ] XCTest cho `VideoWriter.setPaused` pass, chứng minh PTS shift đúng cho ít nhất 2 lần pause/resume liên tiếp — **Blocked, chưa triển khai**
- [ ] Snapshot test `PreviewCanvas` phát hiện được 1 lỗi layout cố tình chèn vào — **Blocked, chưa triển khai**
- [ ] Pre-commit hook chặn được 1 lỗi TypeScript cố tình chèn vào trước khi nó tới CI — **Blocked, chưa triển khai**

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| E2E test toàn bộ flow record→export qua Electron thật (Playwright) | Chi phí duy trì cao (cần ScreenCaptureKit permission trong CI runner — không khả thi trên GitHub-hosted macOS runner); US-118 (integration test gọi thẳng `exportVideo()`) đạt phần lớn giá trị mà không cần capture thật |
| Coverage threshold bắt buộc (VD: 80%) | Dễ dẫn tới test viết để đạt số, không phải test có giá trị; ưu tiên test đúng chỗ rủi ro cao (Exporter, store) hơn là phủ toàn bộ |
| Test cho từng React component UI nhỏ lẻ | Giá trị thấp so với công sức cho component ít logic (hầu hết Sidebar panel là JSX thuần); ưu tiên logic có nhánh rẽ phức tạp |

Đây là sprint "trả nợ" đúng nghĩa — không thêm tính năng người dùng thấy được, nhưng là điều kiện để 6 sprint tính năng vừa làm (6-11) không bị regression âm thầm ở sprint 15 trở đi.
