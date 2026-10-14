# So sánh dịch vụ giọng nói cloud cho "Dạy học bằng AI" (PROMPT_PHAN_2 B6.0, giai đoạn T0)

> **Cập nhật 12/10/2026:** bản THPT đã bỏ, nên các lựa chọn "cho bản THPT" (Azure…) không còn cần.
> Hướng giọng nói hiện tại: Gemini TTS, giọng tiếng Việt của Windows, và giọng tiếng Việt chạy trên
> máy (người dùng đồng ý 12/10/2026, phải kiểm tra giấy phép trước).

> **Trạng thái: ĐỀ XUẤT, CHỜ NGƯỜI DÙNG DUYỆT.** Chưa có dòng mã giọng nói nào được viết.
>
> Ngày tra: **2026-10-06**. Nguồn là trang chính thức của nhà cung cấp, đọc qua công cụ tóm tắt
> trang web, nên một số câu trích có thể không đúng từng chữ. **Giá và tên model phải tra lại ngay
> trước khi làm T1/T5.** Mục ghi **CHƯA KIỂM CHỨNG** là chưa tìm được nguồn rõ ràng. Tài liệu này
> **không kết luận pháp lý**; các điểm cần xác nhận nằm ở `docs/LEGAL_COMPLIANCE.md` §2c và §6.
>
> Chất lượng giọng tiếng Việt **chưa được nghe thử**: muốn nghe thử phải có khóa của từng dịch vụ,
> và khóa do người dùng tự tạo và tự nhập. Mục 5 là cách nghe thử khi có khóa.

## 1. Thứ tự tiêu chí (theo B6.0)

1. Điều khoản phù hợp với bản build (bản THPT: **bắt buộc** cho phép ứng dụng có người dưới 18).
2. Quyền riêng tư: dữ liệu có bị lưu, bị dùng để huấn luyện không.
3. Chất lượng giọng tiếng Việt.
4. Khả năng đồng bộ: mốc thời gian từng từ, sự kiện khẩu hình (viseme), SSML.
5. Phát trực tiếp (streaming) và độ trễ; nhận dạng giọng nói có kết quả tạm thời và tự biết khi
   học sinh nói xong.
6. Chi phí cho một buổi học 30 phút.

**Giả định khi tính chi phí** (buổi 30 phút): thầy nói khoảng 20 phút (≈ 13 500 ký tự), học sinh nói
khoảng 5 phút. Micro chỉ mở khi học sinh nói (giữ-để-nói). Giá niêm yết bằng USD, chưa gồm chi phí
"bộ não" (LLM — tính ở T4).

## 2. Bản chính (sinh viên 18+, một khóa Gemini)

| Thành phần              | Model                                                         | Tiếng Việt                                  | Đồng bộ                                                                                         | Streaming                                                      | Giá trả phí                                                                                   | Nguồn                                                                                 |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Thầy nói (TTS)**      | `gemini-3.8-flash-tts` (GA), `gemini-3.8-flash-lite-tts` (GA) | Có (bảng ngôn ngữ ghi "Vietnamese")         | **Không có** mốc thời gian từng từ, không có viseme. Điều khiển giọng bằng lời mô tả phong cách | Có (`stream: true`, PCM 16-bit 24 kHz)                         | Flash: 9 USD / 1 triệu token âm thanh ra (đến 2026-12-31, sau đó 18 USD); 25 token / giây nói | ai.google.dev/gemini-api/docs/speech-generation (cập nhật 2026-10-01); …/docs/pricing |
| **Nghe học sinh (ASR)** | `gemini-3.5-transcribe-live` (qua Live API)                   | Có (`vi-VN`)                                | Kết quả tạm thời + kết quả cuối; mốc thời gian **theo câu**, không theo từ                      | Có (PCM 16 kHz)                                                | ≈ 0,005 USD / phút âm thanh                                                                   | ai.google.dev/gemini-api/docs/live-api/live-transcribe (cập nhật 2026-08-26)          |
| Hội thoại giọng nói     | `gemini-3.8-live` (Live API)                                  | Có (`vi` trong danh sách ngôn ngữ; tự nhận) | Có bản chữ hai chiều nhưng **không** gắn mốc từ; tự ngắt khi học sinh nói chen                  | Có, hai chiều; phiên âm thanh tối đa 15 phút, kết nối ~10 phút | ≈ 0,005 USD/phút vào + 0,018 USD/phút ra                                                      | ai.google.dev/gemini-api/docs/live-guide, …/live-session (cập nhật 2026-09-15/18)     |
| Ghi chép sau buổi       | `gemini-3.5-transcribe`                                       | Có                                          | Mốc thời gian **từng từ** (chỉ chạy theo lô, không trực tiếp)                                   | Không                                                          | 2 USD / 1 triệu token âm thanh vào                                                            | ai.google.dev/gemini-api/docs/transcribe (cập nhật 2026-09-23)                        |

Gói miễn phí: có cho các model trên (giới hạn lượt xem trong Google AI Studio — **CHƯA KIỂM CHỨNG**
con số). Với gói miễn phí, Google dùng nội dung gửi lên (kể cả âm thanh) để cải thiện sản phẩm và
người thật có thể đọc/nghe. Mọi âm thanh Gemini tạo ra có thủy vân **SynthID** (theo blog của
Google, 2026-09-23).

**Chi phí ước tính một buổi 30 phút (gói trả phí):** TTS 20 phút × 60 × 25 token × 9 USD/triệu ≈
**0,27 USD** (≈ 0,54 USD từ 2027) + ASR 5 phút ≈ **0,03 USD** → khoảng **0,30 USD** + chi phí LLM.

## 3. Bản THPT (học sinh dưới 18, khóa của người lớn)

| Dịch vụ                       | Người dưới 18 trong ứng dụng                                                                                                                                                                               | Dữ liệu                                                                                                                                   | Giọng vi-VN / đồng bộ                                                                                                                                             | Nhận dạng vi-VN                                                                                              | Chi phí 30 phút                          | Đánh giá                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| **Microsoft Azure AI Speech** | Điều khoản **không nói** (im lặng — không phải cho phép rõ ràng). Code of Conduct yêu cầu cho biết giọng là giọng tổng hợp.                                                                                | Trang quyền riêng tư Speech: nhận dạng thời gian thực không lưu dữ liệu; TTS không ghi văn bản/âm thanh vào log. Huấn luyện: **chưa nêu** | `vi-VN-HoaiMyNeural` (nữ), `vi-VN-NamMinhNeural` (nam); sự kiện **WordBoundary** (mốc từng từ); **Viseme ID** cho vi-VN (không có blend shape) — **cần kiểm lại** | Có, kết quả tạm thời, tự ngắt câu (100–5000 ms im lặng); danh sách cụm từ gợi ý (**cần kiểm lại** cho vi-VN) | ≈ 0,20 (TTS) + 0,08 (STT) = **0,29 USD** | **Đề xuất chính**                                            |
| Google Cloud TTS / STT        | Điều khoản dịch vụ (bản lưu 2026-02-18, §20(d)) cấm dịch vụ AI tạo sinh "có khả năng được dùng bởi" người dưới 18. TTS/STT xếp vào "Pre-Trained APIs", nhưng **chưa rõ** Chirp 3 có bị tính là AI tạo sinh | Không dùng dữ liệu để huấn luyện; STT mặc định không lưu                                                                                  | Chirp 3 HD có vi-VN; mốc thời gian `<mark>` **chưa rõ** có dùng được với Chirp 3 HD không                                                                         | `chirp_3` có vi-VN, chỉ đặt ở máy chủ Mỹ/châu Âu; kết quả tạm thời **CHƯA KIỂM CHỨNG**                       | ≈ 0,49 USD                               | Dự phòng **chỉ khi** Google xác nhận bằng văn bản về độ tuổi |
| ElevenLabs                    | Điều khoản: dưới 18 "may not use our Services"; chính sách quyền riêng tư cấm gửi dữ liệu giọng nói của người dưới 18 (các tài liệu của họ mâu thuẫn nhau)                                                 | Có thể dùng để cải thiện dịch vụ (tắt được)                                                                                               | Có tiếng Việt, mốc thời gian từng ký tự                                                                                                                           | Có                                                                                                           | ≈ 0,57 USD                               | **Loại** cho bản THPT                                        |
| Vbee (Việt Nam)               | Người dùng từ đủ 16 tuổi; dưới 16 cần cha mẹ đồng ý                                                                                                                                                        | Được dùng dữ liệu vào/ra để "cải tiến, phát triển sản phẩm"                                                                               | Giọng Việt tự nhiên; tối đa 300 ký tự/lần; không có mốc từ                                                                                                        | WebSocket (chi tiết **CHƯA KIỂM CHỨNG**)                                                                     | **CHƯA KIỂM CHỨNG**                      | Không đề xuất (dữ liệu học sinh dùng để phát triển sản phẩm) |
| FPT.AI                        | Trang điều khoản API trả lỗi 404 — **CHƯA KIỂM CHỨNG**                                                                                                                                                     | Website cam kết không dùng dữ liệu cá nhân huấn luyện AI (chưa rõ áp dụng cho API)                                                        | TTS bất đồng bộ, chờ 5 giây – 2 phút → **không dùng được** cho thời gian thực                                                                                     | Không thấy streaming                                                                                         | —                                        | Loại (không thời gian thực)                                  |
| Amazon Polly                  | —                                                                                                                                                                                                          | —                                                                                                                                         | **Không có tiếng Việt**                                                                                                                                           | Transcribe có vi-VN                                                                                          | —                                        | Loại                                                         |
| Viettel AI, Zalo AI, VAIS     | Không tìm thấy API công khai / điều khoản rõ                                                                                                                                                               | —                                                                                                                                         | —                                                                                                                                                                 | —                                                                                                            | —                                        | Chưa đủ thông tin                                            |

Gói miễn phí Azure (F0): 0,5 triệu ký tự TTS và 5 giờ STT mỗi tháng — đủ khoảng **35 buổi** 30 phút,
thường đủ cho một đợt thử nghiệm 5–10 học sinh.

## 4. Đề xuất (chờ duyệt)

### Bản chính — chỉ cần một khóa Gemini

- **Giảng có bảng:** pipeline TeachScript + `gemini-3.8-flash-tts` (streaming). Vì TTS **không trả
  mốc thời gian từng từ**, dùng cách đã ghi trong B6.1: **cắt lời tại các thẻ neo** (`<write>`,
  `<point>`, `<face>`…) và tổng hợp từng đoạn — thời điểm neo chính là ranh giới đoạn (chính xác
  tuyệt đối theo số mẫu âm thanh); bên trong đoạn ước lượng theo số âm tiết. Phong cách giọng điều
  khiển bằng lời mô tả (ví dụ "ấm áp, chậm rãi, như thầy giáo giảng bài").
- **Nghe học sinh:** `gemini-3.5-transcribe-live`, chỉ mở khi học sinh đang nói.
- **Live API (`gemini-3.8-live`):** chưa dùng cho phần giảng (không đồng bộ được với bảng). Sẽ **đo
  thử ở T5** cho đoạn trò chuyện/hỏi đáp nhanh không cần bảng, rồi báo lại.
- **Khẩu hình:** không có viseme → dùng phân tích âm thanh (năng lượng + dải tần, xử lý tín hiệu
  thuần) — đúng phương án dự phòng của B5.3.
- **Dự phòng:** giọng đọc tiếng Việt có sẵn của Windows qua Web Speech API (`speechSynthesis`) hoặc
  chỉ phụ đề. (Máy có giọng tiếng Việt hay không tùy gói ngôn ngữ đã cài — **CHƯA KIỂM CHỨNG** trên
  máy thử nghiệm.)
- **Cảnh báo gói miễn phí:** khi người dùng bật micro lần đầu, nói rõ âm thanh có thể được Google
  dùng để cải thiện sản phẩm và người thật có thể nghe.

### Bản THPT — Claude (bộ não) + Azure AI Speech (giọng nói)

- **Azure AI Speech** là dịch vụ duy nhất trong danh sách vừa có giọng vi-VN tự nhiên, mốc thời gian
  từng từ, viseme, nhận dạng trực tiếp có kết quả tạm thời, **và** điều khoản không cấm người
  dưới 18 tuổi. "Không cấm" **không** có nghĩa là "cho phép rõ ràng": người lớn chủ tài khoản và
  nhà trường phải xác nhận (LEGAL_COMPLIANCE §2c, §6).
- Khóa Azure do người giám sát nhập (khóa PIN) như khóa Claude; nằm trong kho khóa của hệ điều hành.
- **Vấn đề kỹ thuật cần duyệt:** Azure **không có SDK cho Rust**; sự kiện WordBoundary/viseme và kết
  quả tạm thời đi qua SDK (có SDK JavaScript). Đề xuất: Rust dùng khóa để xin **mã truy cập tạm thời**
  (hết hạn sau khoảng 10 phút) và chỉ đưa mã tạm thời đó cho SDK JavaScript trong app. **Khóa thật
  vẫn không bao giờ tới trang web.** Đây là thay đổi nhỏ so với quy tắc hiện tại ("trang web không
  thấy khóa") — mã tạm thời không phải là khóa, nhưng cần bạn đồng ý.
- **Dự phòng:** giọng Windows (Web Speech API) + học sinh trả lời bằng gõ phím/chọn đáp án.
- **Không** dùng Google Cloud cho học sinh cho đến khi Google xác nhận bằng văn bản về §20(d).

## 5. Cách nghe thử khi có khóa (làm ở đầu T1)

1. Người dùng tự tạo khóa (Gemini cho bản chính; Azure Speech cho bản THPT, do người lớn tạo).
2. Một trang thử nghiệm trong chế độ dev đọc 10 câu mẫu: số và đơn vị ("9,81 mét trên giây bình
   phương"), công thức ("căn bậc hai của hai h chia g"), hóa học ("H hai O", "C O hai"), câu hỏi, câu
   khen, câu có đủ 6 thanh.
3. Ghi lại: điểm tự nhiên 1–5, số lỗi thanh điệu, thời gian ra âm thanh đầu tiên (ms) — vào bảng
   dưới đây. Không ghi âm giọng học sinh.

| Dịch vụ / giọng          | Tự nhiên (1–5) | Lỗi thanh điệu / 10 câu | Âm thanh đầu tiên (ms) | Ghi chú |
| ------------------------ | -------------- | ----------------------- | ---------------------- | ------- |
| Gemini 3.8 Flash TTS     | _chưa đo_      | _chưa đo_               | _chưa đo_              |         |
| Azure HoaiMy             | _chưa đo_      | _chưa đo_               | _chưa đo_              |         |
| Azure NamMinh            | _chưa đo_      | _chưa đo_               | _chưa đo_              |         |
| Giọng Windows (dự phòng) | _chưa đo_      | _chưa đo_               | _chưa đo_              |         |

## 6. G6 — Giọng thầy tự nhiên hơn (14/10/2026)

Nguồn đo: `scripts/voice/tts-bench.mjs` (19 câu `src/teacher/voice/ttsBenchSet.json`: chào, khái
niệm mới, câu hỏi kiểm tra, sửa lỗi và động viên, đoạn dài, công thức/đơn vị, nguyên phân, phương
trình hóa học). Kết quả thô: `tests/voice/results/2026-10-14-tts-bench-cpu.json` (build 7b2c697).

### Nguyên nhân giọng MMS thiếu tự nhiên (đã kiểm chứng)

- Mô hình MMS-TTS tiếng Việt (VITS, CC BY-NC 4.0) không có điều khiển cao độ, cảm xúc hay SSML; bản
  ONNX đang dùng chỉ nhận chữ (tốc độ và độ biến thiên bị cố định khi xuất mô hình).
- Mô hình không thấy dấu câu: mọi ngắt nghỉ phải do app tạo bằng cách chia đoạn.
- Bản trước đổi tốc độ bằng `playbackRate` (làm lệch cao độ), mỗi đoạn có âm lượng khác nhau và
  khoảng lặng ở hai đầu không đều.

### Đã thay đổi (nhánh `feat/voice-natural`)

- Tách bước biên tập lời đọc khỏi bước tổng hợp: `speechPlan.ts` (bỏ thẻ/markdown, từ điển phát âm
  `pronunciations.json` mở rộng được, 42 mục chờ giáo viên duyệt, chia đoạn theo mệnh đề, không cắt
  giữa số và đơn vị, công thức, tên riêng; mỗi đoạn có khoảng nghỉ theo dấu câu).
- Ngữ điệu trong khả năng của MMS: tốc độ theo vai trò câu (khái niệm mới, bước giải, kết quả, câu
  hỏi, phản hồi) bằng co giãn thời gian giữ cao độ; nhấn ý chính bằng một quãng nghỉ ngắn trước thuật
  ngữ, không tăng âm lượng.
- Ghép âm thanh (`stitch.ts`): cắt khoảng lặng thừa, cùng mức âm lượng −20 dBFS, giới hạn đỉnh
  −1 dBFS, nhấc/hạ tiếng 8–12 ms ở mép đoạn, chèn đúng khoảng nghỉ đã lên kế hoạch.
- Phát dần từng đoạn (render trước một đoạn), đúng thứ tự, bài cũ không còn phát sau khi đổi bài,
  "Tiếp tục" dùng lại đoạn đã render.
- Sửa 23 lỗi rà soát (bài giảng dừng sau câu đầu khi bật giọng, "MeV" đọc thành "mol trên lít",
  giọng trên máy có thể nạp lại vào card vừa lỗi, …).

### Kết quả đo (CPU, WASM, Edge, 19 câu; trung vị)

| Chỉ số                                | MMS hiện tại (cách chia cũ) | MMS cải tiến    |
| ------------------------------------- | --------------------------- | --------------- |
| Câu lỗi / NaN / mất, thừa, đảo từ     | 0 / 0 / 0                   | 0 / 0 / 0       |
| Tiếng đầu tiên                        | 4,07 s                      | 3,22 s          |
| Chênh âm lượng giữa các đoạn          | 2,47 dB                     | 0 dB            |
| Đỉnh biên độ (không vỡ tiếng)         | 0,84                        | 0,71            |
| Mật độ lời (âm tiết/giây)             | 2,64                        | 3,00            |
| Hệ số thời gian thực (tổng hợp / lời) | 2,01                        | 2,00            |
| Thời gian chờ giữa các đoạn (mỗi câu) | 7,3 s                       | 8,4 s           |
| CPU của Edge / RAM đỉnh               | 15,5 s / 906 MB             | 16,3 s / 908 MB |

- Trên CPU, MMS tổng hợp chậm khoảng 2 lần so với thời gian nói, nên **cả hai cách đều có quãng chờ
  dài** giữa các đoạn; cải tiến không làm mô hình nhanh hơn. Trên card rời NVIDIA (WebGPU, đo
  13–14/10) MMS cần khoảng 0,05–0,3 s cho 3,5–5 s âm thanh, nên không có quãng chờ. App chỉ dùng
  WebGPU cho giọng khi xác nhận được card rời; card tích hợp hoặc sau lỗi card luôn dùng CPU.
- Các số trên là kiểm tra tự động (lỗi từ, âm lượng, độ trễ, tài nguyên). **Chưa có người nghe chấm
  độ tự nhiên, ngữ điệu và phát âm.** Gói nghe thử mù A/B (19 cặp WAV, thứ tự A/B trộn theo từng
  câu) đã tạo, đặt ngoài repo; khóa A/B giữ riêng.

### Giới hạn và bước tiếp theo

- Không thể có ngữ điệu, cảm xúc thật với MMS hiện tại. Phương án thay thế (nghiên cứu, chưa tải):
  Supertonic 3 (ONNX chạy trong WebView2, OpenRAIL-M, dự án đã ngừng phát triển, ~130–400 MB) và
  VieNeu-TTS (Apache-2.0, giọng Việt ba miền, chưa chạy được trong trình duyệt: cần tiến trình phụ).
  Thêm mô hình trên máy cần chủ dự án đồng ý (CLAUDE.md) và kiểm tra giấy phép.
- Gemini TTS (cloud) có điều khiển phong cách tốt nhất nhưng chưa thử được (không có khóa).
- Cần người nghe thành thạo tiếng Việt chấm gói A/B và các cách đọc chờ duyệt (DATA_REVIEW).
