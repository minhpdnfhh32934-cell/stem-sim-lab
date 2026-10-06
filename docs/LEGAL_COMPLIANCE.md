# Tuân thủ pháp lý và điều khoản (PROMPT_PHAN_2 A3)

> **Đây không phải tư vấn pháp lý.** Tài liệu chỉ liệt kê những gì đã tra được (có nguồn và ngày
> tra) và những điểm **người dùng / nhà trường / phụ huynh phải tự xác nhận**. Không có kết luận
> "đã hợp pháp" nào ở đây. Điều khoản và luật có thể thay đổi: tra lại trước mỗi đợt thử nghiệm.
>
> Ngày tra cứu: **2026-10-05** (mục 2c: **2026-10-06**). Mục ghi **CHƯA KIỂM CHỨNG** là chưa tìm
> được nguồn gốc rõ ràng.

## 1. Điều khoản Google Gemini API (bản chính)

Nguồn: Gemini API Additional Terms of Service — https://ai.google.dev/gemini-api/terms (sửa đổi
gần nhất 2026-04-28, tra 2026-10-05).

| Nội dung tra được                                                                                                                                                                        | Ứng dụng đã làm                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Người dùng API phải **từ 18 tuổi**; không dùng API trong ứng dụng "hướng tới hoặc có khả năng được dùng bởi" người dưới 18 tuổi.                                                         | Bản chính hỏi "Tôi đủ 18 tuổi" ngay lần đầu; chưa xác nhận thì Rust **từ chối lưu khóa** và từ chối mọi lời gọi AI.                  |
| Gói **miễn phí**: nội dung gửi lên có thể được dùng để cải thiện sản phẩm của Google và có thể được người thật đọc. Gói **trả phí**: không dùng để cải thiện, chỉ lưu để chống lạm dụng. | Trang "Quyền riêng tư & dùng AI an toàn" nói rõ điều này; ứng dụng chặn đề bài có số điện thoại, email, số căn cước, họ tên/địa chỉ. |
| Việt Nam nằm trong danh sách khu vực được dùng.                                                                                                                                          | —                                                                                                                                    |
| Bản thử nghiệm THPT (người dưới 18 tuổi): **không được có Gemini**.                                                                                                                      | Mã Gemini không được biên dịch vào bản pilot (test Rust `pilot_edition_has_no_gemini` + `scripts/edition-bundle.mjs`).               |

## 2. Điều khoản Anthropic (Claude API)

Nguồn: Commercial Terms of Service (2025-06-17) — https://www.anthropic.com/legal/commercial-terms;
Usage Policy (2025-09-15) — https://www.anthropic.com/legal/aup; bài hướng dẫn về sản phẩm có
người dùng dưới 18 tuổi — https://support.claude.com/en/articles/9307344.

| Nội dung tra được                                                                                                                                                                                       | Ứng dụng đã làm                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khách hàng API có thể là cá nhân; Commercial Terms ghi là dịch vụ cho doanh nghiệp/nhà phát triển ("not for consumer use"). **CHƯA KIỂM CHỨNG** có điều khoản độ tuổi riêng cho người mở tài khoản API. | Khóa Claude do **người lớn trả phí** tạo: sinh viên từ 18 tuổi hoặc phụ huynh (quyết định của người dùng, 2026-10-05). Người đó là khách hàng của Anthropic.                                                           |
| Sản phẩm phục vụ người dưới 18 tuổi nên có: xác minh tuổi, lọc/kiểm duyệt nội dung, giám sát và báo cáo, tài liệu hướng dẫn, system prompt an toàn cho trẻ em.                                          | Cổng năm sinh + đồng ý của phụ huynh + PIN người giám sát; kiểm duyệt hai chiều; nhật ký sự cố + nút báo cáo; trang hướng dẫn dùng AI an toàn; dòng an toàn trong system prompt (`SAFETY_RULES`, `src/ai/prompts.ts`). |
| **Bắt buộc** cho người dùng biết họ đang tương tác với AI; nên công bố việc tuân thủ luật bảo vệ trẻ em.                                                                                                | Nhãn "Nội dung do AI hỗ trợ" trên bảng đọc đề và đoạn diễn giải. Việc công bố tuân thủ: **cần người dùng quyết định** (xem mục 6).                                                                                     |
| Anthropic có thể kiểm tra và đình chỉ tài khoản vi phạm.                                                                                                                                                | —                                                                                                                                                                                                                      |
| Dữ liệu API mặc định không dùng để huấn luyện, xóa sau 30 ngày; nội dung bị gắn cờ vi phạm có thể giữ tới 2 năm.                                                                                        | Nêu trong trang Quyền riêng tư.                                                                                                                                                                                        |
| Việt Nam là quốc gia được hỗ trợ.                                                                                                                                                                       | —                                                                                                                                                                                                                      |

## 2b. Nhà cung cấp AI miễn phí dự phòng (tra 2026-10-05)

Người dùng quyết định (2026-10-05) cho phép thêm nhà cung cấp miễn phí khi hết lượt trả phí, kể cả
cho bản thử nghiệm THPT. Điều khoản tra được (nguồn chính; trích dẫn ngắn):

| Nhà cung cấp              | Độ tuổi chủ tài khoản                             | Ứng dụng có người dưới 18 dùng                                                                        | Dữ liệu (gói miễn phí)                                                                                                                        | Nguồn                                                                                                                                                   |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Groq**                  | "You must be 18 years of age or older"            | Được; "Customer will be solely responsible" cho việc tuân thủ luật về người dưới tuổi trưởng thành    | "Groq is not permitted to use Inputs or Outputs for training"; lưu tối đa 30 ngày để vận hành/chống lạm dụng, có tùy chọn Zero Data Retention | console.groq.com/docs/legal/services-agreement (Last Modified 2026-06-22); console.groq.com/docs/your-data; giới hạn: console.groq.com/docs/rate-limits |
| **Cloudflare Workers AI** | Không nêu                                         | Không nêu (im lặng — **không** phải cho phép rõ ràng)                                                 | "Cloudflare does not use any Customer Content to train generative AI tools"; mô hình bên thứ ba có thể kèm giấy phép riêng                    | cloudflare.com/service-specific-terms-developer-platform (hiệu lực 2026-09-28)                                                                          |
| **Mistral** (Experiment)  | Từ 13 tuổi, trẻ vị thành niên cần phép của cha mẹ | Không được để trẻ vị thành niên dùng "without legally adequate consent from their parent or guardian" | **Mặc định dùng để huấn luyện**, tắt được trong Admin > Privacy                                                                               | legal.mistral.ai/terms/commercial-terms-of-service (2026-09-25); help.mistral.ai bài 455206, 455207                                                     |
| Alibaba Model Studio      | 18+                                               | "Minors must not use…"                                                                                | —                                                                                                                                             | Chính sách quyền riêng tư quốc tế (2026-09-04)                                                                                                          |
| GitHub Models             | —                                                 | —                                                                                                     | Đã ngừng 2026-07-30                                                                                                                           | docs.github.com                                                                                                                                         |

Giới hạn Groq gói miễn phí (2026-10-05): `openai/gpt-oss-120b`, `openai/gpt-oss-20b`,
`qwen/qwen3.8-27b`: 30 yêu cầu/phút, 1 000/ngày, 8 000 token/phút, 200 000 token/ngày. Có cần thẻ
ngân hàng không: **CHƯA KIỂM CHỨNG**. Danh sách quốc gia của Groq: không tìm thấy (chỉ có điều khoản
kiểm soát xuất khẩu Mỹ) — **CHƯA KIỂM CHỨNG** Việt Nam có được dùng hay không.

Điểm cần xác nhận thêm (bổ sung vào mục 6):

- Người lớn tạo khóa Groq (18+) chấp nhận điều khoản Groq và trách nhiệm tuân thủ luật khi học
  sinh dưới 18 tuổi dùng ứng dụng qua khóa đó.
- Phiếu đồng ý phải liệt kê thêm nhà cung cấp dự phòng (Groq) là nơi nhận nội dung đề bài.
- Với Cloudflare: điều khoản không nói về độ tuổi — cần xác nhận trước khi dùng cho học sinh.

## 2c. Dịch vụ giọng nói cho "Dạy học bằng AI" (tra 2026-10-06, giai đoạn T0)

So sánh đầy đủ và đề xuất: `docs/VOICE_BENCHMARK.md`. Chỉ ghi điều khoản ở đây.

| Dịch vụ                        | Điều tra được (trích ngắn)                                                                                                                                                                                                                                                                                                                                                                  | Nguồn                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini TTS / Live / Transcribe | Cùng điều khoản Gemini API (mục 1): từ 18 tuổi, không dùng cho dịch vụ có khả năng được người dưới 18 dùng. Gói miễn phí: nội dung (kể cả âm thanh) dùng để cải thiện sản phẩm, có thể có người đọc. Nội dung lưu 55 ngày để chống lạm dụng. Âm thanh tạo ra có thủy vân SynthID. Chính sách cấm mạo danh người thật để lừa dối.                                                            | ai.google.dev/gemini-api/terms; …/docs/usage-policies (2026-06-09); policies.google.com/terms/generative-ai/use-policy; blog.google (TTS 3.8, 2026-09-23)                 |
| Microsoft Azure AI Speech      | Product Terms và trang quyền riêng tư của Speech **không nói** về người dưới 18 (im lặng). Code of Conduct (2026-05-01) yêu cầu cho người dùng biết giọng là giọng tổng hợp; có quy tắc riêng cho "Voice Features" — **chưa rõ** có áp dụng cho giọng có sẵn không. Nhận dạng thời gian thực: không lưu dữ liệu; TTS: không ghi văn bản/âm thanh vào log. Dùng để huấn luyện: **chưa nêu**. | microsoft.com/licensing/terms (Product Terms); learn.microsoft.com/en-us/legal/ai-code-of-conduct; trang "data, privacy and security" của Speech (2026-02-27, 2026-08-26) |
| Google Cloud TTS / STT         | Bản lưu Service Specific Terms (2026-02-18) §20(d): dịch vụ AI tạo sinh không dùng cho dịch vụ "likely to be accessed by individuals under the age of 18". TTS/STT xếp vào "Pre-Trained APIs"; **chưa rõ** Chirp 3 có bị coi là AI tạo sinh, và §20(d) còn trong bản hiện hành không (**CHƯA KIỂM CHỨNG**). Không dùng dữ liệu khách hàng để huấn luyện.                                    | cloud.google.com/legal/archive/terms/service-terms/index-20260218; cloud.google.com/terms/services (2026-09-30)                                                           |
| ElevenLabs                     | Điều khoản: người dưới 18 "may not use our Services"; chính sách quyền riêng tư cấm gửi dữ liệu giọng nói của người dưới 18; chính sách sử dụng lại cho phép 13–18 có phụ huynh đồng ý — **mâu thuẫn**.                                                                                                                                                                                     | elevenlabs.io/terms-of-use (2026-03-31); /privacy-policy (2026-05-20); /use-policy (2026-08-17)                                                                           |
| Vbee                           | Người dùng từ đủ 16 tuổi; dưới 16 cần cha mẹ đồng ý. Dữ liệu vào/ra được dùng để "cải tiến, phát triển sản phẩm".                                                                                                                                                                                                                                                                           | policy.vbee.vn (sửa đổi 2026-07-01)                                                                                                                                       |
| Viettel AI                     | Chính sách dữ liệu (tiếng Việt): không cung cấp cho cá nhân dưới 16; dữ liệu có thể dùng để huấn luyện AI. Bản tiếng Anh khác bản tiếng Việt.                                                                                                                                                                                                                                               | viettelai.vn/privacy/policy (không ghi ngày)                                                                                                                              |

Điểm cần xác nhận (bổ sung vào mục 6, số 9–12):

- Bản THPT dùng Azure: người lớn chủ tài khoản Azure và nhà trường xác nhận rằng điều khoản Microsoft
  (im lặng về người dưới 18) phù hợp; có cần thỏa thuận riêng với Microsoft không.
- Giọng nói học sinh được gửi tới dịch vụ nhận dạng cloud: phiếu đồng ý phải ghi rõ điều này và tên
  dịch vụ; phụ huynh/người giám sát đồng ý bật micro (B1.5).
- Google Cloud chỉ dùng cho học sinh khi Google xác nhận bằng văn bản về §20(d).

## 3. Luật Việt Nam liên quan

| Văn bản                                                           | Điểm liên quan (theo kết quả tra)                                                                                                                                                  | Ghi chú                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 2026-01-01) | Điều 24: xử lý thông tin của trẻ từ đủ 7 tuổi cần đồng ý của trẻ **và** người đại diện theo pháp luật.                                                                             | Nghị định 13/2023 được thay bằng Nghị định 356/2025 từ 2026-01-01. |
| Luật Trẻ em số 102/2016/QH13                                      | Trẻ em là người dưới 16 tuổi; Điều 21 quyền bí mật đời sống riêng tư; trẻ từ 7 tuổi cần được hỏi ý kiến.                                                                           | —                                                                  |
| Nghị định 56/2017/NĐ-CP, Điều 33 và 36                            | Bảo vệ thông tin bí mật đời sống riêng tư của trẻ em trên môi trường mạng.                                                                                                         | **CHƯA KIỂM CHỨNG** còn hiệu lực đầy đủ.                           |
| Luật Trí tuệ nhân tạo số 134/2025/QH15 (hiệu lực 2026-03-01)      | Điều 11: người dùng phải biết mình đang tương tác với AI, nội dung do AI tạo phải được gắn nhãn. Điều 7: cấm lợi dụng trẻ em. Hệ thống giáo dục có thời gian chuyển tiếp 18 tháng. | Nhãn AI đã có.                                                     |
| Luật Công nghiệp công nghệ số số 71/2025/QH15, Điều 44            | Đánh dấu sản phẩm do AI tạo ra.                                                                                                                                                    | —                                                                  |

Nên đối chiếu nguyên văn trên Cơ sở dữ liệu quốc gia về văn bản pháp luật (vbpl.vn) trước khi
thử nghiệm.

## 4. Đường dây hỗ trợ (dùng trong thẻ hỗ trợ khủng hoảng)

| Số               | Thông tin tra được                                                                                                             | Dùng ở đâu           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **111**          | Tổng đài quốc gia bảo vệ trẻ em, miễn phí, 24/7 (nay do Cục Bà mẹ – Trẻ em, Bộ Y tế vận hành).                                 | Bản pilot (học sinh) |
| **096 306 1414** | Đường dây Ngày Mai (tổ chức phi lợi nhuận), 13:00–20:30, thứ Tư – Chủ nhật.                                                    | Cả hai bản           |
| **115**          | Cấp cứu y tế. **CHƯA KIỂM CHỨNG** là đường dây hỗ trợ khủng hoảng tâm lý — chỉ ghi "đang gặp nguy hiểm ngay: gọi cấp cứu 115". | Cả hai bản           |
| 0984 104 115     | Viện Sức khỏe Tâm thần, BV Bạch Mai — giờ hành chính. **CHƯA KIỂM CHỨNG** là đường dây khủng hoảng.                            | Không dùng           |

Chưa tìm được đường dây khủng hoảng cho người lớn hoạt động 24/7 toàn quốc đã kiểm chứng.

## 5. Ứng dụng xử lý dữ liệu thế nào (tóm tắt kỹ thuật)

- Không tài khoản, không quảng cáo, không thống kê sử dụng. Mạng chỉ dùng khi: gọi AI (người dùng
  bấm), kiểm tra cập nhật trên GitHub.
- Gửi cho nhà cung cấp AI: nội dung đề bài và kết quả đã tính. Đề có dấu hiệu thông tin cá nhân,
  nội dung không phù hợp, hoặc dấu hiệu khủng hoảng **không được gửi** (`src/safety/moderation.ts`).
- Khóa API: kho khóa của hệ điều hành (Rust), trang web không bao giờ thấy khóa.
- Nhật ký sự cố (`incidents.json`): **chỉ loại sự cố và thời gian** (test Rust
  `incident_log_keeps_only_kind_and_time`). Bản pilot: chỉ người giám sát (PIN) xem/xóa được.
- Cổng an toàn nằm trong Rust (`src-tauri/src/safety.rs`): trang web không tự mở được AI.
  Mã PIN được băm (SHA-256 có muối, 100 000 vòng), sai 5 lần thì khóa 60 giây.

## 6. Những điểm người dùng / nhà trường / phụ huynh phải xác nhận

1. Trường hoặc đơn vị tổ chức thử nghiệm có cần xin phép/thông báo theo Luật 91/2025 và Nghị định
   356/2025 không (ví dụ: ai là "bên kiểm soát dữ liệu" khi học sinh dùng máy của trường).
2. Người trả phí khóa Claude (sinh viên 18+ hoặc phụ huynh) đã đọc và chấp nhận Commercial Terms,
   Usage Policy của Anthropic, và đồng ý rằng việc học sinh dưới 18 tuổi dùng sản phẩm qua khóa
   của mình phù hợp với hướng dẫn của Anthropic về sản phẩm có người dùng dưới 18 tuổi.
3. Có cần công bố công khai việc tuân thủ luật bảo vệ trẻ em (theo hướng dẫn của Anthropic) không,
   và công bố ở đâu.
4. Phiếu đồng ý (`docs/PILOT_CONSENT.md`) có đủ cho học sinh từ 7 tuổi trở lên theo Điều 24 Luật
   91/2025 (cả học sinh và phụ huynh cùng ký) không.
5. Thời gian chuyển tiếp 18 tháng của Luật AI 134/2025 cho hệ thống giáo dục có áp dụng cho dự án
   này không.
6. Các số đường dây ở mục 4 vẫn đúng vào thời điểm thử nghiệm (gọi thử hoặc tra trang chính thức).
7. Danh sách từ khóa kiểm duyệt có phù hợp với lứa tuổi học sinh tham gia không (thầy cô xem
   `src/safety/moderation.ts`).
8. Nhà cung cấp dự phòng miễn phí (mục 2b): người tạo khóa chấp nhận điều khoản của họ; phiếu
   đồng ý ghi rõ nhà cung cấp đó; riêng Cloudflare cần xác nhận về độ tuổi.
9. Bản THPT dùng Azure AI Speech: điều khoản Microsoft **không nói** về người dưới 18 — người lớn chủ
   tài khoản và nhà trường xác nhận có phù hợp không (mục 2c).
10. Phiếu đồng ý ghi rõ: giọng nói của học sinh được gửi tới dịch vụ nhận dạng cloud (tên dịch vụ),
    app không lưu bản ghi âm; phụ huynh/người giám sát đồng ý bật micro.
11. Bản chính dùng gói miễn phí Gemini: người dùng biết âm thanh có thể được Google dùng để cải thiện
    sản phẩm và có người nghe.
12. Âm thanh Gemini có thủy vân SynthID; giọng Azure phải được công bố là giọng tổng hợp — nhãn
    "Thầy/cô AI" trên màn hình có đủ không.
