# Danh sách dữ liệu chờ giáo viên duyệt

Mọi dữ liệu khoa học trong app (hằng số, nguyên tố, phản ứng, cơ chế, bảng mã di truyền…) đều có
trường `review_status`. Mục `pending` hiển thị huy hiệu **"Đang chờ giáo viên duyệt"** trong app.

## Cách duyệt

1. Giáo viên đối chiếu từng mục với nguồn được ghi kèm.
2. Nếu đúng: đổi `review_status` thành `"verified"`, điền tên người duyệt và ngày duyệt vào bảng
   dưới đây.
3. Nếu sai hoặc còn nghi ngờ: ghi chú vào cột "Ghi chú". Không sửa số liệu khi chưa có nguồn.

## Mục đang chờ duyệt

| #   | Loại | Mục                                  | File | Nguồn | Trạng thái | Người duyệt | Ngày | Ghi chú |
| --- | ---- | ------------------------------------ | ---- | ----- | ---------- | ----------- | ---- | ------- |
| –   | –    | Giai đoạn 0 chưa có dữ liệu khoa học | –    | –     | –          | –           | –    | –       |

## Điểm khoa học chưa chắc chắn (TODO)

Khi viết code mà gặp giá trị, phản ứng hay cơ chế không chắc chắn, Claude ghi vào đây thay vì tự
đoán.

1. **Giá trị g mặc định.** MASTER_PROMPT dùng 9,81 m/s² trong ví dụ, nên app đang để mặc định là
   9,81. Trong khi đó SGK Việt Nam thường dùng 9,8 hoặc 10 m/s². Giá trị chuẩn quốc tế là
   gₙ = 9,80665 m/s², chính xác theo định nghĩa của CGPM năm 1901. Người dùng đổi được trong
   Cài đặt → Vật lý. **Nhờ giáo viên chọn giá trị mặc định phù hợp.** Dù chọn giá trị nào, g lấy
   theo mặc định luôn được gắn nhãn "mặc định". Khi đề bài cho g, app luôn dùng giá trị của đề.

2. **Bảng cụm từ "nói bằng lời" của AI đọc đề** (`src/ai/draft.ts`, hằng `IMPLIED`). Ví dụ: "thả
   nhẹ", "từ trạng thái nghỉ" → vận tốc đầu = 0; "không ma sát", "nhẵn" → μ = 0; "đàn hồi" → e = 1;
   "va chạm mềm", "dính vào nhau" → e = 0; "ném ngang" → góc = 0. Đây là quy ước ngôn ngữ trong đề
   Vật lí THPT, cần giáo viên xác nhận. Lưu ý: "va chạm đàn hồi" trong SGK THPT hiểu là hoàn toàn
   đàn hồi (e = 1). `review_status: "pending"`.

3. **Dữ liệu 118 nguyên tố** (`data/elements.json`, sinh từ `mendeleev`): nguyên tử khối,
   độ âm điện, bán kính, cấu hình electron, năng lượng ion hóa. Nhờ giáo viên đối chiếu các nguyên
   tố thường gặp trong đề thi (Z = 1–30, Br, Ag, I, Ba, Au, Hg, Pb). Tên tiếng Việt cũ (natri,
   kali, sắt…) là bí danh để tìm kiếm.
4. **Hình học thực nghiệm dùng làm tọa độ** (`scripts/data/gen_molecules.py`, `EXPERIMENTAL`):
   H₂ 0,741; N₂ 1,098; O₂ 1,208; F₂ 1,412; Cl₂ 1,988; HF 0,917; HCl 1,275; HBr 1,414; CO 1,128;
   CO₂ 1,160 Å; SO₂ 1,431 Å/119,3°; O₃ 1,278 Å/116,8°; SO₃ 1,418 Å; BF₃ 1,307 Å. Cần đối chiếu
   với NIST CCCBDB (đặc biệt O₃ và SO₃).
5. **Giá trị tham chiếu dùng để kiểm tra trường lực** (`REFERENCE`): H₂O 0,958 Å/104,5°;
   NH₃ 1,012 Å/106,7°; CH₄ 1,087 Å; C₂H₄ C=C 1,339 Å, C–H 1,086 Å, H–C–H 117,4°;
   C₂H₂ 1,203 Å; C₆H₆ 1,397 Å; HCN C≡N 1,153 Å; C₂H₆ C–C 1,535 Å.
6. **Ngưỡng Δχ phân loại liên kết** (0,4 và 1,7) theo quy ước SGK Hóa 10 — cần xác nhận với bộ
   sách đang dùng.
7. **Thư viện 39 phản ứng** (`scripts/data/gen_reactions.py`): điều kiện, hiện tượng, nguồn
   (chưa ghi số trang). Đặc biệt nhờ kiểm tra: điều kiện Haber (400–450 °C, 200 bar), phương pháp
   tiếp xúc (V₂O₅, 450 °C), Ostwald (Pt, ~850 °C), lên men (30–35 °C), và 10 cơ chế (các bước,
   mũi tên electron).
8. **Bảng mã di truyền** (`data/genetic_code.json`, NCBI bảng 1 qua Biopython): 64 bộ ba, kí
   hiệu 3 chữ (Met, Phe…) và tên tiếng Anh. Chưa có tên axit amin tiếng Việt — cần giáo viên cung
   cấp cách viết theo SGK nếu muốn hiển thị. Bảng này không áp dụng cho ti thể.
9. **Bảng số lượng ở các kì phân bào** (được đếm từ mô hình, không nhập tay): quy ước "NST đơn có
   0 cromatit" và "ở kì sau nguyên phân mỗi tế bào có 4n NST đơn" theo SGK Sinh học 10 — nhờ giáo
   viên xác nhận quy ước đếm (một số tài liệu đếm theo "mỗi cực").
10. **Tên các kiểu ức chế enzyme**: "không cạnh tranh" (noncompetitive) và "phi cạnh tranh"
    (uncompetitive) — thuật ngữ tiếng Việt chưa thống nhất giữa các tài liệu.
11. **Nguồn sinh học** (`src/biology/common.ts`, `BSRC`): chưa ghi số trang, lần xuất bản.
12. **Xếp chủ đề theo trình độ và chương trình học** (`src/app/levels.ts`, `CURRICULUM_MAPPING`):
    hiện mọi chủ đề đều nằm ở trình độ **Nền tảng** (tương đương THPT); trình độ **Đại cương** chưa
    có chủ đề. Việc ghép từng chủ đề với lớp/bài cụ thể trong chương trình GDPT 2018 hoặc sách giáo
    khoa **chưa được điền** — app không tự đoán. `review_status: "pending"`. Nhờ giáo viên điền
    (ví dụ "Ném xiên → Vật lí 10, …") và xác nhận việc xếp trình độ.
13. **Thử thách và câu hỏi "Dự đoán trước"** (`src/learn/challenges.ts`, `src/learn/poe.ts`): mục
    tiêu của thử thách (ví dụ "rơi đúng 2 s", "tầm xa 40 m") do người viết chọn, nhưng **đáp án và
    việc đúng/sai đều do chương trình tính** bằng `solve()` của từng cảnh; test chứng minh mọi mục
    tiêu đạt được trong khoảng thanh trượt (với g = 9,8; 9,81; 10). Đáp án đúng của câu dự đoán
    cũng được tính, không viết tay. Nhờ giáo viên duyệt cách diễn đạt câu hỏi và gợi ý cho hợp với
    học sinh. `review_status: "pending"`.
