# Danh sách dữ liệu chờ giáo viên duyệt

Mọi dữ liệu khoa học trong app (hằng số, nguyên tố, phản ứng, cơ chế, bảng mã di truyền…) đều có
trường `review_status`. Mục `pending` hiển thị huy hiệu **"Đang chờ giáo viên duyệt"** trong app.

## Cách duyệt

1. Giáo viên đối chiếu từng mục với nguồn được ghi kèm.
2. Nếu đúng: đổi `review_status` thành `"verified"`, điền tên người duyệt và ngày duyệt vào bảng
   dưới đây.
3. Nếu sai hoặc còn nghi ngờ: ghi chú vào cột "Ghi chú". Không sửa số liệu khi chưa có nguồn.

## Mục đang chờ duyệt

| #      | Loại               | Mục                                                                                                                                                                                                                            | File                                                       | Nguồn                                                              | Trạng thái | Người duyệt | Ngày | Ghi chú                                                                               |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | ----------- | ---- | ------------------------------------------------------------------------------------- |
| –      | –                  | Giai đoạn 0 chưa có dữ liệu khoa học                                                                                                                                                                                           | –                                                          | –                                                                  | –          | –           | –    | –                                                                                     |
| M3D-1  | Mô tả kì (3D)      | Kì trung gian G1 — động vật: "NST dãn xoắn, mỗi NST là 1 phân tử ADN; 1 trung thể (2 trung tử) cạnh nhân"; thực vật: "có thành tế bào cứng, không có trung thể"                                                                | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-2  | Mô tả kì (3D)      | Kì trung gian G2 — "mỗi NST gồm 2 cromatit chị em dính ở tâm động"; động vật: "trung thể cũng đã nhân đôi"                                                                                                                     | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Trung thể nhân đôi trong pha S/G2                                                     |
| M3D-3  | Mô tả kì (3D)      | Kì đầu — động vật: "NST kép co xoắn dần; màng nhân tiêu biến; hai trung thể đi về hai cực, thoi phân bào hình thành"; thực vật: "thoi phân bào hình thành từ hai vùng cực (không có trung thể)"                                | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Không vẽ nhân con, băng trước kì đầu (thực vật)                                       |
| M3D-4  | Mô tả kì (3D)      | Kì giữa — "NST kép co xoắn cực đại, tập trung thành 1 hàng ở mặt phẳng xích đạo; tâm động của mỗi NST đính với sợi thoi từ cả hai cực"                                                                                         | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | NST di chuyển về mặt phẳng xích đạo ở đầu kì giữa (tiền kì giữa gộp vào), xem TODO 15 |
| M3D-5  | Mô tả kì (3D)      | Kì sau — "hai cromatit chị em tách nhau ở tâm động, thành 2 NST đơn đi về hai cực"; động vật: "tế bào dài ra"; thực vật: "thành tế bào giữ nguyên hình dạng tế bào"                                                            | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-6  | Mô tả kì (3D)      | Kì cuối — "NST dãn xoắn; màng nhân hình thành lại quanh mỗi bộ NST: 1 tế bào có 2 nhân; thoi phân bào tiêu biến"                                                                                                               | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Quy ước đếm: 1 tế bào, 2 nhân, mỗi nhân 2n NST đơn (cả tế bào 4n), xem TODO 15        |
| M3D-7  | Mô tả kì (3D)      | Phân chia tế bào chất — động vật: "vòng co thắt màng ở mặt phẳng xích đạo (rãnh phân cắt)"; thực vật: "tấm tế bào lớn dần từ giữa ra tới thành tế bào, thành vách ngăn"; "2 tế bào con, mỗi tế bào 2n NST đơn giống tế bào mẹ" | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Tách thành bước riêng sau kì cuối, xem TODO 15                                        |
| M3D-8  | Thẻ Khoa học (3D)  | Giả thiết của `card3d()`: kích thước, vị trí, thời gian minh họa; số lượng chính xác; phân chia tế bào chất thường bắt đầu từ cuối kì sau/kì cuối; tiền kì giữa                                                                | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-9  | Bảng số lượng (3D) | Cột "Số nhân / tế bào" (1; 1; 1 → 0; 0; 0; 0 → 2; 2 → 1) và dòng "Phân chia tế bào chất" (số liệu cho mỗi tế bào con)                                                                                                          | `src/biology/division/mitosis3d/timeline.ts`, `panels.tsx` | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Đọc từ hình học của mô hình 3D, không nhập tay                                        |
| M3D-10 | Bộ phận tế bào     | Màng tế bào — "ngăn cách tế bào với môi trường và kiểm soát các chất ra vào"                                                                                                                                                   | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-11 | Bộ phận tế bào     | Nhân tế bào — "chứa vật chất di truyền (ADN, ở kì trung gian dưới dạng sợi nhiễm sắc) và điều khiển hoạt động của tế bào"                                                                                                      | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-12 | Bộ phận tế bào     | Màng nhân — "màng kép; tiêu biến ở kì đầu, hình thành lại quanh mỗi bộ NST ở kì cuối"                                                                                                                                          | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-13 | Bộ phận tế bào     | Sợi nhiễm sắc — "NST dạng sợi mảnh dãn xoắn, nhờ đó ADN có thể nhân đôi và phiên mã"                                                                                                                                           | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-14 | Bộ phận tế bào     | Nhiễm sắc thể kép — "NST đã nhân đôi ở pha S, gồm 2 cromatit chị em giống hệt nhau dính ở tâm động"                                                                                                                            | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-15 | Bộ phận tế bào     | Cromatit chị em — "một trong hai nửa giống hệt nhau của NST kép (mỗi cromatit là một phân tử ADN); tách nhau ở kì sau"                                                                                                         | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-16 | Bộ phận tế bào     | Nhiễm sắc thể đơn — "gồm 1 phân tử ADN; có ở pha G1 và sau khi cromatit chị em tách nhau"                                                                                                                                      | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-17 | Bộ phận tế bào     | Tâm động — "vùng thắt nơi 2 cromatit chị em dính nhau; sợi thoi bám vào (tại thể động) để kéo NST về các cực"                                                                                                                  | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Thuật ngữ "thể động" (kinetochore) cần xác nhận theo SGK                              |
| M3D-18 | Bộ phận tế bào     | Thoi phân bào — "hệ vi ống hình thành ở kì đầu, đính vào tâm động, kéo NST về hai cực; tiêu biến ở kì cuối"                                                                                                                    | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-19 | Bộ phận tế bào     | Trung thể (chỉ động vật) — "chứa một cặp trung tử; nhân đôi ở kì trung gian; hai trung thể về hai cực và tổ chức thoi phân bào"                                                                                                | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-20 | Bộ phận tế bào     | Thành tế bào (chỉ thực vật) — "lớp vỏ cứng (chủ yếu là cellulose), giữ hình dạng tế bào nên tế bào không thắt eo được"                                                                                                         | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-21 | Bộ phận tế bào     | Rãnh phân cắt (chỉ động vật) — "vòng co gồm các sợi actin và myosin thắt dần màng ở mặt phẳng xích đạo"                                                                                                                        | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                     |
| M3D-22 | Bộ phận tế bào     | Vách ngăn / tấm tế bào (chỉ thực vật) — "các túi từ bộ máy Golgi tập trung ở mặt phẳng xích đạo, hợp lại thành tấm tế bào lớn dần từ giữa ra và trở thành vách ngăn"                                                           | `src/biology/division/mitosis3d/components.ts`             | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Không vẽ thể dẫn (phragmoplast)                                                       |

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
14. **Thư viện kiến thức có sẵn của Thầy AI** (`src/teacher/chat/knowledge.ts`, `STARTER`): 66 ghi
    chú ngắn về Vật lý, Hóa học, Sinh học THPT (công thức, định luật, khái niệm), do AI viết khi làm
    bản Thầy AI, **chưa có nguồn cụ thể** (trường `source` chỉ là tên chủ đề) và chưa ai duyệt. Mọi
    ghi chú đang `reviewStatus: 'pending'`: khi gửi cho AI, mỗi ghi chú kèm câu "chưa được giáo viên
    duyệt", và Cài đặt → Thư viện kiến thức ghi rõ số ghi chú đang chờ duyệt. Nhờ giáo viên đọc từng ghi chú,
    sửa câu sai, thêm nguồn (sách, trang), rồi đổi ghi chú đó thành `'verified'`.
15. **Nguyên phân 3D** (`src/biology/division/mitosis3d/`, mục M3D-1 … M3D-22 ở bảng trên): mô tả
    các kì, chức năng của 13 bộ phận tế bào và Thẻ Khoa học do AI viết theo SGK Sinh học 10 và
    Campbell Biology, `review_status: "pending"`. Số lượng NST, cromatit, tâm động, ADN luôn đếm từ
    mô hình `runDivision` (không nhập tay); kích thước, vị trí, thời gian là minh họa. Các điểm cần
    giáo viên xác nhận:
    - NST di chuyển về mặt phẳng xích đạo ở **đầu kì giữa** (Campbell tách thành "tiền kì giữa";
      SGK chia 4 kì). Sợi thoi đính vào tâm động cũng được vẽ ở đầu kì giữa.
    - **Phân chia tế bào chất** được vẽ thành bước riêng sau kì cuối; trong tế bào thật nó thường
      bắt đầu từ cuối kì sau hoặc kì cuối (Thẻ Khoa học có ghi).
    - **Quy ước đếm kì cuối (bản 3D):** 1 tế bào có 2 nhân, mỗi nhân 2n NST đơn, cả tế bào 4n NST
      đơn; bảng 2D cũ ghi kì cuối theo mỗi tế bào con (2n). Một số tài liệu chỉ dùng một trong hai
      cách.
    - Không vẽ nhân con, băng trước kì đầu và thể dẫn (phragmoplast) của tế bào thực vật; thoi phân
      bào thực vật vẽ từ hai vùng cực rộng (không có trung thể).
    - Tế bào động vật ở G1 có 1 trung thể (gồm 2 trung tử), nhân đôi thành 2 trung thể ở G2.
