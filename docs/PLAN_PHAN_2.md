# Kế hoạch chuyển đổi theo PROMPT_PHAN_2.md (Bước 0)

Trạng thái: **đã duyệt theo đề xuất** (2026-10-05): gỡ OpenAI, timeout 30 s, làm xen kẽ như mục 4, ngắt lời theo mục 4b. Còn chờ: ai giữ khóa Claude cho bản thử nghiệm (điểm 2).

Tiến độ: 3b.1 xong, 3b.2 xong (2026-10-05). Lưu ý phát hành: 3b.1–3b.2 đổi phần Rust (lệnh mới, tên nhà cung cấp `claude`), nên lần phát hành tới phải tăng **cả** phiên bản native (bộ cài mới); bản cập nhật web không đủ.

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

Tiến độ (2026-10-06): 3b.1, 3b.2, 3b.3, 3b.3b, 3b.4, 3b.5, **3b.6** đã làm (xem
`docs/PROGRESS.md`); bản 0.3.0 có hai bộ cài. Chế độ Cơ bản có các thẻ _Đồ thị · Lời giải · Thử
thách_. **T0** (đặc tả AI Teacher, khảo sát giọng nói, màn hình phác thảo) đã làm, **chờ người dùng
duyệt** trước khi sang T1.

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

**Đã quyết (2026-10-05):** gỡ OpenAI; timeout 30 s; xen kẽ Phần B như mục 4; người tạo và trả phí
khóa Claude cho bản pilot là **sinh viên từ 18 tuổi hoặc phụ huynh** sẵn sàng đầu tư cho con học
(ghi trong `PILOT_CONSENT.md`; điểm cần xác nhận ở `LEGAL_COMPLIANCE.md` mục 6). Kết quả tra cứu
pháp lý của 3b.3: `docs/LEGAL_COMPLIANCE.md`.

## 6. Mô hình AI miễn phí dự phòng — ĐÃ QUYẾT: nới quy tắc (2026-10-05)

Người dùng đề xuất: khi mô hình trả phí hết token, chuyển sang một mô hình AI **miễn phí nhưng đủ
tốt** để tiếp tục bài giảng — **cho cả học sinh THPT** ("việc không có AI thì rất thiếu sót").
Người dùng đã đồng ý **nới quy tắc "chỉ Gemini + Claude"** của PROMPT_PHAN_2 A1/A2. Vẫn giữ: không
AI chạy cục bộ; mọi lời gọi đi qua Rust `AIProvider`; mọi lớp an toàn của 3b.3; mỗi nhà cung cấp
phải được tra điều khoản (độ tuổi, dữ liệu, Việt Nam) và ghi vào `LEGAL_COMPLIANCE.md` mục 2b
trước khi thêm.

Kết quả tra cứu (2026-10-05, chi tiết và nguồn: `LEGAL_COMPLIANCE.md` mục 2b):

| Nhà cung cấp                                      | Bản chính (18+) | Bản pilot (dưới 18, có giám sát) | Lý do chính                                                                                                                                                                                                                              |
| ------------------------------------------------- | --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Groq** (gói miễn phí)                           | ✔ ứng viên số 1 | ✔ ứng viên số 1                  | Chủ tài khoản 18+ (người lớn trả phí/giám sát); điều khoản cho phép ứng dụng có người dưới tuổi trưởng thành dùng, khách hàng tự chịu trách nhiệm tuân thủ luật; **không dùng dữ liệu để huấn luyện**; JSON schema chặt; 1 000 lượt/ngày |
| **Cloudflare Workers AI**                         | ✔ dự phòng 2    | ✔ dự phòng 2 (cần xác nhận thêm) | Không dùng dữ liệu để huấn luyện; 10 000 "Neurons"/ngày; điều khoản không nói về độ tuổi (im lặng, không phải cho phép rõ)                                                                                                               |
| **Mistral** (gói Experiment)                      | có thể          | chỉ khi tắt huấn luyện           | Cho phép trẻ vị thành niên khi có đồng ý của cha mẹ, nhưng gói miễn phí **mặc định dùng dữ liệu để huấn luyện**                                                                                                                          |
| Gemini API, Alibaba                               | Gemini đã có    | ✘                                | Điều khoản cấm người dưới 18                                                                                                                                                                                                             |
| GitHub Models, Cerebras, Together, NVIDIA, Cohere | ✘               | ✘                                | Đã đóng, chỉ dùng thử, hoặc không có gói miễn phí                                                                                                                                                                                        |

Bước **3b.3b** — đã duyệt và **đã làm** (2026-10-05); riêng mục 3 (chọn mô hình bằng bộ đề chuẩn)
cần khóa Groq thật: `LLM_PROVIDER=groq GROQ_API_KEY=… npm run golden:llm`. Mặc định hiện tại
`qwen/qwen3.8-27b` (chọn theo bảng xếp hạng tiếng Việt SEA-HELM của các mô hình Qwen cùng dòng).

1. Rust: thêm `OpenAiCompatibleProvider` (một mã cho Groq, Cloudflare, …: `chat/completions` +
   `response_format: json_schema`), khóa trong keychain như hiện nay; bản pilot cần PIN.
2. **Chuỗi dự phòng:** nhà cung cấp chính báo hết lượt/hết credit (429 theo ngày, 402, "credit
   balance") → tự chuyển sang nhà cung cấp dự phòng đã cấu hình; nhãn "Nội dung do AI hỗ trợ" ghi
   rõ mô hình nào đã trả lời. Không tự chuyển khi lỗi khóa hoặc lỗi mạng.
3. Mô hình mặc định: `qwen/qwen3.8-27b` hoặc `openai/gpt-oss-120b` trên Groq — chọn sau khi chạy bộ
   đề chuẩn (golden set) tiếng Việt với cả hai.
4. Cài đặt → Kết nối AI: thêm mục "Dự phòng khi hết lượt", hướng dẫn lấy khóa Groq (người tạo khóa
   phải từ 18 tuổi), khuyên bật Zero Data Retention.
5. Cập nhật trang Quyền riêng tư, `PILOT_CONSENT.md` (thêm Groq vào danh sách nơi nhận đề bài).
