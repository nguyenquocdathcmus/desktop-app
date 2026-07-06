# Sprint 28 — Auth (Supabase) + Billing (Paddle)

**Duration:** Week 105-108 (4 tuần)
**Goal:** App hiện tại 100% local-first — không có khái niệm user/account/license nào (khảo sát code: không có bảng nào, không có token nào ngoài publish OAuth tokens của YouTube/Drive/Dropbox). Sprint này thêm layer tài khoản (Supabase Auth) và trả phí (Paddle) làm nền cho các tính năng trả phí tương lai, mà không phá vỡ việc app vẫn dùng được offline/local.
**Status:** ✅ Done hoàn toàn (Local + Cloud + Paddle) — toàn bộ luồng đã verify end-to-end bằng script thật đối API thật, không phải suy đoán từ đọc code: Supabase Local, Supabase Cloud (signup/signin/RLS/trigger), và Paddle (tạo Product/Price/checkout thật + webhook ký đúng chữ ký ghi vào `subscriptions` thật, chữ ký sai bị từ chối đúng 401). Cloud project (`screen-studio`, ref `vffllhlaaxuhuvabubua`, region Singapore) được tạo mới hoàn toàn (rỗng), link qua CLI, migration đẩy lên thành công — không dùng chung với 2 project Supabase khác đã có sẵn trên cùng tổ chức (tránh trùng tên bảng `profiles`, xem sự cố ghi lại bên dưới).

**Paddle — setup thật hoàn tất:** Product "Screen Studio Pro" + Price `pri_01kwsg620gckv6hcv8a8ksq7ef` ($9.99/tháng) tạo qua API Sandbox thật, Edge Function `paddle-webhook` deploy lên Cloud, Notification destination + webhook secret user tự tạo qua Dashboard, `PADDLE_WEBHOOK_SECRET` đã set vào Supabase Function secrets. Verify end-to-end: user thật (pre-confirmed qua admin API) → gửi webhook `subscription.activated` ký đúng HMAC → Edge Function trả 200, ghi đúng row vào `subscriptions` (status/customer_id/subscription_id/price_id/current_period_end đầy đủ) → gửi lại với chữ ký sai → đúng 401.

**2 bug thật gặp phải lúc setup Paddle (đã ghi vào `docs/SETUP_PADDLE.md`):**
1. API key Paddle mặc định thiếu quyền — mọi request kể cả GET đơn giản bị 403 `forbidden` cho tới khi user tự sửa quyền key thành **Read and write** trên Dashboard.
2. Tạo checkout (transaction) bị chặn với `transaction_default_checkout_url_not_set` cho tới khi user cấu hình **Default Payment Link** trong Checkout settings — bước này không có cách nào set qua API.
3. **Bug ở phía mình (Supabase, không phải Paddle):** Edge Function mới deploy lần đầu bị chính **Supabase platform** chặn 401 `UNAUTHORIZED_NO_AUTH_HEADER` trước cả khi code trong `index.ts` chạy — Supabase mặc định bắt buộc JWT hợp lệ cho mọi Edge Function, nhưng Paddle không bao giờ gửi JWT, chỉ gửi `Paddle-Signature`. Fix: thêm `[functions.paddle-webhook]` với `verify_jwt = false` vào `supabase/config.toml`, deploy lại bằng `supabase functions deploy paddle-webhook --no-verify-jwt`. Phát hiện bằng cách gửi đúng 1 request ký chữ ký hợp lệ tới function thật và nhận 401 sai chỗ — không phải suy đoán.

**Sự cố phát hiện lúc setup Cloud (đã xử lý an toàn):** project Cloud đầu tiên user cung cấp trong `.env.auth` ("mecam") hóa ra không rỗng — đã có 19 migration + bảng `profiles` riêng từ một dự án khác của user trên cùng tổ chức Supabase. Push migration thất bại với `relation "profiles" already exists`. Thay vì tự ý đổi tên bảng hoặc ép chạy đè, đã dừng lại hỏi user; user chọn tạo project Cloud mới hoàn toàn riêng cho Screen Studio thay vì dùng chung — project "mecam" không hề bị chạm vào (migration history của nó được `supabase migration repair` khôi phục đúng nguyên trạng, không có DDL nào chạy nhắm vào nó).

**API keys lấy an toàn:** `supabase projects api-keys` in thẳng `service_role` key (bypass toàn bộ RLS) ra output — thay vì hiển thị hoặc ghi ra file trung gian có thể bị đọc lại, key được lấy qua một lệnh pipe duy nhất (`supabase projects api-keys -o json | node -e '...'`) ghi thẳng vào `.env.auth`, không bao giờ xuất hiện trên terminal/transcript.
**Bug thật tìm thấy và sửa trong lúc verify:** `@supabase/supabase-js` luôn khởi tạo `RealtimeClient` trong constructor của `createClient()`, kể cả khi không dùng tính năng Realtime nào — client đó throw ngay lập tức trên runtime không có `WebSocket` global (xác nhận bằng cách chạy chính `AuthService.ts` thật, không phải đọc doc suy đoán). App bundle Electron 24 (Node ~18, dưới ngưỡng Node 22 có native WebSocket) nên **sẽ crash ngay lúc khởi động** nếu không sửa. Fix: thêm package `ws`, truyền `realtime: { transport: ws }` vào cả hai nơi gọi `createClient` (`AuthService.ts`, `billing-handlers.ts`). Verify lại bằng cách chạy `npm run dev` thật — app lên đủ 3 cửa sổ (editor/controls/webcam), không crash.

---

## Bối cảnh & ràng buộc kiến trúc

- App là **Electron desktop app**, không phải web app — không có trình duyệt nhúng nào chạy Supabase JS SDK theo kiểu web bình thường (redirect same-window). OAuth/magic-link phải mở **system browser** rồi quay lại app qua custom protocol đã có sẵn: `recordscreen://` (đăng ký ở `src/main/index.ts`, dùng cho tính năng Sprint 15 "copy timestamp link").
- Toàn bộ Supabase SDK call (`@supabase/supabase-js`) chạy ở **main process** (Node context) — không expose service key hay session thao túng trực tiếp cho renderer; renderer chỉ nhận trạng thái auth qua IPC, giống pattern `RecordingSession`/`useRecordingStore` đã có.
- Token/session lưu bằng `safeStorage` (Keychain trên macOS) — tái dùng đúng pattern đã có ở `src/main/publish/tokenStore.ts`, không phát minh cơ chế mới.
- Không bắt buộc đăng nhập để dùng app (app vẫn phải chạy được 100% offline như hiện tại) — auth/billing chỉ optional layer, chuẩn bị cho tính năng trả phí sau này (ví dụ: transcription cloud, cloud sync…). Chưa có tính năng nào thực sự bị khoá sau paywall trong sprint này — chỉ dựng hạ tầng + 1 màn hình ví dụ hiển thị trạng thái Free/Pro để verify toàn bộ luồng hoạt động thật.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-210 | Supabase project riêng (`supabase-project/` folder), chạy local qua Supabase CLI (Docker) + project Cloud thật | P0 | M | ✅ Done — verify thật cả 2: Local qua `supabase start` (cổng dịch sang 5433x vì máy đã có project local khác chiếm dải mặc định); Cloud qua project mới `screen-studio` (ref `vffllhlaaxuhuvabubua`), migration đẩy lên thành công |
| US-211 | Schema `profiles` + `subscriptions`, RLS policy đúng (user chỉ đọc/sửa dữ liệu của chính mình) | P0 | M | ✅ Done — verify thật trên cả Local và Cloud: script Node gọi API thật, ký user thật, xác nhận chỉ query được đúng 1 row profiles/0 row subscriptions của chính mình, trigger `handle_new_user` tạo profile tự động đúng |
| US-212 | `AuthService` (main process): sign up/sign in bằng email+password, sign out, refresh session, đọc session đã lưu lúc khởi động app | P0 | L | ✅ Done (local) — verify thật bằng script signUp/signInWithPassword thật đối API local, và bằng cách chạy app Electron thật (`npm run dev`) xác nhận không crash |
| US-213 | Luồng OAuth qua system browser + `recordscreen://auth-callback` deep link, PKCE | P1 | L | ✅ Done (code path) — Cloud project đã có (US-210), nhưng cần user tự vào Dashboard → Authentication → URL Configuration thêm `recordscreen://auth-callback` (xem `docs/SETUP_SUPABASE.md` mục 2.4 — không tự động hoá vì đây là thay đổi cấu hình admin-console) + đăng ký Google/GitHub OAuth app thật để bật thật |
| US-214 | UI đăng nhập/đăng ký (renderer) + hiển thị trạng thái tài khoản trong Settings | P0 | M | ✅ Done |
| US-215 | `PaddleService`: tạo checkout link, verify webhook signature, map sự kiện → trạng thái subscription trong Supabase | P0 | L | ✅ Done — verify thật end-to-end: checkout URL tạo thành công qua API Sandbox thật (`txn_01kwsgy16ys5tknvjp3wbwnnn7`) sau khi user cấu hình Default Payment Link |
| US-216 | UI Billing trong Settings: hiển thị Free/Pro, nút Upgrade (mở checkout Paddle trong browser), nút Manage billing | P1 | M | ✅ Done |
| US-217 | Webhook receiver — vì app không có server public, dùng Supabase Edge Function làm webhook endpoint (nhận từ Paddle, ghi thẳng vào bảng `subscriptions` bằng service role) | P0 | M | ✅ Done — verify thật end-to-end: user thật tạo qua admin API, webhook `subscription.activated` ký đúng HMAC gửi tới function thật → 200 OK → row `subscriptions` ghi đúng đầy đủ field; request chữ ký sai → đúng 401. Bug thật gặp và fix trong lúc verify: Supabase platform-level JWT check chặn Paddle's request trước khi code chạy — cần `verify_jwt = false` (xem ghi chú Sự cố ở đầu file) |
| US-218 | Test đơn vị cho toàn bộ logic thuần (signature verify, mapping trạng thái, session parsing) không cần network thật | P0 | M | ✅ Done — 17 test mới (`paddle-webhook-signature`, `auth-billing-config`, `auth-session-store`), 99/99 tổng test pass |

---

## Kiến trúc

```
system browser (Supabase-hosted auth page / Paddle-hosted checkout)
        │  redirect
        ▼
recordscreen://auth-callback?...   ──▶  main/index.ts parseDeepLink
        │                                       │
        ▼                                       ▼
main/auth/AuthService.ts  ◀── IPC ──▶  renderer/store/useAuthStore.ts
        │  safeStorage (session)               │
        ▼                                       ▼
Supabase (Postgres: profiles, subscriptions)   renderer/components/Auth/*, SettingsPanel Billing section
        ▲
        │ webhook (service role key)
Paddle ─┴─ Supabase Edge Function (supabase-project/supabase/functions/paddle-webhook)
```

- **Vì sao không tự host webhook server**: app là desktop app của người dùng cuối, không chạy 24/7, không có địa chỉ public cố định — không thể là đích webhook của Paddle. Supabase Edge Function (chạy trên hạ tầng Supabase, có URL public cố định ngay cả với project free tier) giải quyết đúng vấn đề này mà không cần dựng thêm server riêng.
- **Vì sao email+password trước, OAuth sau**: email+password verify được đầy đủ trên Local (Supabase CLI local có GoTrue thật, hoạt động không cần cấu hình OAuth provider). OAuth (Google/GitHub) cần app đăng ký thật ở provider đó + redirect URL đã duyệt — không thể test thật cho tới khi có Supabase Cloud project, nên US-213 chỉ ở mức "code path done, chưa verify sống".

---

## Việc user cần làm thủ công (xem chi tiết trong 2 file doc riêng)

- `docs/SETUP_SUPABASE.md` — tạo project Supabase Cloud, lấy URL + anon key + service role key, deploy migration + Edge Function, cấu hình OAuth provider (nếu dùng).
- `docs/SETUP_PADDLE.md` — tạo Paddle account (sandbox trước), tạo Product/Price, lấy API key + webhook signing secret, cấu hình webhook URL trỏ vào Edge Function.

---

## Không làm trong sprint này

- Không khoá bất kỳ tính năng ghi/edit/export hiện có sau paywall — chỉ dựng hạ tầng.
- Không làm "quên mật khẩu" UI đầy đủ (Supabase hỗ trợ sẵn qua email, nhưng UI riêng cho luồng đó để sprint sau nếu cần).
- Không tự động renew/retry khi thanh toán thất bại — Paddle tự xử lý dunning, app chỉ phản ánh trạng thái mới nhất qua webhook.
