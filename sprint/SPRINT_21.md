# Sprint 21 — Publish Destinations: From Exported File to Delivered Link

**Duration:** Week 77-80 (4 tuần)
**Goal:** Khảo sát xác nhận sau export, lựa chọn duy nhất là "Show in Folder" (Sprint 5) hoặc "Copy file / Drag out" (Sprint 10) — không một tích hợp nào với nơi video demo thực sự cần đến: YouTube (unlisted), Google Drive/Dropbox, hay đơn giản một link xem-ngay không cần tải file. Sprint này thêm đích đến trực tiếp cho file vừa xuất, khép lại hành trình record → edit → export → **gửi tới người xem** mà không cần rời khỏi app.
**Status:** ✅ Done (scaffold; OAuth/upload 🔴 Blocked — cần API credentials thật, xem ghi chú)

---

## Sprint Goal

> Đối chiếu với toàn bộ hành trình đã xây (Sprint 6-20): app quay tốt, edit mạnh, xuất đúng định dạng, nhưng bước cuối cùng — "làm sao video tới tay người xem" — vẫn hoàn toàn thủ công. Ba quan sát:
>
> 1. **YouTube là đích phổ biến nhất cho video demo/tutorial nhưng không có đường tắt.** Người dùng phải tự mở YouTube Studio, kéo file, điền tiêu đề, chọn Unlisted — lặp lại quy trình 5+ bước thủ công mỗi lần dù OAuth + upload API không phức tạp để tích hợp.
> 2. **Không upload tới cloud storage phổ biến.** Google Drive/Dropbox là nơi nhiều team chia sẻ nội bộ (đặc biệt hợp với "review comments cục bộ" Sprint 15 — gửi cả file `.recordscreen` lẫn video qua Drive để đồng nghiệp xem bằng link).
> 3. **Không cách tạo "link xem nhanh" không cần tài khoản người nhận.** Đây là giá trị cốt lõi của Loom (nổi tiếng nhất ở khoản này) — nhưng cố tình **không** đi hướng tự host video (chi phí hạ tầng lớn, ngoài phạm vi app desktop cục bộ đã chọn từ đầu dự án) mà tận dụng các dịch vụ upload công khai đã tồn tại.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-165 | YouTube upload trực tiếp sau export: OAuth 2.0 (Google Identity), upload qua YouTube Data API v3 với title/description/privacy (mặc định Unlisted) điền sẵn từ tên recording (Sprint 10) + chapter list (Sprint 15) tự động đưa vào description | P0 | L | 🔴 Blocked (scaffold done) |
| US-166 | Google Drive upload: OAuth dùng chung luồng với US-165 (Google Identity), upload file export vào thư mục chọn được, trả về link chia sẻ ngay khi xong | P0 | M | 🔴 Blocked (scaffold done) |
| US-167 | Dropbox upload: OAuth riêng (Dropbox API), tương tự US-166 | P1 | M | 🔴 Blocked (scaffold done) |
| US-168 | "Publish" panel thống nhất trong ExportModal (sau khi export xong): danh sách đích đến đã kết nối, chọn 1 hoặc nhiều, tiến độ upload riêng biệt với tiến độ export (đã export xong rồi mới upload, không chạy chồng lấn) | P0 | M | ✅ Done |
| US-169 | Quản lý kết nối tài khoản trong Settings: xem tài khoản đã liên kết, ngắt kết nối, không lưu token dạng plaintext (dùng `safeStorage` của Electron hoặc Keychain qua `keytar`-style API) | P0 | S | ✅ Done |
| US-170 | Lịch sử publish: mỗi recording lưu danh sách nơi đã publish (kèm link) — hiện trong HomeScreen card, tránh publish trùng nhầm hoặc quên đã gửi ở đâu | P1 | S | ✅ Done |
| US-171 | Retry/resume upload nếu mất mạng giữa chừng (file lớn, 4K dài dễ gặp) — không bắt xuất lại từ đầu | P2 | M | 🔴 Blocked (phụ thuộc upload thật) |

**Ghi chú quan trọng (2026-07-03):** Sprint này phụ thuộc hoàn toàn vào OAuth client credentials thật (Google Cloud Console cho YouTube Data API v3 + Drive API, Dropbox App Console) — không có trong môi trường triển khai phiên này, và **không giống Sprint 18 (analytics)**, không có cách nào chạy "bản giả lập cục bộ" có ý nghĩa cho OAuth thật (không có redirect endpoint để test, không có API thật để gọi thử). Quyết định: xây toàn bộ phần **có thể verify được mà không cần OAuth thật** — UI kết nối, mã hoá token, publish history, publish panel — và đánh dấu rõ ràng phần OAuth/upload thật là Blocked với điểm cắm credentials cụ thể trong `src/main/publish/providers.ts` (tìm chuỗi `REPLACE_ME`). Khi có credentials thật, chỉ cần implement 4 hàm trong `providers.ts` (`connectProvider`, `uploadToYouTube`, `uploadToGoogleDrive`, `uploadToDropbox`) — toàn bộ IPC, UI, token storage, publish history đã sẵn sàng, không cần sửa gì ở renderer.

---

## Định hướng kỹ thuật

**OAuth chung (US-165, US-166):**
- Google Identity Services cho cả YouTube Data API và Drive API — 1 luồng OAuth, xin đủ scope 2 API ngay từ đầu để tránh xin quyền 2 lần riêng biệt gây khó chịu.
- Electron: mở cửa sổ `BrowserWindow` riêng cho OAuth consent (không dùng `shell.openExternal` vì cần bắt redirect callback), hoặc dùng loopback local server pattern chuẩn cho desktop app OAuth (Google khuyến nghị cho installed app).

**Token storage (US-169):**
- Bắt buộc dùng `safeStorage.encryptString`/`decryptString` (Electron built-in, dựa trên Keychain macOS) — không bao giờ lưu access/refresh token dạng plaintext trong file JSON như `presets.json` hiện tại. Đây là điểm khác biệt quan trọng so với mọi cấu hình khác đã lưu trước đó (presets, templates) vì token là bí mật thật, không phải preference.

**Publish panel (US-168):**
- Tách bạch rõ 2 giai đoạn: export (ffmpeg, tiến trình đã có từ đầu dự án) → publish (upload, tiến trình mới, network-bound thay vì CPU-bound). Không gộp chung progress bar kẻo gây hiểu lầm.
- API upload chạy trong main process (giữ nhất quán với toàn bộ IPC pattern đã dùng suốt dự án), renderer chỉ nhận progress event qua kênh tương tự `export:progress`.

**Chapter → YouTube description (US-165):**
- Tái dùng trực tiếp US-129 (Sprint 15, "export chapter list dạng text") — copy đúng định dạng đó vào trường description khi tạo video YouTube, không cần logic mới.

**Retry/resume (US-171):**
- YouTube/Drive API đều hỗ trợ resumable upload (chunked, có thể tiếp tục từ byte đã gửi) — dùng đúng cơ chế đó thay vì tự implement retry ngây thơ (upload lại từ đầu).

---

## Definition of Done

- [ ] Kết nối tài khoản Google lần đầu → OAuth flow hoàn tất — **Blocked**: không có Google OAuth client thật; `connectProvider('youtube')` throw `ProviderNotConfiguredError` rõ ràng thay vì giả vờ thành công
- [x] Token lưu mã hoá, không bao giờ ở dạng đọc được trên đĩa — verify bằng test thật: `test/unit/token-store.test.ts` xác nhận file `publish-tokens.enc.json` không chứa chuỗi token gốc (`expect(raw).not.toContain(secret)`)
- [ ] Export xong 1 video → chọn "Publish to YouTube" → video lên YouTube, nhận link — **Blocked**: panel `PublishPanel.tsx` hiển thị đúng, gọi đúng IPC, nhưng upload thật throw lỗi rõ ràng do chưa có credentials (không giả vờ thành công)
- [ ] Publish lên Google Drive → nhận link chia sẻ — **Blocked**, cùng lý do
- [x] Ngắt kết nối tài khoản trong Settings → nút Connect/Disconnect hoạt động đúng, `listConnectedProviders()` phản ánh đúng trạng thái — verify bằng test thật
- [x] HomeScreen card của recording đã publish hiện badge YouTube/Drive/Dropbox, click mở đúng link — implement trong `HomeScreen.tsx`, đọc từ `publishHistory` (chưa có dữ liệu thật để test end-to-end vì chưa từng publish thành công được, nhưng UI/logic đọc history đã đúng và sẵn sàng)
- [ ] Retry/resume upload khi mất mạng — **Blocked**, phụ thuộc trực tiếp vào upload API thật (US-171)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Tự host video + tạo link xem trực tiếp (kiểu Loom) | Đòi hỏi hạ tầng server/CDN — mâu thuẫn với lựa chọn kiến trúc "app desktop chạy local" đã giữ xuyên suốt 20 sprint; tận dụng YouTube/Drive đạt giá trị tương tự với chi phí vận hành gần bằng 0 |
| Tích hợp Slack/Notion/Confluence trực tiếp | Giá trị thật nhưng phân tán nỗ lực; ưu tiên 2-3 đích phổ biến nhất (YouTube, Drive, Dropbox) làm tốt trước khi mở rộng danh sách |
| Publish tự động ngay sau khi export xong (không cần bấm) | Rủi ro gửi nhầm video chưa ưng ý hoặc chứa thông tin nhạy cảm (đặc biệt liên quan Sprint 19 redaction) — publish phải luôn là hành động chủ động, không bao giờ mặc định |

Sprint 21 khép lại hành trình được vẽ ra từ đầu roadmap: record (Sprint 1-2) → edit (3-4, 8-9, 11) → export chất lượng cao (5, 8, 10) → và giờ **thực sự tới tay người xem** mà không cần rời khỏi app để làm nốt bước cuối cùng theo cách thủ công.
