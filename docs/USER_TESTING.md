# Thử nghiệm với người học thật (PROMPT_PHAN_2 A4.5)

Tài liệu này hướng dẫn tổ chức một buổi thử nghiệm và là nơi **ghi kết quả**. Làm lại ở mỗi mốc lớn
(sau 3b.6, sau AI Teacher T5, trước khi nộp hồ sơ dự thi). Kết quả thật, ghi đúng như quan sát được,
là bằng chứng mạnh cho hồ sơ — **không sửa, không làm tròn đẹp, không bịa số liệu**.

## 1. Hai nhóm

| Nhóm                 | Số người | Bản cài                                              | Mục tiêu kiểm tra                                                 |
| -------------------- | -------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **A. Học sinh THPT** | 5–10 em  | `STEM Sim Lab THPT_…_x64-setup.exe` (bản thử nghiệm) | mô phỏng và giao diện có dễ hiểu ở trình độ _Nền tảng_ không      |
| **B. Sinh viên**     | 5–10 bạn | `STEM Sim Lab_…_x64-setup.exe` (bản chính)           | toàn bộ luồng: lần mở đầu, nhập key Gemini của chính mình, đọc đề |

Vì sao 5–10 người: theo Nielsen & Landauer (1993), khoảng 5 người đã cho thấy phần lớn chỗ vướng
lớn; thêm người chủ yếu để thấy chỗ vướng có lặp lại hay không.

## 2. Trước buổi thử

**Nhóm A (học sinh THPT) — bắt buộc:**

- [ ] Có **phiếu đồng ý** của phụ huynh (và của nhà trường nếu làm ở trường) cho từng em, theo
      `docs/PILOT_CONSENT.md`. Thiếu phiếu thì em đó **không** tham gia.
- [ ] Có ít nhất một **người giám sát** là người lớn (thầy cô hoặc phụ huynh) suốt buổi.
- [ ] Người giám sát cài bản THPT, đặt mã PIN, nhập khóa API Claude (tài khoản của sinh viên 18+ hoặc
      phụ huynh — xem `docs/PILOT_CONSENT.md`). Học sinh **không** thấy và không nhập khóa.
- [ ] Đặt giới hạn lượt AI mỗi ngày ở mức nhỏ trong Cài đặt.

**Cả hai nhóm:**

- [ ] Máy Windows 10/11, màn hình 1366×768 trở lên; thử trước một lần trên đúng máy đó.
- [ ] In sẵn: danh sách nhiệm vụ (mục 3), phiếu quan sát (mục 4), phiếu khảo sát (mục 5).
- [ ] Đồng hồ bấm giờ (điện thoại cũng được).
- [ ] **Không ghi tên thật.** Mỗi người một mã: `HS01`, `HS02`… (nhóm A), `SV01`, `SV02`… (nhóm B).
      Không quay video khuôn mặt, không ghi âm. Chỉ ghi chú bằng tay.

**Lời giới thiệu (đọc cho người thử):** "Mình đang thử **phần mềm**, không phải thử bạn. Bạn làm
không được là lỗi của phần mềm — chính điều đó giúp mình sửa. Bạn cứ nói to điều mình đang nghĩ.
Mình sẽ không giúp trong lúc làm, trừ khi bạn kẹt quá 3 phút."

## 3. Nhiệm vụ

Giao **từng nhiệm vụ một**, bằng lời như trong cột "Nói với người thử" — không chỉ chỗ bấm. Bấm giờ
từ lúc nói xong đến lúc người thử nói "xong" (hoặc hết thời gian tối đa).

### Nhóm A — học sinh THPT (bản thử nghiệm, khoảng 30 phút)

| Mã  | Nói với người thử                                                                                                                              | Xong khi                                       | Tối đa |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| A1  | "Em hãy mở bài **Rơi tự do** trong môn Vật lý."                                                                                                | đang thấy mô phỏng Rơi tự do                   | 3 ph   |
| A2  | "Trước khi chạy, em hãy **đoán** điều gì xảy ra, rồi chạy để kiểm tra." (thẻ Thử thách)                                                        | đã chọn một dự đoán và thấy kết quả            | 4 ph   |
| A3  | "Em hãy làm cho vật **rơi đúng 2 giây**."                                                                                                      | thử thách báo "Chính xác!"                     | 6 ph   |
| A4  | "Em hãy gõ đề này cho phần mềm đọc: _Ném một vật theo phương ngang từ độ cao 20 m với vận tốc 5 m/s. Tính thời gian rơi._" (có người giám sát) | thấy bảng "Tôi hiểu đề như sau", bấm dựng cảnh | 6 ph   |
| A5  | "Em hãy tìm xem mô phỏng này **dựa trên giả định gì**." (Thẻ Khoa học)                                                                         | đọc được ít nhất một giả định                  | 3 ph   |
| A6  | "Em hãy mở một bài **Hóa học** bất kỳ và xoay thử phân tử / nguyên tử."                                                                        | đã xoay hoặc tương tác được                    | 4 ph   |

### Nhóm B — sinh viên (bản chính, khoảng 35 phút)

| Mã  | Nói với người thử                                                                                                        | Xong khi                                          | Tối đa |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------ |
| B1  | "Bạn hãy cài phần mềm và mở lần đầu, làm theo những gì nó hỏi." (máy chưa từng cài)                                      | đến màn hình "Hôm nay học gì?"                    | 8 ph   |
| B2  | "Bạn hãy **kết nối AI** bằng key Gemini của chính bạn." (bạn ấy tự tạo key, phải từ 18 tuổi)                             | trạng thái "Đã kết nối Gemini" sau "Kiểm tra key" | 10 ph  |
| B3  | "Bạn hãy gõ đề: _Ném một vật từ mặt đất với vận tốc 20 m/s, góc 30° so với phương ngang. Tính tầm xa._ và xem lời giải." | thấy kết quả tầm xa trong Lời giải                | 6 ph   |
| B4  | "Bài **Ném xiên**: tìm góc ném cho **tầm xa lớn nhất**."                                                                 | thử thách tương ứng báo hoàn thành                | 6 ph   |
| B5  | "Bạn hãy **lưu** bài đang làm thành tệp, rồi **xuất ảnh** để dán vào báo cáo."                                           | có tệp `.stemsim` và tệp PNG                      | 4 ph   |
| B6  | "Bạn hãy lấy **số liệu** của đồ thị ra bảng tính." (cần chuyển sang chế độ Nâng cao)                                     | có tệp CSV                                        | 5 ph   |

Nếu người thử kẹt quá 3 phút: gợi ý **một** câu ngắn, ghi lại "có gợi ý" và nội dung gợi ý.

## 4. Phiếu quan sát (người quan sát điền, mỗi người thử một tờ)

Mã người thử: `____` · Nhóm: A / B · Ngày: `____` · Máy / màn hình: `____`

| Nhiệm vụ | Kết quả (✔ tự làm được / ◐ có gợi ý / ✘ không xong) | Thời gian (phút:giây) | Chỗ vướng (bấm nhầm đâu, dừng lâu ở đâu) | Câu nói đáng chú ý |
| -------- | --------------------------------------------------- | --------------------- | ---------------------------------------- | ------------------ |
|          |                                                     |                       |                                          |                    |

Ghi **đúng điều quan sát được** ("bấm vào chữ Thẻ Khoa học 3 lần, tưởng là nút"), không ghi suy đoán
("chắc em ấy không hiểu vật lý").

## 5. Phiếu khảo sát sau buổi thử (người thử tự điền, khoảng 5 phút)

### 5a. Thang SUS (10 câu)

Thang đo khả năng sử dụng SUS (System Usability Scale, Brooke 1996). Mỗi câu chọn 1 = _Rất không
đồng ý_ … 5 = _Rất đồng ý_. Bản tiếng Việt dưới đây là bản dịch của dự án, **chưa được kiểm định**;
khi báo cáo cần ghi rõ điều này.

1. Tôi nghĩ tôi sẽ muốn dùng phần mềm này thường xuyên.
2. Tôi thấy phần mềm phức tạp một cách không cần thiết.
3. Tôi thấy phần mềm dễ dùng.
4. Tôi nghĩ tôi cần người rành kỹ thuật giúp thì mới dùng được.
5. Tôi thấy các chức năng của phần mềm gắn kết với nhau tốt.
6. Tôi thấy phần mềm có quá nhiều chỗ không nhất quán.
7. Tôi nghĩ hầu hết mọi người sẽ học cách dùng phần mềm này rất nhanh.
8. Tôi thấy phần mềm rất rườm rà, khó thao tác.
9. Tôi cảm thấy tự tin khi dùng phần mềm.
10. Tôi phải học nhiều thứ trước khi dùng được phần mềm này.

**Cách tính điểm (0–100):** câu lẻ (1, 3, 5, 7, 9): lấy điểm − 1; câu chẵn (2, 4, 6, 8, 10): lấy
5 − điểm; cộng cả 10 số rồi nhân 2,5. Điểm SUS **không phải phần trăm**. Tham khảo thường dùng: điểm
trung bình của nhiều nghiên cứu khoảng 68 (Sauro & Lewis, _Quantifying the User Experience_).

Nếu thời gian rất ít (ví dụ học sinh mệt), được dùng **bản rút gọn** gồm câu 3 và câu 9 và báo cáo
riêng từng câu (trung bình 1–5) — **không** quy đổi bản rút gọn ra điểm SUS.

### 5b. Câu hỏi riêng (1–5)

- Mô phỏng giúp tôi hiểu bài hơn so với chỉ đọc sách. (1–5)
- Lời giải / gợi ý từng bước dễ hiểu. (1–5)
- (Chỉ nhóm A) Chữ và nút đủ to, dễ đọc. (1–5)
- (Chỉ nhóm B) Phần kết nối AI (lấy key) rõ ràng. (1–5)

### 5c. Câu hỏi mở

1. Chỗ nào làm bạn **khó chịu** hoặc bối rối nhất?
2. Bạn thích điều gì nhất?
3. Nếu được sửa **một** điều, bạn sẽ sửa gì?
4. Bạn có muốn dùng phần mềm này để ôn bài không? Vì sao?

Sau khi có AI Teacher (T5), thêm câu "Cảm giác như đang học với thầy/cô thật" (1–5) và câu hỏi mở về
giọng nói.

## 6. Sau buổi thử

- Tổng hợp ngay trong ngày (trí nhớ còn mới). Phiếu giấy cất riêng; chỉ chép **mã người thử** và kết
  quả vào bảng dưới, không chép tên.
- Mỗi chỗ vướng gặp ở **từ 2 người trở lên** → ghi vào bảng "Việc cần sửa", kèm mức: cao (không làm
  được nhiệm vụ) / vừa (làm được nhưng chậm, có gợi ý) / thấp (khó chịu nhỏ).
- Sửa xong, lần thử sau kiểm tra lại đúng nhiệm vụ đó.
- Nhóm A: em nào muốn **dừng** thì dừng ngay, không cần lý do, và bỏ phiếu của em đó khỏi kết quả.
  Thời gian giữ phiếu đồng ý và phiếu giấy, cách hủy: **cần nhà trường / phụ huynh xác nhận** (dự án
  không tự quyết định điểm pháp lý này — xem `docs/LEGAL_COMPLIANCE.md`).

## 7. Kết quả

_Chưa có buổi thử nghiệm nào. Điền bảng dưới sau mỗi buổi; giữ lại kết quả các lần trước để so sánh._

### Lần 1 — ngày `____`, phiên bản app `____`

| Nhóm | Số người | Tỉ lệ hoàn thành (✔ / ◐ / ✘) | Thời gian trung vị mỗi nhiệm vụ | SUS trung bình (thấp nhất – cao nhất) |
| ---- | -------- | ---------------------------- | ------------------------------- | ------------------------------------- |
| A    |          |                              |                                 |                                       |
| B    |          |                              |                                 |                                       |

**Việc cần sửa**

| Chỗ vướng | Gặp ở (mã người thử) | Mức | Đã sửa ở phiên bản |
| --------- | -------------------- | --- | ------------------ |
|           |                      |     |                    |

**Câu nói đáng chú ý** (giữ nguyên lời, kèm mã người thử):

-
