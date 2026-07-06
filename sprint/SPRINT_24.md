# Sprint 24 — AI-Assisted Editing: Script-Driven Cuts & Auto B-Roll Cues

**Duration:** Week 89-92 (4 tuần)
**Goal:** Từ Sprint 9 (auto silence removal), app đã có khả năng cắt theo tín hiệu audio đơn giản. Đối thủ trực tiếp (Screen Studio, Descript) đã tiến xa hơn: cắt theo transcript, xoá "ừm/à", tự gợi ý đoạn nên zoom nhấn mạnh dựa trên ngữ điệu/tốc độ nói. Sprint này thêm transcript-driven editing — biến video thành text để sửa nhanh hơn thao tác kéo timeline thủ công, tận dụng đúng hạ tầng audio đã có (Sprint 11 audio mixer) mà không cần gọi API AI ngoài (chạy on-device để giữ đúng triết lý "app desktop local" xuyên suốt dự án).
**Status:** 🟡 Done pending 1 manual check (US-183 binary built+registered, TCC packaged-app verification outstanding — xem `test/RESULTS/sprint-24-transcriber-verification.md`; US-184/185/186/187 ✅ Done; US-188 deferred)

---

## Sprint Goal

> Ba quan sát:
>
> 1. **Sprint 9 auto-silence-removal cắt theo biên độ âm thanh (đơn giản, hiệu quả) nhưng không "hiểu" nội dung.** Không phân biệt được khoảng lặng có ý nghĩa (nghỉ trước ý quan trọng) với khoảng lặng thừa (loay hoay tìm từ).
> 2. **Không có transcript.** Muốn xoá 1 câu nói vấp phải tự nghe lại và kéo đúng timestamp — chậm hơn nhiều so với sửa text rồi để app tự cắt đúng đoạn tương ứng (mô hình Descript đã phổ biến hoá).
> 3. **Không gợi ý điểm nên nhấn mạnh (zoom).** Zoom hiện tại (Sprint 4) dựa hoàn toàn vào cursor/click — video có đoạn nói quan trọng nhưng không tương tác chuột (nhìn màn hình giải thích) không được zoom dù đáng nhấn.
>
> Quyết định kiến trúc quan trọng: dùng model on-device (Apple `SFSpeechRecognizer` cho transcript tiếng Anh/Việt cơ bản, không cần internet, không gửi audio người dùng ra ngoài) — nhất quán với `face-detector` (Vision framework) đã dùng, giữ đúng cam kết "không phụ thuộc cloud AI" từ đầu dự án.

---

## User Stories

| ID | Story | Priority | Estimate | Status |
|----|-------|----------|----------|--------|
| US-183 | Swift helper mới `transcriber`: dùng `SFSpeechRecognizer` (on-device, `requiresOnDeviceRecognition = true`) sinh transcript có timestamp per-word từ audio track, output JSON stream giống format `cursor.json` đã có | P0 | L | 🟡 Binary xây xong, build sạch, đăng ký vào `build-swift.sh` — chạy trực tiếp từ terminal bị TCC abort do thiếu bundle identity thật (xem `test/RESULTS/sprint-24-transcriber-verification.md`); đã thêm `NSSpeechRecognitionUsageDescription` vào `electron-builder.yml` theo đúng cơ chế `cursor-tracker` dùng cho Accessibility permission, còn 1 bước verify thủ công trên bản đóng gói thật |
| US-184 | Transcript panel trong Editor: hiện text đầy đủ, click vào từ để nhảy playhead tới đúng thời điểm | P0 | L | ✅ Done — `TranscriptPanel.tsx` |
| US-185 | Xoá đoạn text = xoá đoạn video: bôi đen 1 đoạn transcript (kéo chọn), xoá → tạo `segments[]` split đúng ranh giới thời gian tương ứng (tái dùng multi-clip Sprint 8/9), preview cập nhật ngay | P0 | M | ✅ Done — `deleteTranscriptRange` tái dùng đúng pattern `applyRemoveSilences` (Sprint 9) |
| US-186 | Auto-detect filler words (um, uh, like...) trong transcript, gợi ý danh sách để xoá hàng loạt 1 click — mở rộng từ Sprint 9 nhưng dựa trên nội dung từ thay vì chỉ biên độ | P1 | M | ✅ Done — `isFillerWord`, nút "Remove N filler words" |
| US-187 | Xuất transcript dạng SRT — tái dùng dữ liệu US-183 cho use case phụ đề video, không chỉ để edit | P2 | S | ✅ Done — `transcriptSrtFormat.ts` (nhóm từ theo pause/8-từ mỗi cue, verify bằng unit test thật `test/unit/transcript-srt-format.test.ts`), IPC `transcript:export-srt` dùng `dialog.showSaveDialog` |
| US-188 | Gợi ý zoom-in tại đoạn nói chậm/nhấn nhá rõ dựa vào tốc độ nói | P2 | M | 🔲 Deferred — để sprint sau, tránh mở rộng phạm vi khi US-183 còn 1 bước verify treo |

---

## Định hướng kỹ thuật

**Transcript pipeline (US-183):**
- `swift/transcriber/Sources/main.swift` — input: đường dẫn audio track đã tách (đã có từ Sprint 11 `audio-composer`), output JSON: `[{ word, startTime, endTime, confidence }]`.
- Chạy async sau khi recording dừng (giống thumbnail generation hiện tại) — không block flow save project, transcript sẵn sàng khi user mở Editor.
- Ngôn ngữ: dò theo `Locale.current` mặc định, cho phép chọn thủ công trong Settings nếu sai (tiếng Việt lẫn tiếng Anh trong 1 video demo là tình huống thật).

**Transcript panel (US-184, US-185):**
- Component mới `src/renderer/src/components/Editor/Sidebar/TranscriptPanel.tsx`, giống cấu trúc `ChapterPanel.tsx` (Sprint 15) đã có nhưng hiển thị dày đặc hơn (từng từ, không phải marker rời rạc).
- Xoá đoạn: map lựa chọn text → khoảng `[startTime, endTime]` → gọi đúng hàm `splitSegment`/`rippleDelete` đã có từ Sprint 8, không viết logic cắt mới.

**Filler word detection (US-186):**
- Danh sách từ đệm cấu hình được (khác nhau theo ngôn ngữ) trong `src/shared/constants.ts`, match trực tiếp trên transcript đã có — không cần model riêng.

---

## Definition của Done

- [ ] Ghi xong 1 video có giọng nói → mở Editor → transcript panel hiện đúng nội dung, timestamp khớp với audio thật
- [ ] Click từ trong transcript → playhead nhảy đúng vị trí
- [ ] Bôi đen + xoá 1 câu → video segment tương ứng bị cắt, phát lại mượt qua ranh giới cắt (không giật hình/tiếng)
- [ ] Gợi ý filler word → xoá hàng loạt → transcript + video cập nhật đồng bộ
- [ ] Export SRT → file phụ đề mở được trong VLC/QuickTime, timestamp đúng
- [ ] Nếu US-188 (gợi ý zoom) không đạt độ tin cậy trong sprint, hạ Blocked/P2 sprint sau — áp dụng đúng nguyên tắc "không ship gợi ý sai nhiều hơn giúp" đã dùng ở Sprint 19

---

## Vì sao chọn các tính năng này (trade-off đã cân nhắc)

| Đã cân nhắc nhưng KHÔNG chọn | Lý do loại |
|---|---|
| Gọi API cloud (Whisper API, GPT để tóm tắt) thay vì on-device | Vi phạm triết lý "app desktop local" xuyên suốt roadmap (đã từ chối tự-host video Sprint 21 vì lý do tương tự); `SFSpeechRecognizer` on-device đủ tốt cho use case edit, không cần độ chính xác cấp production caption |
| Auto-tóm tắt nội dung thành mô tả video (dùng cho YouTube description) | Giá trị thật nhưng cần LLM thật (không on-device khả thi ở chất lượng chấp nhận được) — để dành nếu sau này chấp nhận gọi cloud AI có ý thức, ngoài phạm vi sprint này |
| Multi-track transcript cho nhiều người nói (diarization) | Case hiếm trong demo/tutorial solo — phần lớn user quay 1 mình; độ phức tạp kỹ thuật (speaker diarization on-device) không tương xứng giá trị |

Sprint 24 là bước tiến lớn nhất về "sửa nhanh hơn" kể từ Sprint 9 — biến việc edit từ thao tác nghe-tua-cắt thủ công sang đọc-xoá-text, đúng xu hướng UX đã được Descript chứng minh hiệu quả.
