# Desktop App — Flow chi tiết

> Flow tổng thể cả hệ thống (app + landing page + Supabase + Paddle): xem
> `docs/FLOW_OVERVIEW.md` ở thư mục cha của workspace.

## 1. Kiến trúc 3 tầng

```
┌─ Renderer (React + Zustand) ─────────────────────────────────┐
│  App.tsx → Editor / RecordingControls / WebcamFloat / …      │
│  gọi window.api.* (preload) — không bao giờ chạm Node API    │
├─ Preload (src/preload/index.ts) ─────────────────────────────┤
│  contextBridge: expose ~60 hàm ipcRenderer.invoke/on         │
├─ Main process (Node/Electron) ───────────────────────────────┤
│  index.ts boot → đăng ký ~20 nhóm IPC handler                │
│  spawn 4 binary Swift + ffmpeg khi cần                       │
└──────────────────────────────────────────────────────────────┘
     capture ─ cursor-tracker ─ face-detector ─ transcriber (Swift, resources/bin)
```

- **Renderer** không có quyền hệ thống — mọi việc đụng file/process/mạng đi qua IPC.
- **Main** giữ toàn bộ state nhạy cảm: session đăng nhập, Paddle API key, recording session.
- **Swift binaries** giao tiếp với main qua stdout JSON-lines (mỗi dòng 1 event) và stdin (lệnh `pause`/`resume`).

## 2. Flow khởi động (main/index.ts)

```
app.whenReady()
  → loadAuthBillingConfig()        # đọc .env.auth (cache 1 lần); thiếu → default Supabase local
  → registerXxxHandlers(ipcMain)   # ~20 nhóm: recording, project, export, auth, billing, …
  → createWindow (controls, editor)
  → createTray()                   # menu bar: Start/Stop Recording, Open, Quit
  → authService.restoreSession()   # đọc safeStorage, refresh token nếu sắp hết hạn
  → registerUpdateHandlers          # electron-updater, check sau 10s (chỉ bản packaged)
  → đăng ký protocol recordscreen:// (OAuth deep link)
```

## 3. Flow ghi hình (recording)

Các module: `RecordingSession.ts` (điều phối), `CaptureProcess.ts` (video),
`CursorProcess.ts` (chuột/phím), `recording-handlers.ts` (IPC).

```
UI RecordingControls → recording:start (displayId/windowId, fps, audio, webcam, HDR…)
  RecordingSession.start():
    1. Tạo thư mục ~/Documents/<RECORDINGS_DIR>/<uuid>/
    2. CursorProcess.start()  → spawn cursor-tracker, ghi từng event vào cursor.json
    3. CaptureProcess.start() → spawn capture (ScreenCaptureKit):
         event 'display' → kích thước pixel thật + origin (rebase cursor sau này)
         event 'started' → state 'recording' (timeout 10s nếu thiếu quyền)
  Pause/Resume: ghi 'pause\n'/'resume\n' vào stdin — SCStream giữ nguyên, chỉ drop frame
  Stop:
    1. state 'processing'; capture.stop() đợi process EXIT thật
       (đảm bảo moov atom đã flush — không đọc file sớm)
    2. rebaseCursorEvents(): đổi tọa độ chuột từ global points → pixel grid của video
    3. Đợi webcam.webm (window WebcamFloat gửi blob về, poll tối đa 4s)
    4. Mux mic.webm vào capture.mov (ffmpeg amix nếu có system audio);
       giữ system.m4a sidecar cho tính năng ducking lúc export
    5. Trả SessionManifest (id, đường dẫn, kích thước, duration, fps, hdr…)
  → generateProxyInBackground(): ffmpeg re-encode 720p ultrafast → proxy.mp4
    (chỉ phục vụ preview mượt; export luôn đọc capture.mov gốc)
```

**Component recording phía renderer:**

| Component | Vai trò |
|---|---|
| `RecordingControls.tsx` | Panel chọn màn hình/cửa sổ, fps, audio, webcam; nút Start/Stop/Pause |
| `RecordingPill` (trong RecordingControls) | Pill nổi hiển thị timer + Stop/Pause khi đang quay |
| `DisplayLayoutPicker.tsx` | Chọn display/cửa sổ để quay |
| `WebcamFloat.tsx` | Window riêng: preview webcam tròn nổi, MediaRecorder ghi webcam.webm |
| `KeystrokeOverlay.tsx` | Window overlay hiển thị phím tắt đang gõ khi quay |
| `tray.ts` / `trayIcon.ts` (main) | Menu bar icon, đổi icon khi đang quay, phím tắt toàn cục |

## 4. Flow mở project & chỉnh sửa (editor)

```
HomeScreen (danh sách recording — đọc từ recordings-index.json, cache 1 file JSON)
  → click recording → useProjectStore.newProjectFromManifest() / openProject()
      - áp preset mặc định của user (nếu có)
      - đọc cursor.json → generateZoomEvents() tự sinh zoom theo hoạt động chuột
  → Editor.tsx dựng UI:
      PreviewCanvas   — composite video + hiệu ứng realtime (usePreviewCompositor)
      ControlBar      — play/pause, thời gian, tốc độ
      Timeline        — track: segments, zoom, annotation, scene, chapter, blur, comment, waveform
      Sidebar         — panel chỉnh: Background/Padding/Cursor/Zoom/Webcam/DeviceFrame/Preset/Transcript
  Mọi chỉnh sửa → useProjectStore (immer + undo/redo) → isDirty
  → autosave vào manifest.json trong thư mục recording; flag crash-recovery trong userData
  → phát hiện conflict khi file trên disk mới hơn (SaveConflictBanner: overwrite/merge comments/discard)
```

**State stores (Zustand):**

| Store | Nội dung |
|---|---|
| `useProjectStore` | project đang mở: segments, zoom, annotations, scenes, chapters, blur, transcript, undo/redo, save/conflict |
| `usePlaybackStore` | vị trí phát, play/pause, duration |
| `useRecordingStore` | trạng thái recording phía UI |
| `useAuthStore` | trạng thái đăng nhập (mirror từ main qua auth:status-changed) |
| `useAccountPanelStore` | mở/đóng panel Tài khoản |
| `useThemeStore` / `useLocaleStore` | theme + 13 ngôn ngữ (strings/*.ts) |
| `useToastStore` / `useHintsStore` | toast + hint lần đầu dùng |

**Tính năng editor và đường xử lý:**

| Tính năng | Flow |
|---|---|
| Trim/split/speed | segments trong store → export truyền cho ffmpeg |
| Auto-zoom | `ZoomPathGenerator.ts` đọc cursor events → ZoomEvent[]; chỉnh tay ở ZoomPanel/ZoomEventTrack |
| Xóa khoảng lặng | `audio:detect-silence` (ffmpeg silencedetect, cache theo mtime) → ripple delete segments |
| Transcript | `transcript-handlers` → binary `transcriber` (Whisper) → click từ để nhảy, xóa range để cắt video |
| Webcam scenes | SceneTrack + WebcamPanel; face auto-framing qua binary `face-detector` (cache face.cache.json) |
| Blur vùng nhạy cảm | BlurRegionTrack → export ffmpeg boxblur |
| Chapters | ChapterTrack → export metadata + copy YouTube chapter list |
| Review comments | local-only, không export; merge được khi conflict |
| Command palette | ⌘K — `commands.ts` đăng ký lệnh theo màn hình |

## 5. Flow export

```
ExportModal (Editor) → chọn format (MP4/GIF), fps, resolution, codec H.264/H.265,
                       quality, aspect (16:9 / 9:16 / 1:1), HDR, âm lượng, ducking,
                       click sounds, batch (thêm bản dọc 9:16 + GIF)
  → buildOptions(): gom TOÀN BỘ state edit thành ExportOptions
     (segments+speed, zoom, annotations, keystroke badges, cursor path tổng hợp,
      blur, scenes, webcam, device frame, background/padding/radius…)
  → export:start → Exporter.ts (main):
      dựng filter graph ffmpeg (zoompan, overlay, boxblur, amix, subtitles ASS cho cursor…)
      chạy FFmpegWrapper → progress % + ETA đẩy về modal
  → xong: mở Finder / copy file vào clipboard / kéo-thả chia sẻ / PublishPanel upload
    (publish-handlers + publish/providers.ts, token lưu tokenStore)
```

## 6. Flow đăng nhập & thanh toán (phía app)

```
AccountPanel → signIn/signUp (email+password) hoặc OAuth:
  AuthService (main) dùng supabase-js, storage = MemoryStorage (PKCE verifier)
  OAuth: shell.openExternal(URL Supabase) → browser → deep link recordscreen://auth-callback
  → session lưu safeStorage (Keychain), broadcast auth:status-changed cho mọi window

Nâng cấp Pro:
  billing:create-checkout-url → PaddleService.createCheckoutUrl(userId, email)
    POST /transactions với custom_data.supabase_user_id  ← chìa khóa gắn payment với account
    → mở checkout URL (trỏ về landing page) trong browser
  Sau khi thanh toán: webhook cập nhật Supabase (xem FLOW_OVERVIEW)
  billing:get-subscription → query bảng subscriptions bằng token CỦA USER (RLS)
    → active/trialing ⇒ 'pro'; lỗi mạng trả riêng biệt, không giả vờ 'free'
  billing:open-portal → Paddle customer portal (hủy/đổi thẻ/hóa đơn)
```

Lưu ý đã fix (Sprint 29+): AccountPanel refetch subscription **mỗi lần mở panel**
(component luôn mounted, trước đây chỉ fetch khi auth state đổi → hiển thị gói cũ
sau khi thanh toán cho tới khi restart app).

## 7. Binary Swift (swift/)

| Binary | Vai trò | Giao tiếp |
|---|---|---|
| `capture` | ScreenCaptureKit quay màn hình/cửa sổ, HEVC/H.264, HDR 10-bit tùy chọn, mic/system audio | args CLI; stdout JSON events (`display`/`started`/`error`); stdin `pause`/`resume`; SIGTERM để dừng sạch |
| `cursor-tracker` | Ghi move/click/keydown/scroll toàn cục (tọa độ points) | stdout JSON lines → main ghi cursor.json |
| `face-detector` | Vision framework tìm mặt trong webcam.webm cho auto-framing | được gọi khi bật faceTracking |
| `transcriber` | Speech-to-text sinh transcript từng từ | transcript-handlers gọi |

Build bằng `npm run build:swift`; binary đóng gói vào `resources/bin/` (gitignore).

## 8. Các module main-process còn lại

| Module | Vai trò |
|---|---|
| `permissions.ts` | Kiểm tra/prompt quyền Screen Recording, Microphone, Accessibility |
| `app-handlers.ts` | version, onboarding flag, disk space, crash-recovery flag, hints, What's New |
| `recordings-list-handler.ts` + `recordingsIndex.ts` | danh sách recording qua 1 file index JSON (tránh quét N thư mục mỗi lần) |
| `project-handlers.ts` + `conflictTracker.ts` | đọc/ghi manifest.json, phát hiện conflict bằng mtime |
| `presets-handlers.ts` | presets (style), templates (cấu trúc edit), share (clipboard/drag) |
| `notification-detect/` | phát hiện notification hệ thống nhảy vào video → gợi ý blur/cắt |
| `theme-handlers.ts` / `locale-handlers.ts` | theme + ngôn ngữ đồng bộ main↔renderer |
| `analytics/sink.ts` + `analytics-handlers.ts` | telemetry ẩn danh (opt-in, AnalyticsConsentDialog) |
| `update-handlers.ts` | electron-updater qua GitHub Releases |
