# Kế hoạch chuyển đổi theo PROMPT_PHAN_2.md (Bước 0)

Trạng thái: **đã duyệt theo đề xuất** (2026-10-05): gỡ OpenAI, timeout 30 s, làm xen kẽ như mục 4, ngắt lời theo mục 4b. Còn chờ: ai giữ khóa Claude cho bản thử nghiệm (điểm 2).

Tiến độ: 3b.1 xong (2026-10-05).

## 1. Trạng thái hiện tại

| Hạng mục                         | Trạng thái                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Giai đoạn 0–7 (MASTER_PROMPT §9) | Xong (GĐ 8+ chỉ làm khi được yêu cầu)                                                              |
| Kiểm thử                         | 317 unit test (43 tệp) · 27 E2E · 21 Rust — tất cả đạt; CI GitHub đạt; bản 0.2.0 đã phát hành      |
| AI local (LM Studio)             | Đã gỡ ngày 2026-10-05 (trước PROMPT_PHAN_2): không còn client, phát hiện hay cài đặt LM Studio     |
| Lớp AI hiện có                   | Rust `ai.rs`: Gemini (mặc định), OpenAI, Anthropic; khóa trong keychain; hủy, hết giờ; JSON schema |
| Cập nhật trong app               | Có (phần web ký số Ed25519, một kênh duy nhất)                                                     |

Vì GĐ 3 đã xong → theo A7 thêm **giai đoạn chuyển đổi 3b**.

## 2. Phần mã bị ảnh hưởng

| Yêu cầu                                              | Mã hiện tại                                                                                                      | Việc cần làm                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2 `AIProvider` cắm-rút                              | `src-tauri/src/ai.rs` dùng `match` theo nhà cung cấp                                                             | Tách trait `AIProvider` + `GeminiProvider` / `ClaudeProvider` (mỗi cái một tệp)                                                                                        |
| A2 chỉ Gemini + Claude                               | Còn **OpenAI** (19 chỗ: Rust, `aiStore`, `types`, TopBar, i18n, test)                                            | Gỡ OpenAI                                                                                                                                                              |
| A2 hai bản build                                     | Chỉ một bản; `identifier` `vn.stemsimlab.desktop`                                                                | Cargo feature `edition-main` / `edition-pilot` + `VITE_EDITION`; bản pilot có identifier riêng, không biên dịch `GeminiProvider`                                       |
| A2 retry/backoff, hạn mức/ngày, cache đề đã xác nhận | Chưa có (chỉ timeout + hủy; sửa JSON 2 lần đã có)                                                                | Thêm trong Rust (retry 429/5xx tối đa 3 lần) + bộ đếm theo ngày + cache theo hash đề                                                                                   |
| A2 timeout mặc định 30 s                             | Đang 90 s (model Gemini có bước "suy nghĩ")                                                                      | Đặt 30 s cho lời gọi ngắn, đo thực tế bằng key thật rồi chốt                                                                                                           |
| A2 màn hình "Kết nối AI"                             | Có trong Cài đặt: chọn nhà cung cấp, ô khóa, Kiểm tra kết nối, hướng dẫn 6 bước, cảnh báo gói miễn phí           | Thêm nút hiện/ẩn, hiện 4 ký tự cuối (Rust trả về `••••abcd`, không trả cả khóa), 4 trạng thái kết quả, ảnh minh họa hướng dẫn, đặt sau khóa PIN ở bản pilot            |
| A3 an toàn                                           | Chưa có cổng tuổi, đồng ý phụ huynh, kiểm duyệt, nhật ký sự cố, trang Quyền riêng tư                             | Thư mục mới `src/safety/` + `docs/LEGAL_COMPLIANCE.md`, `docs/PILOT_CONSENT.md`                                                                                        |
| A4 giao diện                                         | Bố cục kiểu phần mềm kỹ thuật: cây chủ đề trái, sân khấu, Inspector, panel dưới, TopBar có ô đề bài; Tour 3 bước | Trang chủ "Hôm nay học gì?", onboarding ≤ 5 bước (thay Tour), chế độ Cơ bản/Nâng cao, Trình độ → Môn → Chủ đề → Bài, bảng xác nhận dạng thẻ, vùng bấm ≥ 40 px, cảm ứng |
| A4 học bằng khám phá                                 | Chưa có                                                                                                          | `src/learn/`: Dự đoán–Quan sát–Giải thích, thử thách nhỏ, gợi ý từng bước, tiến độ/huy hiệu, nhắc nghỉ 45 phút                                                         |
| Cập nhật trong app                                   | Một kênh, gói web chung                                                                                          | **Mỗi bản build một kênh riêng** (tệp `web-update-main.json` / `web-update-pilot.json`), để bản pilot không bao giờ nhận gói web có mã Gemini                          |
| A6 golden set                                        | Chỉ Gemini                                                                                                       | Chạy được với Gemini và Claude; CI dùng phản hồi ghi sẵn                                                                                                               |
| Tài liệu                                             | USER_GUIDE, ARCHITECTURE, CLAUDE.md nói về OpenAI và đối tượng "học sinh THPT"                                   | Cập nhật đối tượng (A1), bỏ OpenAI, thêm hai bản build                                                                                                                 |

## 3. Kế hoạch giai đoạn 3b (đề xuất thứ tự)

| Bước     | Nội dung                                                                                                                                                                                                                                                                                                                                                                         | Tiêu chí xong                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **3b.1** | Rust: trait `AIProvider`, `GeminiProvider` + `ClaudeProvider`, gỡ OpenAI; Cargo features + `VITE_EDITION`; retry/backoff, hạn mức/ngày, cache đề đã xác nhận                                                                                                                                                                                                                     | Test cũ đạt; test "bản pilot không chứa Gemini" (kiểm tra mã nguồn biên dịch + chuỗi `generativelanguage.googleapis.com` không có trong tệp chạy và gói web pilot) |
| **3b.2** | Màn hình "Kết nối AI" đầy đủ theo A2                                                                                                                                                                                                                                                                                                                                             | E2E: khóa hợp lệ / sai / hết hạn mức / mất mạng; khóa không xuất hiện trong log                                                                                    |
| **3b.3** | An toàn A3: cổng 18 tuổi (bản chính, chặn lưu khóa Gemini khi chưa xác nhận), cổng tuổi + PIN người giám sát (pilot), nhãn "Nội dung do AI hỗ trợ", kiểm duyệt hai chiều, nhật ký sự cố (chỉ loại sự cố), nút báo cáo, trang Quyền riêng tư; `LEGAL_COMPLIANCE.md` (tra điều khoản hiện hành Google, Anthropic, luật Việt Nam — chỉ liệt kê, không kết luận), `PILOT_CONSENT.md` | Test cổng tuổi cả hai bản                                                                                                                                          |
| **3b.4** | Giao diện A4: trang chủ, onboarding, Cơ bản/Nâng cao, cấu trúc Trình độ (Nền tảng làm trước; ánh xạ chương trình để `review_status: "pending"`), làm lại màn mô phỏng + bảng xác nhận dạng thẻ                                                                                                                                                                                   | Chạy tốt 1366×768; E2E cũ cập nhật và đạt                                                                                                                          |
| **3b.5** | `src/learn/`: Dự đoán–Quan sát–Giải thích, thử thách, gợi ý từng bước, tiến độ/huy hiệu, nhắc nghỉ                                                                                                                                                                                                                                                                               | Mỗi chủ đề Vật lý có ít nhất 1 thử thách (đáp án tính bằng engine)                                                                                                 |
| **3b.6** | Đóng gói hai bộ cài + hai kênh cập nhật; USER_GUIDE (cách lấy key), `USER_TESTING.md` (hướng dẫn thử nghiệm A4.5)                                                                                                                                                                                                                                                                | Release tạo đủ 2 bộ cài; app chạy khi chưa có key và khi mất mạng                                                                                                  |

Ước lượng: 3b.1–3b.3 khoảng 3–4 phiên làm việc; 3b.4–3b.5 là phần lớn nhất (làm lại giao diện), 4–6 phiên.

## 4. Lồng Phần B (Dạy học bằng AI) vào lộ trình

GĐ 4–7 của MASTER_PROMPT đã xong, nên không cần xen kẽ với chúng. Đề xuất:

1. **T0 (đặc tả + khảo sát giọng nói + điều khoản)** chạy **song song** với 3b.4–3b.5, vì chủ yếu là tra tài liệu và viết đặc tả, không đụng mã giao diện đang làm lại.
2. **T1–T3 (phần "diễn": bài giảng dựng tay, bảng trắng, khuôn mặt)** bắt đầu ngay sau 3b.1, vì không cần LLM, chỉ cần TTS và giao diện mới.
3. **T4 trở đi (nối "não" Gemini/Claude)** chỉ bắt đầu khi 3b.1–3b.3 xong (cần `AIProvider`, hai bản build và các lớp an toàn).
4. GĐ 8+ (mở rộng mô phỏng) để sau T8, hoặc khi người dùng yêu cầu.

## 4b. Yêu cầu bổ sung: ngắt lời bằng giọng nói (barge-in) — thêm 2026-10-05

Người dùng muốn: khi AI đang dạy, học sinh có thể **lên tiếng ngắt lời**; AI dừng lại, **trả lời đúng điều học sinh hỏi/yêu cầu**; khi học sinh nói "dạy tiếp" thì AI **dạy tiếp từ chỗ đã dừng**.

Ánh xạ vào PROMPT_PHAN_2: B6.2 (barge-in), B10.3 (máy trạng thái CLARIFYING/PAUSED), B4.1b (nút "Giơ tay"), phase T5.

Hành vi cần làm:

1. Phát hiện tiếng nói bằng xử lý tín hiệu (VAD, không dùng AI); học sinh nói > ~300 ms có nội dung → giáo viên dừng tiếng ≤ 200 ms, vẽ nốt nét đang vẽ, mặt chuyển sang `listening`.
2. Lưu **điểm quay lại** (đang ở bước nào của bài, câu nào).
3. Nhận dạng giọng nói (ASR đám mây) → lệnh nhanh xử lý bằng luật trước khi hỏi AI: "dừng", "chậm lại", "nói lại", "tiếp tục/dạy tiếp".
4. Câu hỏi khác → AI trả lời (trạng thái CLARIFYING), xong hỏi "Mình quay lại chỗ lúc nãy nhé?".
5. "Dạy tiếp" (hoặc bấm nút) → quay lại đúng điểm đã lưu.
6. Chống vọng tiếng loa vào micro (echo cancellation của getUserMedia); có nút "Giơ tay" và gõ chữ làm đường dự phòng khi không có micro.

Xếp lịch: đặc tả ở T0, làm phần máy trạng thái + điểm quay lại + lệnh bằng chữ ở T4–T5, thêm giọng nói thật ở T5. Cần 3b.1–3b.3 xong trước (cần `AIProvider` để trả lời).

## 5. Điểm cần người dùng quyết định

1. **Gỡ OpenAI?** PROMPT_PHAN_2 chỉ nói Gemini + Claude. Đề xuất: gỡ.
2. **Khóa Claude cho bản pilot:** do người giám sát (người lớn) tạo tài khoản Anthropic và trả phí API; ai sẽ là người này?
3. **Timeout mặc định:** yêu cầu 30 s; model Gemini hiện hành có bước suy nghĩ có thể lâu hơn với đề dài. Đề xuất 30 s cho lời gọi ngắn, đo lại khi có key thật rồi chốt.
4. **Thứ tự:** làm 3b.1 → 3b.6 tuần tự rồi mới tới Phần B, hay xen kẽ như mục 4?
5. Các điểm pháp lý (điều khoản Google/Anthropic về người dưới 18, quy định bảo vệ dữ liệu và trẻ em của Việt Nam, số đường dây hỗ trợ) sẽ được tra cứu ở 3b.3 và T0, có trích dẫn, để người dùng/giáo viên xác nhận — không tự kết luận.
