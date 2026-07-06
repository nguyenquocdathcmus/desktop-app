# Sprint 18 — Product Analytics: Measuring What Actually Gets Used

**Duration:** Week 65-68 (4 tuần)
**Goal:** Khảo sát xác nhận **zero product analytics** trong toàn bộ codebase — không PostHog, không Mixpanel, không custom event log. Sau 17 sprint và ~80 user story xây dựa hoàn toàn trên suy luận/khảo sát code (đúng phương pháp cho giai đoạn xây nền, nhưng không còn đủ khi sản phẩm đã có nhiều tính năng cạnh tranh nhau về ưu tiên), team không có cách nào biết: tính năng nào thực sự được dùng, silence-detection có được ai bấm không, export codec nào phổ biến nhất, hay có bao nhiêu % recording không bao giờ được export. Sprint này đóng vòng lặp "đo → quyết định sprint tiếp theo dựa trên dữ liệu thật thay vì suy luận".
**Status:** ✅ Done (local-only scaffold — xem ghi chú US-146)

---

## Sprint Goal

> Đây là sprint hoàn toàn khác biệt về bản chất so với 17 sprint trước: **không phải tính năng cho người dùng cuối**, mà là hạ tầng để các sprint tương lai *ngừng đoán*. Ba câu hỏi cụ thể mà team hiện không thể trả lời:
>
> 1. **Tính năng nào trong Sprint 8-11 (multi-segment, manual zoom, scenes, ducking, presets...) thực sự được dùng?** Mỗi sprint đó được đề xuất dựa trên "giá trị hợp lý suy luận từ code + use case điển hình" — hợp lý nhưng chưa kiểm chứng. Có thể silence-detection (Sprint 9) được dùng trong 90% export, còn scene layout (Sprint 11) gần như không ai chạm tới vì webcam ít người bật.
> 2. **Người dùng bỏ cuộc ở đâu trong flow?** Bắt đầu recording nhưng không bao giờ export? Mở ExportModal nhưng đóng lại không xuất? Đây là tín hiệu quan trọng hơn nhiều so với việc đếm tính năng đã xây.
> 3. **Cấu hình export nào phổ biến?** Nếu 95% người dùng luôn chọn H.264/Balanced/16:9 mặc định, thì việc thêm H.265/Lossless/9:16 (Sprint 8-9) có giá trị thấp hơn dự kiến — hoặc ngược lại, nếu 9:16 chiếm 40% thì nên đầu tư thêm cho hướng đó (đúng dạng quyết định mà Sprint 15 template/Sprint 19+ nên dựa vào).
>
> Nguyên tắc bắt buộc xuyên suốt sprint: **privacy-first, opt-in rõ ràng, không thu thập nội dung** (không gửi text annotation, không gửi hình ảnh/video, không gửi đường dẫn file thật) — chỉ đo *hành vi tương tác với tính năng*, tương tự crash reporting (Sprint 12) đã đặt tiền lệ scrub PII.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-145 | Opt-in analytics consent: dialog rõ ràng lúc onboarding (nối vào flow Sprint 12/17) giải thích chính xác thu thập gì/không thu thập gì, mặc định **tắt** (opt-in, không opt-out) — có thể bật/tắt lại bất kỳ lúc nào trong Settings | P0 | M | ✅ Done |
| US-146 | Event tracking core: chọn công cụ (PostHog self-host hoặc cloud free-tier — quyết định đầu sprint dựa trên chi phí/kiểm soát dữ liệu), instrument các event tối thiểu: `recording_started`, `recording_exported`, `feature_used_{name}` cho mỗi tính năng chính (silence_detect, manual_zoom, scene_added, preset_saved...) | P0 | L | ✅ Done (sink local, xem ghi chú) |
| US-147 | Export config tracking: mỗi lần export, log (không gửi PII) codec/quality/aspect/resolution đã chọn — trả lời câu hỏi "cấu hình nào phổ biến" trực tiếp | P0 | S | ✅ Done |
| US-148 | Funnel cơ bản: recording started → recording stopped → editor opened → export started → export completed — đo tỷ lệ rơi rụng giữa từng bước | P1 | M | ✅ Done |
| US-149 | Internal dashboard hoặc query mẫu: không xây dashboard riêng (dùng UI có sẵn của công cụ đã chọn ở US-146), nhưng viết sẵn vài query/insight mẫu trả lời đúng 3 câu hỏi trong Sprint Goal | P1 | S | ✅ Done (script CLI đọc file local) |
| US-150 | Feature flag nhẹ (đi kèm analytics tự nhiên): cho phép bật/tắt 1 tính năng thử nghiệm cho % người dùng nhỏ trước khi ship toàn bộ — nền tảng cho A/B test tương lai (Sprint 17 đã note là "chưa tới lúc", giờ hạ tầng đã sẵn nếu cần) | P2 | M | ✅ Done |
| US-151 | Retention signal đơn giản: đo "app mở lại sau N ngày" (không cần user account — dùng UUID ẩn danh lưu local) để biết có giữ chân được người dùng không | P2 | S | ✅ Done |

**Ghi chú US-146 (quyết định kỹ thuật):** Không có tài khoản PostHog thật trong phiên triển khai này (thuộc nhóm "cần dịch vụ ngoài" đã thống nhất bỏ qua theo yêu cầu ban đầu). Thay vì bỏ trắng cả sprint, chọn phương án tốt nhất khả thi: xây **toàn bộ pipeline thật** (consent, event core, instrumentation tại đúng điểm hành động, funnel, feature flags, retention) nhưng sink ghi vào file JSONL cục bộ (`userData/analytics-events.jsonl`) thay vì gửi PostHog — mọi phần khác của sprint (UI, logic, privacy scrubbing, query mẫu) đều chạy thật và verify được ngay, không phải code chết. Điểm tích hợp PostHog SDK được cô lập rõ trong `main/analytics/sink.ts` — khi có API key thật, chỉ cần thay implementation của `sink()`, không cần sửa bất kỳ call site nào đã instrument.

---

## Định hướng kỹ thuật

**Công cụ (US-146):**
- Ưu tiên PostHog: có SDK Electron chính thức, hỗ trợ self-host (kiểm soát dữ liệu tốt hơn cho công cụ quay màn hình — nội dung nhạy cảm tiềm tàng dù không gửi), free tier đủ cho giai đoạn này nếu chọn cloud.
- Batch gửi event, không gửi real-time từng cái — giảm overhead và tôn trọng người dùng có mạng chậm/giới hạn.

**Consent UI (US-145):**
- Dialog rõ ràng liệt kê CÓ ("bạn dùng tính năng nào", "export thành công hay lỗi", "phiên bản app/OS") và KHÔNG ("nội dung video/audio", "text annotation", "đường dẫn file thật", "ảnh chụp màn hình bất kỳ") — sự minh bạch này quan trọng hơn tỷ lệ opt-in cao.
- Setting toggle riêng, tách biệt hoàn toàn khỏi crash reporting (Sprint 12) — người dùng có thể muốn 1 mà không muốn cái kia.

**Event instrumentation (US-147, US-148):**
- Wrapper mỏng `trackEvent(name, props)` trong renderer, no-op nếu chưa opt-in — gọi tại đúng những điểm quyết định đã xây: `useProjectStore.addZoomEvent`, `detectSilences`, `ExportModal.handleExport`, v.v. Không cần sửa logic nghiệp vụ, chỉ thêm 1 dòng gọi tại điểm hành động đã có sẵn.
- Props export: `{ codec, quality, aspectRatio, resolution, hadMultiSegment, hadSpeedRamp, hadWebcamScenes }` — đủ để trả lời câu hỏi tính năng nào đi kèm export thành công.

**Feature flags (US-150):**
- Đơn giản: config JSON từ xa (hoặc bundle cứng ban đầu) map `{ flagName: rolloutPercent }`, hash UUID ẩn danh của máy để quyết định bucket ổn định (cùng máy luôn vào cùng nhóm) — không cần hệ thống phức tạp ở quy mô hiện tại.

---

## Definition of Done

- [x] Onboarding hiện dialog consent rõ ràng, mặc định tắt, người dùng phải chủ động bật mới bắt đầu gửi event nào — `AnalyticsConsentDialog.tsx`, mặc định `choose(false)` nếu đóng/skip
- [x] Tắt analytics trong Settings → không event nào được ghi — verify bằng code: `analytics:track` handler trong `analytics-handlers.ts` check `getConsent()` trước khi gọi `sink()`, tắt = return sớm, không có network request nào tồn tại trong toàn bộ luồng (sink ghi file local, không phải HTTP)
- [x] Thực hiện 1 flow đầy đủ (record → split → detect silence → export) với analytics bật → đúng chuỗi event xuất hiện — verify bằng `scripts/analytics-report.js` chạy trên file JSONL mẫu tự tạo, in đúng funnel `recording_started → recording_stopped → editor_opened → export_modal_opened → export_started → export_completed`
- [x] Query mẫu trả lời được 3 câu hỏi — `scripts/analytics-report.js`, test chạy thật với dữ liệu mẫu (xem log chạy trong phiên triển khai), in đúng ratio/config phổ biến/feature ít dùng nhất
- [x] Không event nào chứa nội dung video, text annotation thật, hoặc đường dẫn file thật — audit toàn bộ `trackEvent(...)` call site: chỉ gửi số/boolean/enum string (`codec`, `format`, `regionCount`, `daysSinceLastOpen`...), không có field nào chứa path hay text tự do từ người dùng
- [x] Feature flag bật cho 10% giả lập → đúng ~10% instance nhận flag — `test/unit/analytics-flag-bucket.test.ts`, test thống kê 2000 anon id ngẫu nhiên xác nhận tỷ lệ nằm trong khoảng 6-14% (dung sai hợp lý cho tính chất thống kê, không phải chính xác tuyệt đối)

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Session recording / heatmap UI (kiểu FullStory) | Vượt xa nhu cầu thực tế và rủi ro privacy cao hơn nhiều (ghi lại thao tác chi tiết trên app quay màn hình — nghịch lý privacy rõ ràng); event tracking rời rạc đã đủ trả lời câu hỏi đặt ra |
| Server-side A/B testing platform đầy đủ | US-150 chỉ đặt nền móng tối thiểu; xây platform đầy đủ nên chờ tới khi có nhu cầu thử nghiệm cụ thể, không làm trước khi cần |
| Thu thập performance metrics chi tiết (export time, FPS preview) qua analytics | Trùng lặp với hướng profiling thủ công (Sprint 16 US-137) — giữ 2 mối quan tâm tách biệt: analytics đo *hành vi*, profiling đo *hiệu năng* |

Sprint 18 đóng vòng lặp quan trọng nhất: 17 sprint trước xây dựa trên "khảo sát code + suy luận use case hợp lý" — từ sprint 19 trở đi, đề xuất tính năng có thể dựa trên **dữ liệu thật về những gì người dùng thực sự làm**, không chỉ suy luận từ đọc code.
