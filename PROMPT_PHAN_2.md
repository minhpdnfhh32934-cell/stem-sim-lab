# PROMPT TIẾP THEO (Phần 2) — Cập nhật & mở rộng dự án STEM Sim Lab

> **Cách dùng:** Lưu file này vào thư mục dự án với tên `PROMPT_PHAN_2.md` (cạnh `MASTER_PROMPT.md` đang dùng). Trong Claude Code (tiếp tục phiên cũ hoặc mở phiên mới đều được), gõ:
> `Đọc PROMPT_PHAN_2.md — đây là phần tiếp theo của MASTER_PROMPT.md. Làm đúng Bước 0 trước.`

---

## Bước 0 — Bối cảnh & việc cần làm đầu tiên

Đây **không phải dự án mới**. File này là **phần tiếp theo của `MASTER_PROMPT.md`** mà bạn đang thực hiện, gồm:

- **Phần A — Thay đổi yêu cầu** so với `MASTER_PROMPT.md` (đối tượng người dùng, lớp AI, an toàn, giao diện, lộ trình).
- **Phần B — Tính năng mới "Dạy học bằng AI"** (AI Teacher).

**Thứ tự ưu tiên:** khi `PROMPT_PHAN_2.md` mâu thuẫn với `MASTER_PROMPT.md`, **làm theo `PROMPT_PHAN_2.md`**. Những mục của `MASTER_PROMPT.md` không được nhắc tới ở đây vẫn giữ nguyên hiệu lực — đặc biệt **Mục 2 (Nguyên tắc tối thượng về toàn vẹn khoa học)** không thay đổi.

**Trước khi viết thêm code, hãy:**

1. Kiểm tra trạng thái dự án hiện tại: đã xong những giai đoạn nào (Mục 9 của `MASTER_PROMPT.md`), test đang pass/fail ra sao.
2. Liệt kê **phần code/cấu hình đã viết bị ảnh hưởng** bởi Phần A (ví dụ: client LM Studio, phần phát hiện LM Studio, cài đặt chọn model local, các màn hình đã làm theo giao diện cũ…).
3. Đề xuất **kế hoạch chuyển đổi** ngắn gọn (sửa gì, xóa gì, thêm gì, theo thứ tự nào) và cách lồng các giai đoạn của Phần B vào lộ trình.
4. Cập nhật `CLAUDE.md`: thêm tóm tắt các quy tắc mới (Mục A8) và ghi chú "PROMPT_PHAN_2.md được ưu tiên khi mâu thuẫn với MASTER_PROMPT.md".
5. **Dừng lại, báo cáo cho tôi và chờ tôi duyệt** kế hoạch rồi mới làm.

---

# PHẦN A — THAY ĐỔI SO VỚI MASTER_PROMPT.md

## A1. Đối tượng người dùng _(thay đoạn "Người dùng mục tiêu" ở Mục 0)_

**Đối tượng sử dụng chính: sinh viên từ 18 tuổi trở lên** (đặc biệt sinh viên năm nhất học các môn đại cương và người ôn lại kiến thức nền). Người dùng tự nhập **API key Gemini** của mình để dùng các tính năng AI.

**Đối tượng thử nghiệm: học sinh THPT** (phần lớn dưới 18 tuổi), tham gia các buổi thử nghiệm có người lớn giám sát và có sự đồng ý của phụ huynh/nhà trường. Vì điều khoản Gemini API không cho phép người dưới 18 tuổi sử dụng, thử nghiệm với học sinh dùng một **bản build thử nghiệm riêng không có Gemini** (Mục A2 và A3).

Người dùng phụ: giáo viên/người giám sát thử nghiệm (duyệt dữ liệu, trình chiếu, quản lý cài đặt) và giám khảo. Ngôn ngữ giao diện chính: **tiếng Việt** (có sẵn cấu trúc i18n để thêm tiếng Anh). Tôi phát triển trên **Windows**; máy của học sinh thường là laptop phổ thông, nên app **không được** giả định máy mạnh.

## A2. Lớp AI: bỏ AI local, dùng Gemini + Claude qua cloud _(thay toàn bộ Mục 3.1; sửa bảng công nghệ ở Mục 3 và đoạn "Quá tải phía AI" ở Mục 5)_

**Gỡ bỏ hoàn toàn** mọi thứ liên quan đến AI chạy trên máy: client LM Studio (`localhost:1234`), phần tự phát hiện LM Studio, cài đặt chọn model local, hướng dẫn cài LM Studio. Không dùng Ollama hay bất kỳ mô hình nào chạy trên máy.

**Bảng công nghệ (Mục 3)** — thêm/sửa dòng:

| Lớp | Công nghệ                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI  | **Gemini API** (bản chính, người dùng ≥ 18 tuổi tự nhập key) + **Claude API** (chỉ trong bản thử nghiệm với học sinh THPT) — **không dùng AI local** |

**Lớp AI mới (thay Mục 3.1):**

- **Thiết kế cắm-rút:** toàn bộ lời gọi AI đi qua interface `AIProvider` trong backend Rust, có 2 bản cài đặt: `GeminiProvider` và `ClaudeProvider`. Phần còn lại của app không biết đang dùng nhà cung cấp nào.
- **Hai bản build (bật/tắt lúc biên dịch bằng Cargo feature + biến môi trường Vite):**
  | Bản build                                 | Người dùng                                      | Nhà cung cấp AI                                                                         | Ghi chú                                                                                                |
  | ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | **Bản chính** (`edition=main`)            | Sinh viên ≥ 18 tuổi                             | **Gemini** (mặc định, người dùng tự nhập key); Claude là tùy chọn nếu người dùng có key | Xác nhận đủ 18 tuổi khi mở app lần đầu                                                                 |
  | **Bản thử nghiệm THPT** (`edition=pilot`) | Học sinh THPT trong buổi thử nghiệm có giám sát | **Chỉ Claude** — mã `GeminiProvider` **không được biên dịch vào** bản này               | Key do người lớn giám sát nhập (khóa PIN); áp dụng đầy đủ biện pháp an toàn cho người dưới 18 (Mục A3) |
  - Lý do: điều khoản Gemini API yêu cầu người dùng **từ 18 tuổi** và cấm dùng trong ứng dụng hướng tới hoặc có khả năng được người dưới 18 tuổi sử dụng; chính sách của Anthropic cho phép phục vụ người dưới 18 nếu có biện pháp an toàn. Tách bản build giúp Gemini không bao giờ chạy trong phiên của học sinh. Trước khi phát hành, đọc lại điều khoản hiện hành của cả hai nhà cung cấp, ghi tóm tắt + trích dẫn vào `docs/LEGAL_COMPLIANCE.md`, điểm nào chưa rõ thì báo tôi.
- **Gemini (bản chính):**
  - Tra tài liệu chính thức (ai.google.dev) để chọn model hiện hành; mặc định model nhanh, chi phí thấp cho đọc đề. **Không hard-code tên model** — để trong file cấu hình, người dùng đổi được trong Cài đặt.
  - Ép đúng định dạng bằng **structured output (`responseMimeType: application/json` + JSON schema)** hoặc function calling; dùng **context caching** cho system prompt dài nếu có lợi.
  - Hiển thị cảnh báo rõ ràng: _"Nếu bạn dùng gói miễn phí của Gemini API, Google có thể dùng nội dung bạn gửi để cải thiện sản phẩm. Không gửi thông tin cá nhân hoặc nhạy cảm."_
- **Claude (bản thử nghiệm, và tùy chọn ở bản chính):** chọn model hiện hành theo docs.claude.com; ép định dạng bằng tool use với `input_schema` (hoặc structured outputs); dùng prompt caching.
- **Ô nhập API key — màn hình "Kết nối AI"** (trong Cài đặt, và là một bước có thể bỏ qua trong onboarding bản chính):
  - Chọn nhà cung cấp (Gemini mặc định) → ô nhập key dạng **mật khẩu** (ẩn ký tự, nút hiện/ẩn, dán bằng Ctrl+V).
  - Nút **"Kiểm tra key"**: gọi một yêu cầu rất nhỏ để xác minh, hiển thị kết quả rõ ràng (_Kết nối thành công_ / _Key không hợp lệ_ / _Hết hạn mức_ / _Không có mạng_).
  - Liên kết **"Cách lấy API key Gemini"** mở hướng dẫn từng bước có ảnh minh họa (tạo key trong Google AI Studio), kèm lưu ý về gói miễn phí và giới hạn tần suất.
  - Sau khi lưu chỉ hiện 4 ký tự cuối (`••••••••abcd`); nút **Xóa key**; trạng thái kết nối hiển thị ở thanh trên.
  - Key lưu trong **keychain của hệ điều hành** qua backend Rust — không lưu plaintext, không ghi log, không gửi đi đâu ngoài máy chủ của chính nhà cung cấp.
  - Chưa nhập key → app vẫn dùng đầy đủ mô phỏng, bài mẫu, "Tự dựng cảnh"; nút AI hiện gợi ý _"Kết nối AI để dùng tính năng này"_.
- **Bản thử nghiệm:** màn hình "Kết nối AI" nằm trong **chế độ người giám sát (khóa PIN)**; học sinh không thấy và không nhập key.
- **Phát hành rộng sau này:** không bao giờ nhúng key của nhóm dự án vào bộ cài; bản chính dùng mô hình "người dùng tự mang key".
- Mọi lời gọi AI có timeout, hủy được, retry giới hạn với backoff khi gặp lỗi 429/5xx, và **giới hạn chi phí** (số lượt/ngày có thể cấu hình).
- **Không có mạng vẫn học được**: toàn bộ mô phỏng, chế độ **"Tự dựng cảnh"** (kéo thả vật thể, nhập thông số bằng form) và **thư viện bài mẫu** chạy offline. Khi mất mạng, app báo nhẹ nhàng _"Tính năng đọc đề bằng AI cần Internet — bạn vẫn có thể chọn bài mẫu hoặc tự dựng cảnh"_.
- Pipeline: `Đề bài → AI → JSON → Zod validate → kiểm tra nhất quán vật lý (đơn vị, dấu, miền giá trị) → bảng xác nhận → engine`. JSON sai → gửi lại lỗi cho AI tối đa 2 lần → nếu vẫn sai thì mở form cho người dùng tự điền.

**Thư mục (Mục 3.3)** — sửa/thêm:

```
src/
  ai/             # AIProvider (GeminiProvider, ClaudeProvider), màn hình Kết nối AI, prompt, schema, pipeline
  safety/         # cổng độ tuổi, đồng ý của phụ huynh (bản pilot), kiểm duyệt nội dung, thông báo AI
  learn/          # lộ trình theo trình độ/chủ đề, thử thách, tiến độ học
  teacher/        # tính năng "Dạy học bằng AI" (Phần B)
```

**Quá tải phía AI (thay đoạn cũ ở Mục 5):** timeout (mặc định 30 s, chỉnh được), nút hủy, hàng đợi yêu cầu; gặp giới hạn tần suất (429) hoặc lỗi máy chủ → retry với backoff tăng dần, tối đa 3 lần; đề quá dài/phức tạp → tách thành các phần; hết hạn mức trong ngày hoặc mất mạng → thông báo thân thiện và gợi ý chế độ "Tự dựng cảnh" / bài mẫu. Cache kết quả đọc đề đã xác nhận để không gọi lại API cho cùng một đề.

## A3. An toàn, quyền riêng tư & tuân thủ _(mục mới — thêm vào sau Mục 3.3)_

**Bản chính (sinh viên ≥ 18 tuổi):**

- Lần đầu mở app: người dùng **xác nhận đủ 18 tuổi** và đồng ý Điều khoản sử dụng của app (trong đó nêu rõ app dành cho người từ 18 tuổi và việc dùng Gemini API theo điều khoản của Google). Người chưa đủ 18 tuổi → app thông báo nhẹ nhàng rằng tính năng AI không dành cho họ; phần mô phỏng offline vẫn dùng được, nhưng **không cho nhập key Gemini**.
- Ghi rõ nội dung nào do AI tạo; kiểm duyệt nội dung cơ bản; trang Quyền riêng tư nói rõ dữ liệu nào được gửi tới Google/Anthropic.

**Bản thử nghiệm THPT (người dùng dưới 18 tuổi)** — bắt buộc đầy đủ, theo chính sách của Anthropic cho tổ chức phục vụ người chưa thành niên:

- **Cổng độ tuổi khi mở app lần đầu:** hỏi năm sinh (hoặc lớp). Dưới 18 tuổi → cần **xác nhận đồng ý của phụ huynh/giáo viên** (màn hình riêng cho người lớn, nhập PIN) trước khi bật tính năng AI. Phần mô phỏng offline dùng được ngay không cần AI.
- **Minh bạch là AI:** mọi nơi có AI đều ghi rõ _"Nội dung do AI hỗ trợ"_; học sinh luôn biết mình đang tương tác với AI, không phải con người.
- **Kiểm duyệt nội dung hai chiều:** lọc đầu vào của học sinh và đầu ra của AI (nội dung không phù hợp lứa tuổi, nội dung nguy hiểm); system prompt quy định rõ phạm vi giáo dục và giọng điệu phù hợp học sinh. Nội dung bị chặn → thông báo thân thiện, không phán xét.
- **Giám sát & báo cáo:** nhật ký sự cố an toàn (chỉ ghi loại sự cố, không ghi nội dung riêng tư) để giáo viên/nhóm dự án xem; có nút **"Báo cáo nội dung không phù hợp"**.
- **Dữ liệu tối thiểu:** không yêu cầu họ tên thật, email hay số điện thoại để dùng app; chỉ gửi lên API phần nội dung cần thiết (đề bài), không kèm thông tin cá nhân. Ghi rõ trong **trang Quyền riêng tư** (viết bằng ngôn ngữ học sinh hiểu được) dữ liệu nào được gửi đi đâu.
- **Tuân thủ pháp luật:** kiểm tra và ghi trong `docs/LEGAL_COMPLIANCE.md` các quy định bảo vệ dữ liệu cá nhân và bảo vệ trẻ em hiện hành của Việt Nam, cùng điều khoản/chính sách sử dụng của Anthropic dành cho tổ chức phục vụ người chưa thành niên. Không tự kết luận pháp lý thay tôi — liệt kê điểm cần tôi/giáo viên xác nhận.
- **Tài nguyên học an toàn:** trang hướng dẫn ngắn "Dùng AI để học cho hiệu quả và an toàn" dành cho học sinh.
- **Quy trình thử nghiệm:** chỉ cài bản pilot trên máy dùng cho buổi thử nghiệm; có phiếu đồng ý của phụ huynh và sự cho phép của nhà trường; luôn có người lớn giám sát. Soạn sẵn mẫu phiếu đồng ý (ngắn, dễ hiểu) trong `docs/PILOT_CONSENT.md`.

**Kiểm tra tự động:** test đảm bảo bản pilot **không chứa** `GeminiProvider` (kiểm tra ở bước build) và bản chính **không cho lưu key Gemini** khi người dùng chưa xác nhận đủ 18 tuổi.

## A4. Giao diện cho người học _(thay toàn bộ Mục 7)_

Người dùng chính là **sinh viên (≥ 18 tuổi)**; học sinh THPT dùng trong các buổi thử nghiệm. Giao diện phải **thân thiện, dễ hiểu nhưng trưởng thành** — không trẻ con hóa, cũng không khô cứng như phần mềm kỹ thuật.

#### A4.1. Nguyên tắc thiết kế

- **Mở app là biết làm gì trong 10 giây đầu.** Mỗi màn hình chỉ có **một hành động chính** nổi bật; tính năng nâng cao được ẩn và mở dần (progressive disclosure).
- **Hai chế độ hiển thị:** _Cơ bản_ (mặc định — ẩn panel phức tạp, chỉ giữ thông số quan trọng) và _Nâng cao_ (cho người muốn đào sâu: inspector đầy đủ, dữ liệu số, nhiều đồ thị).
- **Ngôn ngữ thân thiện, ngắn gọn, tôn trọng người học.** Không hiện thuật ngữ phần mềm trong luồng học ("SceneSpec", "LLM", "token", "JSON"); chỉ màn hình "Kết nối AI" mới nói về API key, và nói bằng lời dễ hiểu. Lỗi được diễn đạt như lời bạn học: _"Mình chưa rõ khối lượng của vật trong đề — bạn ghi thêm giúp mình nhé"_.
- **Tổ chức nội dung theo trình độ:** **Trình độ → Môn → Chủ đề → Bài**, gồm hai trình độ:
  - _Nền tảng_ — tương đương chương trình THPT (GDPT 2018); dùng để ôn lại kiến thức gốc và cho các buổi thử nghiệm với học sinh. **MVP tập trung vào trình độ này.**
  - _Đại cương_ — các môn đại cương năm nhất (Vật lý/Hóa/Sinh đại cương); mở rộng ở giai đoạn sau.
  - Việc ánh xạ bài với chương trình/sách cụ thể không được tự bịa — để `review_status: "pending"` cho giáo viên/giảng viên duyệt.
- **Học bằng khám phá, không chỉ xem:** mỗi mô phỏng có
  - **"Dự đoán trước"** (chọn/ghi dự đoán → chạy mô phỏng → so sánh → giải thích), theo phương pháp _Dự đoán – Quan sát – Giải thích_;
  - **"Thử thách nhỏ"** (ví dụ: _"Chỉnh góc ném để vật bay xa nhất"_) có phản hồi tức thì.
- **Hỗ trợ làm bài có trách nhiệm:** khi người học nhập đề bài tập, app ưu tiên **gợi ý từng bước** (Gợi ý 1 → Gợi ý 2 → Lời giải đầy đủ); có nút xem lời giải ngay cho người cần đối chiếu, nhưng mặc định khuyến khích tự thử trước.
- **Động lực lành mạnh:** thanh tiến độ theo chủ đề, huy hiệu khi hoàn thành, lời khen cụ thể. **Không dùng** chuỗi ngày (streak) gây áp lực, bảng xếp hạng so sánh, thông báo dồn dập hay cơ chế gây nghiện. Nhắc nghỉ mắt sau ~45 phút liên tục.
- **Hợp với máy của người học:** chạy tốt ở **1366×768** không cuộn ngang; vùng bấm **≥ 40 px**; hỗ trợ **màn hình cảm ứng/bút** (laptop 2-in-1): kéo, chụm để zoom, xoay phân tử bằng hai ngón; dùng được khi mạng yếu.
- **Khả năng tiếp cận:** chỉnh cỡ chữ, chế độ tương phản cao, tùy chọn font dễ đọc, thông tin không chỉ truyền đạt bằng màu, điều khiển được bằng bàn phím, tôn trọng "giảm chuyển động".

#### A4.2. Các màn hình chính

- **Trang chủ "Hôm nay học gì?":** nút lớn _Tiếp tục bài đang học_; ô **"Nhập đề bài hoặc câu hỏi…"** ở trung tâm (dán nhiều dòng); 3 thẻ môn học lớn (Vật lý · Hóa học · Sinh học) có minh họa; chủ đề gợi ý theo trình độ; lối vào **"Dạy học bằng AI"**; chỉ báo nhỏ trạng thái AI ở góc (_Đã kết nối Gemini_ / _Chưa kết nối_ / _Ngoại tuyến_).
- **Onboarding lần đầu (≤ 5 bước, bản chính):** chọn trình độ → chọn môn quan tâm → **xác nhận đủ 18 tuổi + điều khoản** (Mục A3) → **Kết nối AI: nhập API key Gemini** (có nút _Để sau_) → tour 30 giây có thể bỏ qua.
- **Onboarding bản thử nghiệm THPT:** chọn môn → cổng độ tuổi/đồng ý của phụ huynh (người giám sát nhập PIN) → tour. Không có bước nhập key.
- **Màn hình "Kết nối AI"** (Cài đặt → Kết nối AI; đặc tả chi tiết ở Mục A2): chọn nhà cung cấp, ô nhập key dạng mật khẩu, nút _Kiểm tra key_, hướng dẫn lấy key Gemini có ảnh minh họa, cảnh báo về gói miễn phí, nút _Xóa key_.
- **Màn hình mô phỏng (chế độ Cơ bản):**
  - Trung tâm: khung mô phỏng chiếm phần lớn màn hình; thanh công cụ nổi chỉ gồm công cụ cần cho bài (kéo, đo, hiện vectơ, camera).
  - Dưới: nút **Chạy/Dừng** lớn, Làm lại, tua từng bước, tốc độ (×0,25–×2).
  - Phải (thu gọn được): 3–5 thanh trượt thông số quan trọng nhất có nhãn tiếng Việt + đơn vị; nút mở **Thẻ Khoa học** viết bằng lời dễ hiểu.
  - Thẻ dưới: _Đồ thị_ · _Lời giải từng bước_ · _Thử thách_.
  - Chế độ Nâng cao mở thêm: Inspector đầy đủ, nhiều đồ thị, dữ liệu số, xuất CSV.
- **Bảng xác nhận đề bài** dạng thẻ trực quan: mỗi đại lượng là một ô có biểu tượng, giá trị, đơn vị, sửa trực tiếp được; giá trị mặc định (như g) có nhãn _"giá trị mặc định"_.
- **Chế độ người giám sát (khóa PIN, bản pilot) / mục Quản trị (bản chính):** duyệt dữ liệu khoa học, **chế độ Trình chiếu** (toàn màn hình, chữ to, ẩn panel phụ — dùng trên lớp và khi chấm thi); ở bản pilot thêm: nhập key Claude, xem nhật ký an toàn, tiến độ học sinh (chỉ khi có đồng ý).

#### A4.3. Phong cách

- **Hiện đại, tươi sáng nhưng trưởng thành:** mỗi môn một màu chủ đạo (dùng nhất quán ở thẻ, tiêu đề, điểm nhấn), nền sạch để mô phỏng nổi bật; minh họa vector tối giản cho trang chủ và trạng thái trống.
- **Dark mode & light mode**; bảng màu đồ thị thân thiện với người mù màu.
- Icon dạng nét (Lucide) có micro-animation tinh tế; **không dùng emoji màu** trong UI; chuyển cảnh mượt, ngắn (150–300 ms), không lòe loẹt.
- Chữ dễ đọc, hỗ trợ đầy đủ tiếng Việt có dấu; cỡ chữ nội dung tối thiểu 15–16 px.
- Phản hồi vi mô khi hoàn thành thử thách (hoạt ảnh nhẹ), không gây xao nhãng khi đang học.
- **Tooltip** cho mọi nút; phím tắt (Space = chạy/dừng, R = làm lại, Ctrl+Z/Ctrl+Y…).

#### A4.4. Tính năng tiện ích

Undo/Redo, lưu/mở file `.stemsim`, xuất ảnh PNG (dán vào vở/báo cáo), xuất dữ liệu CSV (chế độ Nâng cao), trang **"Nguồn & Giả định"** tổng hợp mọi nguồn dữ liệu (rất có giá trị khi trình bày với giám khảo).

#### A4.5. Kiểm chứng với người học thật

Hướng dẫn tôi tổ chức thử nghiệm ở mỗi mốc lớn với **hai nhóm**:

- **Học sinh THPT (5–10 em, dùng bản pilot, có phiếu đồng ý — Mục A3):** kiểm tra độ dễ hiểu của mô phỏng và giao diện ở trình độ _Nền tảng_.
- **Sinh viên (5–10 bạn, dùng bản chính với key Gemini của mình):** kiểm tra toàn bộ luồng, gồm onboarding và nhập key.
  Giao nhiệm vụ (ví dụ "mô phỏng bài ném xiên"), quan sát chỗ vướng, đo thời gian hoàn thành, phiếu khảo sát ngắn (thang SUS rút gọn + câu hỏi mở). Ghi kết quả vào `docs/USER_TESTING.md` — đây là bằng chứng mạnh cho hồ sơ dự thi.

## A5. Hiệu năng _(sửa Mục 4.2)_

- RAM của app **< 300MB** khi chạy cảnh thường — không còn mô hình AI nào chạy trên máy, nên bỏ ngoại lệ "không tính LLM".
- Lời gọi AI dùng ít băng thông, chạy tốt với wifi trường/4G; mọi thao tác chờ mạng có trạng thái tải rõ ràng và không khóa giao diện.

## A6. Kiểm thử bổ sung _(thêm vào Mục 8)_

- **Golden test set:** chạy với **cả Gemini và Claude** để đo và so sánh tỉ lệ trích xuất đúng (thay cho "chạy với LLM local"); CI dùng phản hồi ghi sẵn (mock) để không tốn phí API.
- **An toàn:** test cổng độ tuổi (cả hai bản build), kiểm duyệt nội dung, không gửi thông tin cá nhân lên API, và **bản pilot không chứa mã Gemini** (kiểm tra ở bước build).
- **Kết nối AI:** test màn hình nhập key (hợp lệ / không hợp lệ / hết hạn mức / mất mạng); key không bao giờ xuất hiện trong log hay file cấu hình thường.

## A7. Lộ trình cập nhật _(sửa Mục 9)_

- **Nếu đã xong giai đoạn 3 (lớp AI cũ):** thêm **giai đoạn chuyển đổi "3b"** ngay sau giai đoạn đang làm: gỡ AI local → `AIProvider` (Gemini + Claude) → màn hình Kết nối AI → hai bản build → an toàn & tuân thủ (A3) → làm lại giao diện theo A4 cho các màn hình đã có. Tiêu chí hoàn thành: toàn bộ test cũ + test mới (A6) pass; app chạy được khi chưa nhập key và khi mất mạng.
- **Nếu chưa tới giai đoạn 3:** làm lại giao diện đã có theo A4 (nếu cần), rồi sửa nội dung các giai đoạn còn lại:

  | GĐ    | Nội dung cập nhật                                                                                                                                                                          |
  | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | **0** | Thêm: design system theo A4, trang chủ, onboarding, cấu hình **hai bản build** (main/pilot)                                                                                                |
  | **3** | Thay bằng: `AIProvider` (Gemini + Claude), **màn hình Kết nối AI (ô nhập key Gemini)**, keychain, SceneSpec, bảng xác nhận, "Tự dựng cảnh", an toàn & tuân thủ (A3), `LEGAL_COMPLIANCE.md` |
  | **6** | Thêm: thử thách & tiến độ học, thử nghiệm với học sinh THPT và sinh viên (A4.5)                                                                                                            |
  | **7** | Đóng gói **hai bộ cài** (bản chính & bản pilot), hướng dẫn sử dụng gồm cách lấy key Gemini                                                                                                 |

- **Tính năng "Dạy học bằng AI" (Phần B)** có lộ trình riêng T0–T8 (Mục B12). Bắt đầu T0 **sau khi lớp AI mới (GĐ 3 hoặc 3b) hoàn thành**; đề xuất cho tôi cách xen kẽ với GĐ 4–8.

## A8. Quy tắc làm việc bổ sung _(thêm vào Mục 10)_

9. **Không dùng AI chạy local** dưới bất kỳ hình thức nào; mọi tính năng AI đi qua `AIProvider` (Gemini ở bản chính, Claude ở bản pilot). **Không bao giờ để mã Gemini có trong bản pilot.** Không commit API key vào git (dùng `.env` trong `.gitignore` khi phát triển).
10. Khi thiết kế bất kỳ màn hình nào, tự hỏi: _"Một sinh viên năm nhất — hoặc một học sinh THPT trong buổi thử nghiệm — lần đầu dùng có hiểu ngay không?"_ — nếu không, đơn giản hóa.

---

# PHẦN B — TÍNH NĂNG MỚI: "DẠY HỌC BẰNG AI" (AI TEACHER)

## B0. Bối cảnh & vai trò

Bạn tiếp tục là kỹ sư chính của **STEM Sim Lab**. Mọi quy định trong `MASTER_PROMPT.md` và **Phần A** vẫn có hiệu lực, **đặc biệt là Mục 2 của `MASTER_PROMPT.md` – Nguyên tắc tối thượng về toàn vẹn khoa học**. File này mô tả một tính năng mới, **tách biệt hoàn toàn với khu vực mô phỏng**: một màn hình/route riêng tên **"Dạy học bằng AI"**.

Bạn đóng vai thêm: chuyên gia **real-time interactive media** (audio, animation, đồng bộ), **xử lý tiếng nói tiếng Việt** (ASR/TTS), và **thiết kế sư phạm** (learning science).

**Đối tượng sử dụng chính: sinh viên từ 18 tuổi**, tự nhập **API key Gemini** của mình. **Đối tượng thử nghiệm: học sinh THPT** (phần lớn dưới 18 tuổi) trong các buổi có giám sát, dùng **bản pilot không có Gemini**. Giao diện, giọng điệu, an toàn và quyền riêng tư phải phù hợp cả hai nhóm (Mục B1 và B4).

**Không dùng AI local.** Mọi thành phần AI chạy qua **API cloud**, qua `AIProvider` và hai bản build ở Phần A (Mục A2 và A3):

- **Bản chính (sinh viên ≥ 18):** bộ não giảng dạy dùng **Gemini API** bằng key người dùng nhập ở màn hình "Kết nối AI". Một key Gemini có thể dùng luôn cho giọng nói (TTS) và nghe (ASR/hiểu âm thanh) nếu đạt yêu cầu ở Mục B6.0 — người dùng chỉ cần nhập **một** key.
- **Bản pilot (học sinh THPT):** bộ não dùng **Claude API**; giọng nói dùng dịch vụ tiếng nói cloud có điều khoản cho phép người dùng dưới 18 tuổi; key do người giám sát nhập (khóa PIN). Mã Gemini không có trong bản này.

**Mục tiêu trải nghiệm duy nhất:** người học cảm thấy _"mình đang thực sự học với một người thầy qua lớp học online"_.
**Không được tạo cảm giác:** chatbot đọc văn bản · avatar AI đọc thoại · video bài giảng dựng sẵn · slide PowerPoint tự động · bảng trắng chỉ hiện đáp án.

AI Teacher phải **nói – nghe – nhìn – biểu cảm – viết – giải thích – phản hồi – tương tác** trong cùng một phiên học, theo thời gian thực.

---

## B1. Nguyên tắc riêng cho AI Teacher (bắt buộc)

1. **Đúng kiến thức trước, hay sau.** Mọi con số, kết quả tính toán, phương trình phản ứng mà thầy nói hoặc viết lên bảng phải đến từ **công cụ tất định** (engine vật lý, CAS, cơ sở dữ liệu hóa học đã kiểm chứng của app) hoặc từ đề bài — không lấy từ "trí nhớ" của LLM. Khi không chắc, thầy nói thật: _"Phần này thầy chưa chắc chắn, mình kiểm tra lại nhé"_ thay vì bịa.
2. **Minh bạch là AI.** Nhân vật là một **người thầy AI có tính cách riêng, do dự án tự thiết kế** (không mô phỏng người thật nào). Nếu học sinh hỏi "thầy có phải người thật không?", thầy trả lời trung thực.
3. **Ấm áp nhưng có ranh giới.** Thầy quan tâm, động viên, trò chuyện ngắn về chuyện đời thường, rồi nhẹ nhàng quay lại bài. Thầy **không** đóng vai người yêu/bạn thân thay thế, không khuyến khích phụ thuộc cảm xúc, không giữ học sinh ngồi học quá lâu (gợi ý nghỉ sau ~45 phút).
4. **An toàn cho người học (bắt buộc ở cả hai bản; đặc biệt nghiêm ngặt ở bản pilot vì người dùng chưa thành niên).** Nếu người học bộc lộ dấu hiệu khủng hoảng nghiêm trọng (muốn tự làm hại bản thân, bị bạo lực, bị xâm hại…): thầy dừng bài, phản hồi bằng sự quan tâm thật lòng, không phán xét, **khuyến khích nói chuyện ngay với người tin cậy** (gia đình, thầy cô, bạn bè, chuyên gia) và hiển thị thẻ hỗ trợ: bản pilot (người dưới 18) có **Tổng đài quốc gia bảo vệ trẻ em 111** (miễn phí, 24/7); bản chính có các đường dây hỗ trợ khủng hoảng/sức khỏe tinh thần hiện hành ở Việt Nam — bạn **tra cứu và xác minh số điện thoại trước khi đưa vào**, ghi nguồn trong `LEGAL_COMPLIANCE.md`. Không chẩn đoán, không hứa giữ bí mật. Kịch bản này phải có bộ test riêng.
5. **Riêng tư mặc định.** Giọng nói của người học được gửi tới dịch vụ nhận dạng cloud, nên: (a) bản chính: người dùng tự đồng ý bật micro; bản pilot: **phụ huynh/người giám sát phải đồng ý** bật micro cho học sinh dưới 18 tuổi (dùng cổng đồng ý của `MASTER_PROMPT.md`); (b) hiển thị rõ khi micro đang thu (vòng sóng + biểu tượng); (c) mặc định **giữ-để-nói**, chế độ rảnh tay phải bật chủ động; (d) chọn cấu hình nhà cung cấp **không lưu và không dùng dữ liệu để huấn luyện** nếu có, ghi rõ trong `LEGAL_COMPLIANCE.md`; với **gói miễn phí của Gemini**, cảnh báo người dùng rằng Google có thể dùng nội dung (kể cả âm thanh) để cải thiện sản phẩm; (e) app **không lưu bản ghi âm**. Hồ sơ học tập chỉ lưu thông tin phục vụ việc học (tiến độ, lỗi hay gặp, tốc độ phù hợp), **không lưu chuyện riêng tư** học sinh kể, và không gửi thông tin định danh (tên thật, trường, địa chỉ) lên API. Có nút xem và xóa toàn bộ dữ liệu. Camera **tắt mặc định**, chỉ dùng khi học sinh chủ động muốn cho thầy xem bài làm — **không** dùng camera để đọc cảm xúc khuôn mặt học sinh.
6. **Luôn có đường lui.** Không có micro → nhập chữ. Dịch vụ giọng nói lỗi/mất mạng → giọng đọc có sẵn của hệ điều hành hoặc phụ đề + khuôn mặt vẫn biểu cảm. Mất mạng hoàn toàn → thông báo thân thiện và gợi ý sang khu vực mô phỏng (chạy offline). Không bao giờ để học sinh "kẹt".

---

## B2. Kiến trúc tổng thể

Tư duy cốt lõi: tách **"bộ não"** (quyết định dạy gì) khỏi **"bộ diễn"** (thể hiện như thế nào). LLM không điều khiển pixel hay mili-giây; LLM viết một **kịch bản giảng dạy có cấu trúc**, còn engine tất định lo đồng bộ, bố cục, hoạt ảnh.

```
 Học sinh (giọng nói / chữ / vẽ lên bảng)
        │
        ▼
 [Speech-In] VAD năng lượng (không dùng AI) → ASR tiếng Việt cloud (streaming) → Intent nhanh (lệnh: "nói chậm lại", "giải thích lại"...)
        │
        ▼
 [Safety]  kiểm duyệt đầu vào/đầu ra, phát hiện tình huống cần hỗ trợ (Mục B1.4)
        │
        ▼
 [Teaching Brain — Gemini (bản chính) / Claude (bản pilot)]  Dialogue Manager (state machine) + Lesson Planner + Learner Model
        │            └─ Tool calls: engine vật lý, CAS (tính toán), CSDL hóa học, kiểm tra đáp án
        ▼
 [Performance Script]  luồng TeachScript (DSL - Mục B3), stream từng câu
        │
        ▼
 [Orchestrator]  lịch thời gian thống nhất, đồng hồ chủ = đồng hồ phát âm thanh
   ├─► [Voice]      TTS cloud streaming + timestamp từng từ + prosody
   ├─► [Face]       biểu cảm, khẩu hình (viseme), ánh nhìn, cử động đầu
   ├─► [Wave Ring]  vòng sóng phản ứng theo âm lượng & trạng thái
   ├─► [Whiteboard] viết tay, gạch chân, khoanh, mũi tên, sơ đồ, xóa/sửa, bố cục
   └─► [Pointer]    đầu bút / con trỏ di chuyển tới vị trí đang nói
```

**Đồng hồ chủ:** thời điểm phát âm thanh thực tế (`AudioContext.currentTime`). Mọi hành động bảng/khuôn mặt được "neo" vào **vị trí từ trong câu nói** và kích hoạt khi âm thanh phát tới từ đó. Sai lệch mục tiêu **≤ 100 ms**.

**Thư mục gợi ý:** `src/teacher/{brain, script, orchestrator, voice, speech-in, face, wave, board, pointer, learner, safety}`; backend Rust: `src-tauri/src/speech/` (client cho dịch vụ tiếng nói cloud; key giữ ở backend, không lộ ra giao diện).

---

## B3. TeachScript — ngôn ngữ kịch bản giảng dạy (trái tim của đồng bộ)

LLM xuất ra một DSL dạng thẻ XML nhẹ, **stream từng câu**. Lý do chọn thẻ XML thay vì JSON lồng sâu: các LLM hiện đại (Gemini, Claude) viết thẻ XML ổn định, và parse được từng phần ngay khi đang stream (JSON phải đợi đóng ngoặc mới parse an toàn).

### B3.1. Quy ước

- **Chữ nằm ngoài thẻ = lời thầy nói.**
- Thẻ đặt ở đâu trong câu thì **neo thời gian** tại đó (hành động bắt đầu khi giọng nói tới vị trí ấy).
- Nội dung trong `<write>` được **viết lên bảng**, không đọc thành tiếng (thầy nói câu xung quanh trong khi viết).
- LLM **chỉ đưa ý định ngữ nghĩa** (vùng, vai trò, liên kết), **tuyệt đối không đưa tọa độ pixel** — engine bố cục tự quyết định vị trí.

### B3.2. Ví dụ

```xml
<face e="focus"/>Trước tiên, chúng ta cần xác định
<write id="h1" zone="steps" role="heading">Bước 1: Các lực tác dụng</write>
các lực tác dụng lên vật.<pause ms="400"/>
Có <emph>hai lực chính</emph>.
Thứ nhất là trọng lực <write id="f1" zone="steps" math="true">\vec{P} = m\vec{g}</write>,
<point target="f1"/>hướng thẳng đứng xuống dưới.
Thứ hai là phản lực <write id="f2" zone="steps" math="true">\vec{N}</write> của mặt phẳng.
<draw id="d1" zone="diagram" type="free_body" spec='{"body":"block","forces":["P","N"],"ref":"tool:fbd_1"}'/>
<circle target="f1"/><prosody rate="0.9">Đây là chỗ nhiều bạn hay nhầm nhất.</prosody>
<face e="curious"/><ask id="q1" expect="choice" options="Có|Không" check="tool:equilibrium_1">Vậy theo em, vật có đứng yên được không?</ask>
```

### B3.3. Bộ thẻ tối thiểu (bạn hoàn thiện đặc tả trong `docs/TEACHSCRIPT.md`)

| Nhóm             | Thẻ                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giọng nói        | `<pause ms>`, `<emph>`, `<prosody rate pitch volume>`, `<tone style="question                                                                      | story  | emphasis                                                                                                | gentle | cheerful">` |
| Khuôn mặt        | `<face e="...">` (danh sách cảm xúc ở Mục B5), `<gaze to="student                                                                                  | board  | target_id">`, `<nod/>`, `<smile/>`                                                                      |
| Bảng — viết      | `<write id zone role math speed>`, `<draw id zone type spec>`, `<table>`, `<plot fn domain>`                                                       |
| Bảng — đánh dấu  | `<underline target span>`, `<circle target>`, `<box target>`, `<highlight target>`, `<arrow from to label>`, `<point target>`                      |
| Bảng — chỉnh sửa | `<erase target>`, `<correct target>nội dung mới</correct>` (gạch ngang rồi viết lại), `<newboard title>`, `<recall target>` (quay lại nội dung cũ) |
| Tương tác        | `<ask id expect check>`, `<wait_student/>`, `<checkpoint concept>`                                                                                 |
| Đồng bộ          | thuộc tính `sync="during                                                                                                                           | before | after"` trên thẻ bảng: viết _trong khi_ nói (mặc định), viết _xong rồi mới nói_, hoặc nói xong rồi viết |

### B3.4. Độ bền

- Parser **chịu lỗi**: thẻ hỏng/không đóng → bỏ qua phần hỏng, vẫn nói phần chữ; ghi log.
- **Validator** trước khi diễn: id trùng, target không tồn tại, vùng không hợp lệ → tự sửa hoặc bỏ.
- **Kiểm tra nguồn gốc con số:** mọi số trong `<write>`/`<draw>` phải khớp với kết quả tool hoặc đề bài; không khớp → không viết, gắn cảnh báo vào log và yêu cầu LLM sinh lại câu đó.
- Viết **fuzz test** cho parser.

### B3.5. Hai bước suy nghĩ → trình diễn

1. **Bước Kế hoạch (không stream ra ngoài):** LLM gọi tool để tính toán/tra cứu, quyết định ý sư phạm tiếp theo. Trong lúc này khuôn mặt ở trạng thái _đang suy nghĩ_.
2. **Bước Trình diễn (stream):** LLM viết TeachScript dựa trên kết quả tool. Câu đầu tiên phải tới loa thật nhanh (Mục B8).

---

## B4. Giao diện màn hình "Dạy học bằng AI"

### B4.1. Bố cục động

- **Khi trò chuyện / mở đầu:** vòng tròn AI Teacher **ở trung tâm**, lớn, nền tối giản, gần như không có khung "chat".
- **Khi bắt đầu giảng có bảng:** vòng tròn **thu nhỏ mượt** và trượt sang cạnh (trái/trên-trái trên màn hình rộng; phía trên trên màn hình hẹp), bảng trắng chiếm phần lớn diện tích — giống bố cục lớp học online thật. Chuyển cảnh 400–600 ms, easing mềm.
- **Thanh điều khiển tối giản phía dưới:** nút micro lớn (giữ để nói / chế độ rảnh tay), Dừng/Tiếp tục, tốc độ nói, bật/tắt phụ đề, và các **chip nhanh**: _Giải thích lại · Chậm hơn · Thêm ví dụ · Đơn giản hơn · Em chưa hiểu chỗ này_.
- **Thanh tiến độ bài học** mỏng phía trên (các mục của bài, checkpoint đã qua).
- Bản ghi lời thoại **ẩn trong ngăn kéo** (mở khi cần), không phải trung tâm giao diện.
- **Phụ đề** dạng karaoke nhẹ bên dưới vòng tròn (tắt được) — hỗ trợ học sinh khiếm thính và môi trường ồn.
- Icon dạng nét (Lucide) có micro-animation, không dùng emoji màu.

### B4.1b. Tối ưu cho người học (sinh viên & học sinh thử nghiệm)

- **Vào lớp nhanh:** màn hình bắt đầu chỉ hỏi 2 điều — _Hôm nay muốn học gì?_ (chọn Trình độ → Môn → Chủ đề, hoặc nói/gõ tự do, hoặc dán đề bài tập) và _Học trong bao lâu?_ (15 / 30 / 45 phút). Không có form dài.
- **Nút "Giơ tay"** lớn, dễ thấy: bấm để ngắt lời thầy và hỏi — quen thuộc như trong lớp học thật, dễ hơn việc phải nói chen.
- **Chế độ "Học im lặng"** (thư viện, nơi đông người): tắt giọng nói, chỉ phụ đề + bảng + khuôn mặt; học sinh trả lời bằng gõ phím hoặc chọn đáp án.
- **Trả lời theo nhiều cách:** nói, gõ, chọn đáp án nhanh dạng nút lớn, hoặc viết/vẽ lên bảng.
- **Chọn thầy/cô:** 2–3 nhân vật với tính cách và giọng khác nhau; chọn một lần khi bắt đầu, đổi được trong cài đặt.
- **Thẻ tổng kết cuối buổi** dạng trực quan: 3 ý chính hôm nay, câu em làm tốt, phần nên ôn lại, gợi ý buổi sau; lưu được thành ảnh vào "Vở ghi".
- **Hỗ trợ bài tập có trách nhiệm:** khi người học dán đề bài tập, thầy dẫn dắt từng bước và hỏi lại, không đọc ngay đáp án; có nút _"Xem lời giải"_ khi cần đối chiếu.
- **Chưa kết nối AI** (bản chính chưa nhập key Gemini): màn hình "Dạy học bằng AI" hiển thị lời mời thân thiện + nút mở thẳng màn hình **Kết nối AI**, kèm hướng dẫn lấy key; không báo lỗi khó hiểu.
- Mọi nút ≥ 44 px, hoạt động tốt ở 1366×768 và màn hình cảm ứng; ngôn ngữ giao diện thân thiện, không thuật ngữ kỹ thuật.
- Hiển thị nhẹ nhàng nhãn _"Thầy/cô AI"_ trên vòng tròn để người học luôn biết đây là AI.
- **Cách xưng hô chọn được:** "thầy/cô – em" (mặc định ở bản pilot) hoặc "mình – bạn" (phù hợp nhiều sinh viên).

### B4.2. Vòng sóng (Wave Ring)

- Shader WebGL (hoặc Canvas 2D ở máy yếu): nhiều dải sóng sin mềm chồng lên nhau quanh vòng tròn, chuyển động **liên tục** (không bao giờ đứng im hoàn toàn).
- Biên độ & tần số lấy từ `AnalyserNode` (RMS + vài dải tần) của giọng thầy; khi học sinh nói, vòng phản ứng theo micro của học sinh (màu khác) để học sinh biết thầy _đang nghe_.
- Màu & nhịp theo trạng thái: **đang nghe** (tông lạnh, sóng hướng vào trong) · **đang nói** (tông ấm, sóng lan ra) · **đang suy nghĩ** (nhịp chậm, dải sáng xoay nhẹ) · **chờ** (thở nhẹ). Chuyển màu nội suy, không giật.
- Tôn trọng `prefers-reduced-motion`.

---

## B5. Khuôn mặt người thầy

### B5.1. Định hướng hình ảnh

- **Mặc định: khuôn mặt minh họa 2.5D có hồn** (phong cách hoạt hình chất lượng cao, ấm áp), **không** cố làm người thật photorealistic. Lý do: (1) tránh hiệu ứng "thung lũng kỳ lạ" khiến cảm giác rợn/giả; (2) chạy mượt trên máy phổ thông; (3) biểu cảm rõ ràng, dễ đọc. Cảm giác "thật" đến từ **chuyển động sống động và phản ứng đúng lúc**, không đến từ độ chân thực của da.
- Kiến trúc `FaceRenderer` có **2 bản cài đặt** cùng một giao diện điều khiển:
  - `Face2D` (mặc định): các lớp vector/rig (Rive hoặc SVG/Canvas tự rig) — mắt, mí, lông mày, miệng, má, đầu, có tham số liên tục.
  - `Face3D` (tùy chọn cho máy mạnh): đầu 3D GLB với bộ **blendshape kiểu ARKit (52)**, render bằng three.js.
- Có 2–3 nhân vật thầy/cô gốc để học sinh chọn (giọng, giới tính, cách xưng hô "thầy/cô – em"), tất cả **do dự án tự thiết kế**, không dùng hình người thật hay nhân vật có bản quyền.

### B5.2. Hệ biểu cảm

- Trạng thái: `neutral`, `listening`, `thinking`, `explaining/focus`, `happy`, `encouraging` (học sinh trả lời đúng), `patient/empathetic` (học sinh gặp khó), `curious` (khi đặt câu hỏi), `surprised_light`, `proud`.
- Mỗi trạng thái là **tổ hợp tham số** (lông mày, độ mở mắt, khóe miệng, nghiêng đầu…), **trộn mượt** 150–400 ms; có thể chồng lớp (vừa nói vừa mỉm cười).
- **Chuyển động sống (không bao giờ đứng im):** chớp mắt ngẫu nhiên tự nhiên (2–6 s, đôi khi chớp đôi), dao động đầu nhỏ bằng Perlin noise, chuyển động mắt nhỏ (saccade), nhịp thở, gật đầu nhẹ khi học sinh nói, **nhìn về phía bảng khi đang viết** rồi nhìn lại học sinh khi hỏi.
- Biểu cảm khi lắng nghe phản hồi trực tiếp: gật nhẹ khi học sinh ngừng giữa câu, nhíu mày suy nghĩ khi câu hỏi khó.

### B5.3. Khẩu hình (lip-sync)

- Ưu tiên dùng **timestamp âm vị/từ** do TTS cung cấp → ánh xạ sang tập **viseme** (khoảng 12–15 dạng miệng) phù hợp **nguyên âm & phụ âm tiếng Việt** (a, ă/â, e, ê, i, o, ô, ơ, u, ư; m/b/p môi khép; ph/v răng-môi…). Viết bảng ánh xạ trong `docs/VISEMES_VI.md`.
- Nếu dịch vụ TTS cung cấp **sự kiện viseme** thì dùng trực tiếp (ưu tiên khi chọn nhà cung cấp).
- Không có timestamp → **lip-sync từ phân tích âm thanh** (năng lượng + formant/dải tần, xử lý tín hiệu thuần, không dùng mô hình AI) làm phương án dự phòng.
- Khớp miệng-tiếng sai lệch mục tiêu **≤ 60 ms**; đóng miệng tự nhiên ở các khoảng ngắt.

---

## B6. Giọng nói & lắng nghe

### B6.0. Chọn dịch vụ tiếng nói cloud (làm ở GĐ T0)

Cần chọn dịch vụ TTS + ASR **riêng cho từng bản build**:

**Bản chính (sinh viên ≥ 18) — ưu tiên dùng chính key Gemini của người dùng.** Khảo sát tài liệu hiện hành (ai.google.dev) về:

- **Gemini TTS** (các model chuyển văn bản thành giọng nói, điều khiển phong cách/cảm xúc bằng lời chỉ dẫn): chất lượng tiếng Việt, độ trễ, có streaming không, có **timestamp từng từ** không (nếu không → dùng cách cắt đoạn tại thẻ neo ở Mục B6.1).
- **Gemini Live API** (hội thoại giọng nói hai chiều thời gian thực): độ trễ, khả năng ngắt lời, có bản ghi chữ (transcription) cho đầu vào/đầu ra không, và **có giữ được đồng bộ chặt với bảng trắng không**. Gợi ý: phần giảng có bảng vẫn dùng pipeline TeachScript (đồng bộ chính xác); Live API có thể dùng cho đoạn trò chuyện/hỏi đáp nhanh không cần bảng — bạn đo đạc rồi đề xuất.
- **Hiểu âm thanh** của Gemini để nhận dạng lời nói tiếng Việt nếu không dùng Live API.
- Nếu giọng tiếng Việt của Gemini chưa đạt, đề xuất dịch vụ TTS cloud khác làm tùy chọn (người dùng nhập thêm key) — nhưng mặc định phải chạy được chỉ với **một key Gemini**.

**Bản pilot (học sinh THPT):** dịch vụ tiếng nói cloud có giọng vi-VN (ví dụ Azure AI Speech, Google Cloud Text-to-Speech/Speech-to-Text…), **bắt buộc điều khoản cho phép dùng trong ứng dụng có người dùng dưới 18 tuổi** (loại ngay dịch vụ cấm điều này, như Gemini API).

Viết `docs/VOICE_BENCHMARK.md` so sánh theo tiêu chí, **theo thứ tự ưu tiên**:

1. **Điều khoản phù hợp với bản build** (đặc biệt bản pilot). Ghi trích dẫn vào `LEGAL_COMPLIANCE.md`; điểm nào không rõ thì báo tôi, không tự kết luận.
2. **Quyền riêng tư:** chính sách lưu và dùng dữ liệu (gói miễn phí vs trả phí).
3. **Chất lượng giọng tiếng Việt:** tự nhiên, đúng thanh điệu, có ngữ điệu.
4. **Khả năng đồng bộ:** sự kiện ranh giới từ (word boundary), sự kiện viseme, hỗ trợ SSML hoặc điều khiển phong cách tương đương.
5. **Streaming & độ trễ:** thời gian ra âm thanh đầu tiên; ASR streaming có kết quả tạm thời và tự phát hiện kết thúc câu.
6. **Chi phí** cho một buổi học 30 phút; giới hạn của gói miễn phí.

Đề xuất lựa chọn chính + dự phòng cho từng bản build, chờ tôi duyệt.

### B6.1. TTS (thầy nói)

- Thiết kế `TTSProvider` cắm-rút, hỗ trợ: **streaming theo câu**, **timestamp từng từ**, điều khiển **tốc độ / cao độ / âm lượng / ngắt nghỉ / nhấn mạnh / phong cách**.
- Ánh xạ thẻ TeachScript (`<prosody>`, `<emph>`, `<tone>`, `<pause>`) sang **SSML** của nhà cung cấp; nếu thiếu tính năng nào, mô phỏng bằng chia câu + điều chỉnh rate/pitch + chèn khoảng lặng.
- **Neo đồng bộ chắc chắn:** nếu nhà cung cấp không trả timestamp từng từ, **cắt lời nói tại các vị trí thẻ neo** và tổng hợp từng đoạn → thời điểm neo chính là ranh giới đoạn (chính xác tuyệt đối); bên trong đoạn ước lượng theo tỉ lệ số âm tiết.
- **Dự phòng khi dịch vụ lỗi/mất mạng:** giọng đọc tiếng Việt có sẵn của hệ điều hành qua Web Speech API (`speechSynthesis`, dùng sự kiện `onboundary` để đồng bộ), hoặc chỉ phụ đề.
- **Cache âm thanh** các câu cố định (lời chào, câu chuyển ý, câu khen) để giảm chi phí và độ trễ.
- Giọng phải **tự nhiên, có ngữ điệu**, phát âm đúng thanh điệu tiếng Việt, đọc đúng ký hiệu khoa học (ví dụ "m trên giây bình phương", "H hai O", "căn bậc hai"). Viết bộ **chuẩn hóa văn bản → lời nói** (số, đơn vị, công thức, ký hiệu hóa học) có test riêng.

### B6.2. Nghe học sinh (ASR)

- **Phát hiện giọng nói (VAD) tại máy bằng xử lý tín hiệu thuần** (năng lượng + tần số, không dùng mô hình AI) để biết học sinh bắt đầu nói và để ngắt lời nhanh; việc xác định kết thúc câu dựa vào tính năng endpointing của dịch vụ ASR cloud. Chế độ **giữ-để-nói** (mặc định) và **rảnh tay** (bật chủ động).
- **ASR tiếng Việt streaming qua cloud**: chỉ mở kết nối khi học sinh đang nói (tiết kiệm chi phí, bảo vệ riêng tư); dùng **danh sách cụm từ gợi ý** (phrase list) với thuật ngữ khoa học của bài đang học nếu dịch vụ hỗ trợ. Đo **WER** trên một bộ câu mẫu giọng học sinh 3 miền, có thuật ngữ khoa học.
- **Chống vọng âm:** bật echo cancellation của WebRTC (`getUserMedia` với `echoCancellation`), đồng thời giảm độ nhạy VAD khi thầy đang nói để thầy không "nghe chính mình".
- **Ngắt lời (barge-in):** khi học sinh nói chen > ~300 ms có nội dung → thầy **dừng nói trong ≤ 200 ms**, kết thúc nét chữ đang viết dở một cách tự nhiên (viết nốt chữ hiện tại rồi dừng), khuôn mặt chuyển sang `listening`, lưu **điểm tiếp tục**. Sau khi xử lý xong câu hỏi, thầy hỏi _"Mình quay lại chỗ lúc nãy nhé?"_.
- Lệnh nhanh ("chậm lại", "nói lại", "dừng", "tiếp tục") nhận diện bằng **luật + từ khóa** trước, không cần đợi LLM.

---

## B7. Bảng trắng AI

### B7.1. Chữ viết tay

- Dùng **font viết tay có đầy đủ bộ ký tự tiếng Việt** và giấy phép mở (OFL) — bạn kiểm tra và chọn 2–3 font, có font cho tiêu đề và font cho nội dung.
- **Không hoàn hảo một cách có kiểm soát:** mỗi ký tự có sai khác nhỏ ngẫu nhiên nhưng **tất định theo seed** (xoay ±1–3°, lệch baseline ±1–2 px, co giãn ±3%, khoảng cách chữ dao động nhẹ), câu dài hơi nghiêng dần như người viết tay. Nếu font có glyph thay thế (alternates), xoay vòng để hai chữ giống nhau không y hệt.
- **Phân cấp thị giác:** tiêu đề (to, có thể gạch chân), từ khóa (đậm/màu nhấn), nội dung chính, chú thích (nhỏ, nghiêng, màu phụ). Bảng màu bút giới hạn 3–4 màu như giáo viên thật (đen/xanh dương/đỏ/xanh lá) + chế độ bảng đen phấn trắng.
- **Hoạt ảnh viết:**
  - Mức 1 (bắt buộc): lộ dần **từng ký tự** theo hướng viết bằng mặt nạ (mask) đi theo **đầu bút** hiển thị; nhịp không đều (dừng ngắn giữa các từ, nhanh hơn ở chữ quen).
  - Mức 2 (nâng cao): tiền xử lý glyph → **khung xương nét** (skeletonize) → thứ tự nét → vẽ theo nét thật. **Viết dấu tiếng Việt sau chữ cái gốc** (viết "a", rồi mũ "^", rồi dấu thanh) — giống cách người Việt viết tay thật.
  - Công thức: KaTeX/MathJax → SVG path → lộ dần theo thứ tự trái → phải, phân số viết tử trước rồi gạch ngang rồi mẫu.
- **Hình vẽ tay:** gạch chân, khoanh tròn, đóng khung, mũi tên, ngoặc nhọn dùng phong cách phác thảo (ví dụ rough.js / perfect-freehand), nét có độ dày thay đổi; vòng khoanh tròn hơi không khép kín như người vẽ thật.
- **Tốc độ viết** thay đổi theo độ khó (`speed` trong `<write>` + tự điều chỉnh): chậm hơn ở công thức quan trọng, nhanh ở chữ quen; luôn đủ chậm để mắt theo kịp.

### B7.2. Bố cục thông minh (engine tất định — LLM không chọn tọa độ)

- Bảng là **canvas logic lớn** (có thể cuộn/thu phóng), chia thành **vùng ngữ nghĩa** linh hoạt: `title`, `main` (công thức trung tâm), `steps` (các bước giải, dọc), `side_notes` (chú thích cạnh nội dung liên quan), `example`, `diagram`, `scratch` (nháp).
- **Bộ lập bố cục** quyết định vị trí dựa trên: vai trò, quan hệ (`note-for="f1"` → đặt ngay cạnh f1, có mũi tên nếu cần), thứ tự giảng, không gian còn trống. Hỗ trợ viết **ngang** và **dọc**.
- **Không chồng lấn:** quản lý bounding box bằng chỉ mục không gian (ví dụ R-tree/rbush), giữ khoảng cách tối thiểu, cỡ chữ tối thiểu theo kích thước màn hình, độ dài dòng tối đa, tự xuống dòng có ngắt từ hợp lý.
- **Hết chỗ:** ưu tiên (1) dùng vùng trống khác hợp lý, (2) **lia camera** mượt sang khoảng trống mới như giáo viên bước sang phần bảng khác, (3) xóa vùng cũ ít liên quan (có hoạt ảnh xóa bằng giẻ lau), (4) `newboard` — sang "mặt bảng" mới, mặt cũ lưu trong lịch sử.
- **Ưu tiên khả năng quan sát & tư duy hơn vẻ đẹp:** nội dung liên quan đặt gần nhau, thứ tự đọc rõ ràng (trên → dưới, trái → phải), camera luôn giữ phần đang được giảng trong tầm nhìn.
- **Viết property-based test:** sinh ngẫu nhiên hàng nghìn chuỗi lệnh bảng → kiểm tra không có chồng lấn, không tràn khỏi vùng, chữ không nhỏ hơn ngưỡng.

### B7.3. Lịch sử & tương tác của học sinh với bảng

- Mỗi phần tử có `id`; mọi thao tác ghi vào **dòng thời gian bảng** → học sinh **kéo thanh lịch sử** để xem lại nội dung trước; thầy dùng `<recall>` để quay lại chỉ vào nội dung cũ.
- Học sinh có thể **viết/vẽ lên bảng** (bút riêng màu khác) để trả lời. Khi người học bấm _"Thầy xem giúp"_, ảnh phần bảng của người học được gửi tới **AI của bản build đang dùng (Gemini hoặc Claude đều đọc được ảnh)** để thầy "nhìn" và nhận xét — chỉ gửi khi học sinh chủ động bấm.
- Xuất bảng thành ảnh PNG/PDF làm vở ghi sau buổi học.

### B7.4. Sơ đồ & biểu đồ

`<draw type=...>` hỗ trợ: sơ đồ lực, trục tọa độ & đồ thị hàm số, bảng, sơ đồ khối/mũi tên quá trình, công thức cấu tạo phân tử (dùng RDKit của app, render theo phong cách vẽ tay), sơ đồ sinh học đơn giản. Số liệu trong sơ đồ lấy từ tool (Mục B1.1).

---

## B8. Đồng bộ thời gian thực & độ trễ

- **Orchestrator** nhận TeachScript đã parse → tạo **timeline**: các đoạn âm thanh (kèm timestamp từ), sự kiện khuôn mặt, sự kiện bảng (neo vào chỉ số từ), sự kiện con trỏ.
- Nếu một lệnh `<write>` cần lâu hơn đoạn lời tương ứng: theo `sync` — kéo dài khoảng ngắt tự nhiên ("…" kèm biểu cảm tập trung, mắt nhìn bảng), giống thầy viết xong mới nói tiếp; không để chữ chạy đua với giọng.
- **Pipeline streaming:** LLM stream → cắt câu → TTS câu 1 trong khi LLM viết câu 2 → phát. Đệm 1 câu phía trước.
- **Ngân sách độ trễ** (từ khi học sinh nói xong tới khi thầy bắt đầu phản hồi):
  - Mục tiêu: **≤ 1,5 s** với mạng tốt, **≤ 2,5 s** với mạng trường học/4G. Dùng streaming ở mọi khâu (ASR, LLM, TTS) và prompt caching cho system prompt/persona.
  - Trong lúc chờ: khuôn mặt chuyển `thinking` ngay lập tức (< 100 ms), vòng sóng đổi nhịp; với câu hỏi dài có thể có **phản hồi đệm ngắn tự nhiên** (ví dụ "À, câu này hay đấy…") — đệm phải đa dạng, không lặp, và không được dùng thay cho nội dung thật.
- Đo và hiển thị các chỉ số ở chế độ dev: độ trễ ASR, thời gian token đầu, thời gian âm thanh đầu, sai lệch đồng bộ bảng–lời, sai lệch khẩu hình.

---

## B9. Hiệu năng, mạng & chi phí

Vì mọi AI chạy trên cloud, máy học sinh chỉ lo **hiển thị và âm thanh** → chạy được trên laptop phổ thông (GPU tích hợp, 8GB RAM).

- **Phân tầng hiển thị** (tự đề xuất theo benchmark của `MASTER_PROMPT.md`): _Nhẹ_ — Face2D đơn giản, vòng sóng Canvas 2D; _Chuẩn_ — Face2D đầy đủ, vòng sóng WebGL; _Cao_ — thêm Face3D (tùy chọn).
- Render khuôn mặt + vòng sóng + bảng: **60 FPS** ở tầng Nhẹ; hoạt ảnh không được làm giật âm thanh (âm thanh luôn ưu tiên cao nhất, AudioWorklet).
- **Mạng chập chờn:** đệm trước 1–2 câu âm thanh; mất kết nối giữa chừng → thầy "dừng lại suy nghĩ" tự nhiên, tự kết nối lại, tiếp tục từ điểm dừng; mất hẳn → thông báo thân thiện, lưu tiến độ, phần bảng đã viết vẫn xem được.
- **Kiểm soát chi phí API:** đo chi phí trung bình mỗi buổi học (LLM + TTS + ASR), hạn mức theo ngày (bản chính: người dùng tự đặt cho key của mình; bản pilot: người giám sát đặt), cache câu cố định, chỉ mở ASR khi đang nói, rút gọn lịch sử hội thoại (tóm tắt các lượt cũ) để giảm token. Hiển thị ước tính lượng dùng/chi phí trong Cài đặt → Kết nối AI (bản chính) và chế độ người giám sát (bản pilot).
- Áp dụng **thang hạ cấp quá tải** của `MASTER_PROMPT.md` (Mục 5): hạ hiệu ứng hình trước, giữ âm thanh và nội dung đúng.

---

## B10. Bộ não giảng dạy (Teaching Brain)

### B10.1. Tính cách thầy

Viết **persona** rõ ràng trong `src/teacher/brain/persona/`: kiên nhẫn, hài hước nhẹ, khích lệ cụ thể (khen _cách làm_, không khen chung chung), nói ngắn gọn từng ý, hay đặt câu hỏi gợi mở, dùng ví dụ đời thường gần gũi học sinh Việt Nam. Xưng "thầy/cô – em". Mỗi nhân vật thầy có giọng và phong cách khác nhau nhưng cùng chuẩn sư phạm.

### B10.2. Phương pháp sư phạm (bắt buộc áp dụng)

- **Hỏi gợi mở (Socratic)** trước khi đưa đáp án; chỉ giải trọn khi học sinh đã thử hoặc yêu cầu.
- **Giàn giáo (scaffolding):** ví dụ mẫu → làm cùng → học sinh tự làm; gợi ý tăng dần (gợi ý 1 → 2 → lời giải).
- **Kiểm tra hiểu bài** sau mỗi ý chính (`<checkpoint>`), bằng câu hỏi ngắn, không hỏi "em hiểu chưa?" chung chung.
- **Chẩn đoán lỗi sai:** khi học sinh sai, xác định _lỗi khái niệm_ nào (ví dụ nhầm khối lượng với trọng lượng) và giảng lại đúng chỗ đó, không chỉ nói "sai rồi".
- **Đa cách giải thích:** khi "giải thích lại" hoặc "đơn giản hơn" → **đổi cách tiếp cận** (ví dụ thực tế, hình vẽ, phép so sánh, chia nhỏ bước), không lặp lại y câu cũ.
- **Ôn tập cuối buổi:** tóm tắt 3 ý chính trên bảng + 1–2 câu hỏi nhanh; hẹn ôn lại theo lịch giãn cách.

### B10.3. Quản lý hội thoại (state machine)

Trạng thái: `GREETING → PLANNING → TEACHING ⇄ ASKING → LISTENING → EVALUATING → (FEEDBACK) → TEACHING …`, cùng các nhánh `CLARIFYING` (giải thích lại), `CHITCHAT` (trò chuyện ngoài lề), `PAUSED`, `RECAP`, `SUPPORT` (an toàn — Mục B1.4).

- **Không kịch bản cứng:** Lesson Planner tạo **dàn ý mục tiêu** (mục tiêu học, các ý, checkpoint), còn thứ tự và cách giảng thích ứng theo phản hồi học sinh.
- **Trò chuyện ngoài lề:** khi học sinh chia sẻ chuyện riêng/cảm xúc → chuyển `CHITCHAT`, phản hồi ngắn, chân thành, liên hệ tự nhiên (ví dụ _"Hôm nay em hơi mệt à? Không sao, mình học chậm lại một chút nhé. Phần này thật ra không khó đâu."_), có thể điều chỉnh nhịp học (chậm hơn, nghỉ ngắn), rồi **mềm mại quay lại bài** sau 1–3 lượt.
- **Đánh giá câu trả lời:** dùng **kiểm tra tất định** khi có thể (so số với dung sai, so đơn vị, so đáp án lựa chọn, CAS so biểu thức tương đương); LLM chỉ đánh giá phần diễn đạt bằng lời và luôn giải thích vì sao đúng/sai.

### B10.4. Hồ sơ học sinh (Learner Model) — lưu trên máy

Mức nắm vững từng khái niệm, lỗi sai hay gặp, tốc độ nói ưa thích, cách giải thích hiệu quả với em (hình vẽ/ví dụ/công thức), lịch ôn tập. Dùng để thích ứng buổi sau. Tuân thủ Mục B1.5 (không lưu chuyện riêng tư, có nút xóa).

### B10.5. Nền tảng kiến thức

Truy xuất (RAG) từ **kho kiến thức đã duyệt** của app (ghi chú bám chương trình SGK, dữ liệu khoa học của `MASTER_PROMPT.md`) để giảm bịa. Tìm kiếm trong kho bằng **tìm kiếm từ khóa tại máy** (ví dụ BM25/full-text của SQLite — không cần mô hình AI local), rồi đưa đoạn liên quan vào prompt gửi tới API LLM. Nội dung kho có `review_status` như `MASTER_PROMPT.md`.

---

## B11. Kiểm thử

- **Đồng bộ:** test tự động đo sai lệch giữa thời điểm phát từ neo và thời điểm bắt đầu hành động bảng (≤ 100 ms), khẩu hình (≤ 60 ms).
- **Bảng:** property-based test bố cục (không chồng lấn/tràn), snapshot test hoạt ảnh chữ tiếng Việt có dấu.
- **TeachScript:** unit + fuzz test parser, validator, kiểm tra nguồn gốc con số.
- **Tiếng nói:** WER của ASR trên bộ câu mẫu; test chuẩn hóa văn bản → lời nói (số, đơn vị, công thức, ký hiệu hóa học).
- **Sư phạm:** bộ **học sinh mô phỏng** (kịch bản: trả lời đúng, sai do hiểu lầm khái niệm, im lặng, ngắt lời, xin giải thích lại, kể chuyện ngoài lề, hỏi lạc đề) → chấm theo rubric (có hỏi gợi mở không, có đổi cách giải thích không, có quay lại bài không, có bịa số không).
- **An toàn:** bộ test riêng cho các tình huống khủng hoảng (Mục B1.4), yêu cầu đóng vai không phù hợp, hỏi "thầy có phải người thật không" — kết quả phải đúng 100%.
- **Độ trễ & hiệu năng:** benchmark từng tầng hiển thị và các điều kiện mạng (tốt / wifi trường / 4G yếu, giả lập bằng network throttling), ghi vào `docs/PERFORMANCE.md`.
- **Riêng tư:** test rằng micro chỉ mở khi được phép, không có thông tin định danh trong dữ liệu gửi lên API, không có file ghi âm nào được lưu.
- **Chi phí:** test hạn mức theo ngày hoạt động đúng; CI dùng phản hồi ghi sẵn (mock) để không tốn phí API.
- **Thử nghiệm người dùng:** hướng dẫn tôi tổ chức buổi thử với 5–10 bạn học sinh, phiếu khảo sát ngắn (cảm giác "học với thầy thật" theo thang 1–5, mức dễ hiểu, điểm khó chịu) — dữ liệu này rất có giá trị cho hồ sơ dự thi.

---

## B12. Lộ trình (theo giai đoạn)

Làm tuần tự. Hết mỗi giai đoạn: chạy test, cập nhật docs, **dừng lại báo cáo** và chờ tôi đồng ý.

| GĐ     | Nội dung                                                                                                                                                                                                                                                                                                    | Tiêu chí hoàn thành                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **T0** | Đặc tả `docs/TEACHSCRIPT.md`, `docs/AI_TEACHER_ARCHITECTURE.md`; route "Dạy học bằng AI" tách biệt; khảo sát giọng nói theo Mục B6.0 — Gemini TTS/Live API cho bản chính, dịch vụ cho phép người dưới 18 cho bản pilot (`VOICE_BENCHMARK.md`, cập nhật `LEGAL_COMPLIANCE.md`); phác thảo giao diện (Mục B4) | Tôi duyệt đặc tả, dịch vụ giọng nói và bản phác giao diện                                      |
| **T1** | **"Buổi học dựng tay"**: một bài giảng mẫu viết sẵn bằng TeachScript (không cần LLM) + TTS + Orchestrator + vòng sóng + Face2D cơ bản + khẩu hình                                                                                                                                                           | Bài mẫu chạy trọn, đồng bộ đạt ngân sách — **phần "diễn" phải thuyết phục trước khi có "não"** |
| **T2** | Bảng trắng: chữ viết tay tiếng Việt (mức 1), đánh dấu, sơ đồ, bố cục thông minh, camera, lịch sử                                                                                                                                                                                                            | Property test bố cục pass; bài mẫu trông như giáo viên thật viết                               |
| **T3** | Khuôn mặt hoàn chỉnh: hệ biểu cảm, chuyển động sống, ánh nhìn theo bảng, chuyển cảnh bố cục                                                                                                                                                                                                                 | Bạn bè xem thử không thấy "avatar tĩnh"                                                        |
| **T4** | Teaching Brain: Gemini (bản chính) / Claude (bản pilot) sinh TeachScript qua `AIProvider`, tool calls, kiểm tra nguồn gốc con số, Lesson Planner, kiểm duyệt nội dung                                                                                                                                       | Giảng được 3 bài Vật lý + 2 bài Hóa không bịa số, với cả hai nhà cung cấp                      |
| **T5** | Nghe: VAD tín hiệu, ASR cloud streaming (hoặc Gemini Live API nếu được chọn ở T0), đồng ý dùng micro, chống vọng âm, ngắt lời + nút "Giơ tay", lệnh nhanh, dialog state machine                                                                                                                             | Ngắt lời phản hồi ≤ 200 ms; độ trễ đạt ngân sách                                               |
| **T6** | Thích ứng: Learner Model, đa cách giải thích, chẩn đoán lỗi, trò chuyện ngoài lề, module an toàn                                                                                                                                                                                                            | Toàn bộ test sư phạm & an toàn pass                                                            |
| **T7** | Học sinh viết lên bảng, chữ viết tay mức 2 (theo nét, dấu viết sau), Face3D (tùy chọn)                                                                                                                                                                                                                      | Theo yêu cầu                                                                                   |
| **T8** | Phân tầng hiển thị, xử lý mạng chập chờn, kiểm soát chi phí, chế độ "Học im lặng", thẻ tổng kết, chế độ trình chiếu cho giám khảo, thử nghiệm với học sinh, tài liệu                                                                                                                                        | Chạy ở tầng Nhẹ trên máy cấu hình tối thiểu; có số liệu chi phí/buổi học                       |

---

## B13. Quy tắc làm việc

1. Tuân thủ toàn bộ Mục 10 của `MASTER_PROMPT.md` và Mục A8.
2. **Ưu tiên "diễn" trước "não"**: làm bài giảng dựng tay mượt và thuyết phục trước khi nối LLM — đây là thứ quyết định cảm giác "học với thầy thật".
3. Mọi thư viện/mô hình bên thứ ba: ghi rõ **giấy phép** trong `docs/THIRD_PARTY.md`; không dùng mô hình/giọng nói/hình ảnh có giấy phép không cho phép dùng trong dự án.
4. Không clone giọng hay khuôn mặt của người thật nếu không có sự đồng ý bằng văn bản của người đó.
5. Khi một yêu cầu trải nghiệm không khả thi trên máy phổ thông hoặc với dịch vụ cloud đã chọn, **nói rõ với tôi** và đề xuất phương án gần nhất, không âm thầm cắt bớt.
6. **Không dùng AI local** (không mô hình TTS/ASR/LLM/VAD/vision nào chạy trên máy). Mọi dịch vụ cloud phải qua interface cắm-rút. **Không bao giờ để mã Gemini có trong bản pilot**; mọi dịch vụ dùng trong bản pilot phải có điều khoản cho phép người dùng dưới 18 tuổi.

---

**Bắt đầu:** Thực hiện **Bước 0** (kiểm tra trạng thái dự án, liệt kê phần bị ảnh hưởng, đề xuất kế hoạch chuyển đổi và cách lồng Phần B vào lộ trình), rồi **dừng lại chờ tôi duyệt**.
