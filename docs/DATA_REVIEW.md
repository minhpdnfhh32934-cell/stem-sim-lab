# Danh sách dữ liệu chờ giáo viên duyệt

Mọi dữ liệu khoa học trong app (hằng số, nguyên tố, phản ứng, cơ chế, bảng mã di truyền…) đều có
trường `review_status`. Mục `pending` hiển thị huy hiệu **"Đang chờ giáo viên duyệt"** trong app.

## Cách duyệt

1. Giáo viên đối chiếu từng mục với nguồn được ghi kèm.
2. Nếu đúng: đổi `review_status` thành `"verified"`, điền tên người duyệt và ngày duyệt vào bảng
   dưới đây.
3. Nếu sai hoặc còn nghi ngờ: ghi chú vào cột "Ghi chú". Không sửa số liệu khi chưa có nguồn.

## Mục đang chờ duyệt

| #      | Loại               | Mục                                                                                                                                                                                                                                                 | File                                                                    | Nguồn                                                              | Trạng thái | Người duyệt | Ngày | Ghi chú                                                                                                                         |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- | ----------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| –      | –                  | Giai đoạn 0 chưa có dữ liệu khoa học                                                                                                                                                                                                                | –                                                                       | –                                                                  | –          | –           | –    | –                                                                                                                               |
| M3D-1  | Mô tả kì (3D)      | Kì trung gian G1 — động vật: "NST dãn xoắn, mỗi NST là 1 phân tử ADN; 1 trung thể (2 trung tử) cạnh nhân"; thực vật: "có thành tế bào cứng, không có trung thể"                                                                                     | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-2  | Mô tả kì (3D)      | Kì trung gian G2 — "mỗi NST gồm 2 cromatit chị em dính ở tâm động"; động vật: "trung thể cũng đã nhân đôi"                                                                                                                                          | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | ADN và trung thể nhân đôi trong pha S; pha S không vẽ thành bước riêng (G2 bắt đầu với NST kép, 2 trung thể), xem TODO 15       |
| M3D-3  | Mô tả kì (3D)      | Kì đầu — động vật: "NST kép co xoắn dần; nhân con và màng nhân tiêu biến; hai trung thể đi về hai cực và thoi phân bào hình thành giữa chúng"; thực vật: "thoi phân bào hình thành từ hai vùng cực (không có trung thể)"                            | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Nhân con mờ dần đầu kì đầu; màng nhân tiêu biến trước khi sợi thoi vào vùng nhân (test). Không vẽ băng trước kì đầu (thực vật)  |
| M3D-4  | Mô tả kì (3D)      | Kì giữa — "NST kép co xoắn cực đại, tập trung thành 1 hàng ở mặt phẳng xích đạo; tâm động của mỗi NST đính với sợi thoi từ cả hai cực"; NST từ mẹ và từ bố xếp xen kẽ (minh họa)                                                                    | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | NST được sợi thoi kéo về mặt phẳng xích đạo ở đầu kì giữa (sợi thoi đính vào tâm động trước; tiền kì giữa gộp vào), xem TODO 15 |
| M3D-5  | Mô tả kì (3D)      | Kì sau — "hai cromatit chị em tách nhau ở tâm động, thành 2 NST đơn đi về hai cực"; động vật: "tế bào dài ra"; thực vật: "thành tế bào giữ nguyên hình dạng tế bào"                                                                                 | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-6  | Mô tả kì (3D)      | Kì cuối — "NST dãn xoắn; thoi phân bào tiêu biến; màng nhân và nhân con hình thành lại quanh mỗi bộ NST: 1 tế bào có 2 nhân"                                                                                                                        | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Quy ước đếm: 1 tế bào, 2 nhân, mỗi nhân 2n NST đơn (cả tế bào có 4n NST đơn), xem TODO 15                                       |
| M3D-7  | Mô tả kì (3D)      | Phân chia tế bào chất — động vật: "vòng co thắt màng ở mặt phẳng xích đạo (rãnh phân cắt)"; thực vật: "tấm tế bào lớn dần từ giữa ra tới thành tế bào, thành vách ngăn"; "2 tế bào con, mỗi tế bào 2n NST đơn giống tế bào mẹ"                      | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Tách thành bước riêng sau kì cuối, xem TODO 15                                                                                  |
| M3D-8  | Thẻ Khoa học (3D)  | Giả thiết của `card3d()`: kích thước, vị trí, thời gian minh họa; số lượng chính xác; hình 3D chỉ vẽ cho 2n = 2–8; nhân con vẽ đơn giản; pha S không vẽ thành bước riêng; phân chia tế bào chất thường bắt đầu từ cuối kì sau/kì cuối; tiền kì giữa | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Độ tin cậy ghi "exact" (số lượng) dù hình là minh họa: nhờ giáo viên quyết định, xem TODO 15                                    |
| M3D-9  | Bảng số lượng (3D) | Cột "Số nhân / tế bào" (1; 1; 1 → 0; 0; 0; 0 → 2; 2 → 1), dòng "Phân chia tế bào chất" (số liệu cho mỗi tế bào con) và chú thích "cả tế bào có 4n NST đơn"                                                                                          | `src/biology/division/mitosis3d/timeline.ts`, `panels.tsx`              | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Đọc từ hình học của mô hình 3D, không nhập tay                                                                                  |
| M3D-10 | Bộ phận tế bào     | Màng tế bào — "ngăn cách tế bào với môi trường và kiểm soát các chất ra vào"                                                                                                                                                                        | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-11 | Bộ phận tế bào     | Nhân tế bào — "chứa vật chất di truyền (ADN, ở kì trung gian dưới dạng chất nhiễm sắc) và điều khiển mọi hoạt động của tế bào"                                                                                                                      | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-12 | Bộ phận tế bào     | Màng nhân — "màng kép; tiêu biến ở kì đầu, hình thành lại quanh mỗi bộ NST ở kì cuối"                                                                                                                                                               | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-13 | Bộ phận tế bào     | Chất nhiễm sắc (NST dãn xoắn) — "ở kì trung gian, NST ở dạng sợi mảnh dãn xoắn, nhờ đó ADN có thể nhân đôi và phiên mã"                                                                                                                             | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Tên cũ "sợi nhiễm sắc" (SGK 12: mức xoắn sợi 30 nm); SGK 10 gọi là "chất nhiễm sắc"                                             |
| M3D-14 | Bộ phận tế bào     | Nhiễm sắc thể kép — "NST đã nhân đôi ở pha S, gồm 2 cromatit chị em giống hệt nhau dính ở tâm động"                                                                                                                                                 | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-15 | Bộ phận tế bào     | Cromatit chị em — "một trong hai nửa giống hệt nhau của NST kép (mỗi cromatit là một phân tử ADN); tách nhau ở kì sau"                                                                                                                              | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-16 | Bộ phận tế bào     | Nhiễm sắc thể đơn — "gồm 1 phân tử ADN; có ở pha G1 và sau khi cromatit chị em tách nhau"                                                                                                                                                           | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-17 | Bộ phận tế bào     | Tâm động — "vùng thắt trên NST; ở NST kép, 2 cromatit chị em dính nhau tại tâm động; từ kì sau, tâm động tách ra, mỗi NST đơn có tâm động riêng; sợi thoi đính vào tâm động (tại thể động)"                                                         | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Thuật ngữ "thể động" (kinetochore) cần xác nhận theo SGK                                                                        |
| M3D-18 | Bộ phận tế bào     | Thoi phân bào — "hệ vi ống hình thành ở kì đầu; chỉ một số sợi thoi đính vào tâm động (tại thể động) và kéo NST về hai cực, các sợi còn lại không gắn với NST; tiêu biến ở kì cuối"                                                                 | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-19 | Bộ phận tế bào     | Trung thể (chỉ động vật) — "chứa một cặp trung tử; nhân đôi ở kì trung gian; hai trung thể về hai cực và tổ chức thoi phân bào"                                                                                                                     | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-20 | Bộ phận tế bào     | Thành tế bào (chỉ thực vật) — "lớp vỏ cứng (chủ yếu là cellulose), giữ hình dạng tế bào nên tế bào không thắt eo được"                                                                                                                              | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | –                                                                                                                               |
| M3D-21 | Bộ phận tế bào     | Vòng co (rãnh phân cắt) (chỉ động vật) — "vòng co gồm các sợi actin và myosin thắt dần màng ở mặt phẳng xích đạo"                                                                                                                                   | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Phần được tô sáng là vòng co; rãnh phân cắt là chỗ màng lõm vào                                                                 |
| M3D-22 | Bộ phận tế bào     | Vách ngăn / tấm tế bào (chỉ thực vật) — "các túi từ bộ máy Golgi tập trung ở mặt phẳng xích đạo, hợp lại thành tấm tế bào lớn dần từ giữa ra và trở thành vách ngăn"                                                                                | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Không vẽ thể dẫn (phragmoplast)                                                                                                 |
| M3D-23 | Bộ phận tế bào     | Nhân con — "vùng đậm đặc trong nhân, nơi tổng hợp rARN và lắp ráp ribosome; tiêu biến ở kì đầu và xuất hiện lại ở kì cuối"                                                                                                                          | `src/biology/division/mitosis3d/components.ts`                          | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Vẽ đơn giản (một khối trong nhân), không ảnh hưởng số lượng                                                                     |
| M3D-24 | Chú thích màu      | "NST nguồn gốc từ mẹ / từ bố" (bản 3D và bản 2D)                                                                                                                                                                                                    | `src/biology/division/mitosis3d/Mitosis3DView.tsx`, `DivisionViews.tsx` | SGK Sinh học 10 (`BSRC.sgk10`); Campbell Biology (`BSRC.campbell`) | pending    | –           | –    | Tránh nhầm với "tế bào mẹ" trong mô tả các kì                                                                                   |
| PRON-1 | Cách đọc           | 42 tên riêng và từ mượn trong từ điển phát âm của giọng thầy (Vôn, Héc, Men-đê-lê-ép, Lơ Sa-tơ-li-ê, en-zim, prô-tê-in…)                                                                                                                            | `src/teacher/voice/pronunciations.json`                                 | Cách phiên âm thường gặp trong SGK                                 | pending    | –           | –    | Chỉ là cách đọc: không chứa số, đơn vị hay công thức (test)                                                                     |
| PRON-2 | Cách đọc           | Giọng thầy đọc chiều mạch ADN "5′ → 3′" là "năm phẩy đến ba phẩy" (không đọc mũi tên là "suy ra"); "3′"/"5′" đứng riêng trong bài về ADN/ARN là "ba phẩy"/"năm phẩy"; khoảng "35–40 °C", "pH 6-8" đọc "… đến …"                                     | `src/teacher/voice/vietnameseText.ts` (`readStrands`, `readRanges`)     | Cách đọc thường gặp trong lớp, chưa có giáo viên xác nhận          | pending    | –           | –    | Chỉ là cách đọc, không đổi số liệu (test `vietnameseText.test.ts`)                                                              |

## Điểm khoa học chưa chắc chắn (TODO)

Khi viết code mà gặp giá trị, phản ứng hay cơ chế không chắc chắn, Claude ghi vào đây thay vì tự
đoán.

1. **Giá trị g mặc định.** MASTER_PROMPT dùng 9,81 m/s² trong ví dụ, nên app đang để mặc định là
   9,81. Trong khi đó SGK Việt Nam thường dùng 9,8 hoặc 10 m/s². Giá trị chuẩn quốc tế là
   gₙ = 9,80665 m/s², chính xác theo định nghĩa của CGPM năm 1901. Người dùng đổi được trong
   Cài đặt → Vật lý. **Nhờ giáo viên chọn giá trị mặc định phù hợp.** Dù chọn giá trị nào, g lấy
   theo mặc định luôn được gắn nhãn "mặc định". Khi đề bài cho g, app luôn dùng giá trị của đề.

2. **Bảng cụm từ "nói bằng lời" của AI đọc đề** (`src/ai/draft.ts`, hằng `IMPLIED`). Ví dụ: "thả
   nhẹ", "từ trạng thái nghỉ" → vận tốc đầu = 0; "không ma sát", "nhẵn" → μ = 0; "va chạm đàn
   hồi", "hoàn toàn đàn hồi", "đàn hồi hoàn toàn", "đàn hồi tuyệt đối" → e = 1; "va chạm mềm",
   "dính vào nhau" → e = 0; "ném ngang" → góc = 0. Đây là quy ước ngôn ngữ trong đề Vật lí THPT,
   cần giáo viên xác nhận. Lưu ý: "va chạm đàn hồi" trong SGK THPT hiểu là hoàn toàn đàn hồi
   (e = 1). `review_status: "pending"`.
   - 0.7 (sửa lỗi): chữ "đàn hồi" đứng một mình không còn được hiểu là e = 1 ("lò xo đàn hồi",
     "va chạm không đàn hồi"). Một cụm từ chỉ được tính khi đứng nguyên cụm và **không** có từ phủ
     định ("không", "chưa", "chẳng", "chả", "not", "never") trong 3 từ đứng trước nó, cùng mệnh đề
     ("không khí", "không gian" không phải phủ định). Ví dụ "mặt bàn không nhẵn" không còn cho
     μ = 0, "không đứng yên" không còn cho v₀ = 0. Nhờ giáo viên xem danh sách cụm từ e = 1 mới và
     cách nhận phủ định. `review_status: "pending"`.

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
15. **Nguyên phân 3D** (`src/biology/division/mitosis3d/`, mục M3D-1 … M3D-24 ở bảng trên): mô tả
    các kì, chức năng của 14 bộ phận tế bào và Thẻ Khoa học do AI viết theo SGK Sinh học 10 và
    Campbell Biology, `review_status: "pending"`. Số lượng NST, cromatit, tâm động, ADN luôn đếm từ
    mô hình `runDivision` (không nhập tay); kích thước, vị trí, thời gian là minh họa. Các điểm cần
    giáo viên xác nhận:
    - NST được sợi thoi kéo về mặt phẳng xích đạo ở **đầu kì giữa** (Campbell tách thành "tiền kì
      giữa"; SGK chia 4 kì). Trong hình, sợi thoi đính vào tâm động trước, rồi mới kéo NST đi (test
      tự động kiểm tra: NST nào đã rời chỗ cũ thì đã có sợi thoi từ cả hai cực đính vào).
    - **Phân chia tế bào chất** được vẽ thành bước riêng sau kì cuối; trong tế bào thật nó thường
      bắt đầu từ cuối kì sau hoặc kì cuối (Thẻ Khoa học có ghi).
    - **Quy ước đếm kì cuối (bản 3D):** 1 tế bào có 2 nhân, mỗi nhân 2n NST đơn, cả tế bào có 4n
      NST đơn; bảng 2D cũ ghi kì cuối theo mỗi tế bào con (2n). Một số tài liệu chỉ dùng một trong hai
      cách.
    - **Nhân con** được vẽ đơn giản (một khối trong nhân): mờ dần ở đầu kì đầu, xuất hiện lại ở
      cuối kì cuối; không ảnh hưởng số lượng (Thẻ Khoa học có ghi). Không vẽ băng trước kì đầu và
      thể dẫn (phragmoplast) của tế bào thực vật; thoi phân bào thực vật vẽ từ hai vùng cực rộng
      (không có trung thể).
    - **Thời điểm ở kì đầu và kì cuối (minh họa):** màng nhân tiêu biến (độ đậm dưới 0,5 từ 37,5 %
      thời gian kì đầu) trước khi sợi thoi kịp đi vào vùng nhân; ở kì cuối thoi phân bào tiêu biến
      xong trước khi màng nhân mới hình thành. Test tự động: không sợi thoi nào đi qua một nhân còn
      màng (độ đậm ≥ 0,5), ở mọi thời điểm.
    - **Mặt phẳng xích đạo:** NST từ mẹ và từ bố xếp xen kẽ, NST tương đồng không đứng cạnh nhau khi
      đủ chỗ (2n = 8). Đây là minh họa: trong nguyên phân các NST tương đồng không bắt cặp và vị trí
      thật là ngẫu nhiên (bản cũ chia nửa vòng mẹ, nửa vòng bố — dễ hiểu nhầm là có quy luật).
    - **Hình 3D chỉ vẽ cho 2n = 2–8** (bộ chọn 2n). Với 2n = 46, các NST chồng lên nhau (ở kì giữa
      hai tâm động gần nhất chỉ cách 0,68 đơn vị); số lượng của 2n = 46 vẫn được test tự động.
    - **Từ ngữ cần xác nhận:** "Chất nhiễm sắc (NST dãn xoắn)" (trước là "sợi nhiễm sắc" — SGK 12
      dùng từ này cho sợi 30 nm); chú thích màu "NST nguồn gốc từ mẹ / từ bố" (tránh nhầm với "tế
      bào mẹ"); "Vòng co (rãnh phân cắt)" (phần được tô sáng là vòng co); chú thích bảng "cả tế bào
      có 4n NST đơn" (không phải tế bào tứ bội); thoi phân bào: chỉ sợi thể động đính vào tâm động;
      tâm động: mô tả đúng cả sau khi tách ở kì sau.
    - **Độ tin cậy của Thẻ Khoa học:** ghi "exact" vì mọi số lượng đếm từ mô hình; hình là minh
      họa và quy ước kì cuối còn chờ duyệt. Nhờ giáo viên quyết định có giữ "exact" không.
    - Tế bào động vật ở G1 có 1 trung thể (gồm 2 trung tử). Trung thể nhân đôi trong **pha S**,
      cùng lúc với ADN (khớp ghi chú M3D-2), nên ở G2 tế bào đã có 2 trung thể.
    - **Pha S không vẽ thành bước riêng:** mô hình `runDivision` không có kì S (nó dựng G2 bằng cách
      nhân đôi G1), và một tế bào đang nhân đôi dở không có số đếm theo bảng SGK. Vì vậy hình cho
      thấy kết quả của pha S ngay từ đầu bước G2: mỗi NST đã là NST kép, tế bào động vật đã có 2
      trung thể; trong bước G2 không còn gì nhân đôi hay tách ra. Thẻ Khoa học có ghi giả thiết này.
    - Dòng số lượng ở kì cuối (bản 3D) đổi theo hình: trước khi màng nhân hình thành lại, chip ghi
      "1 tế bào · 4n NST đơn · đang hình thành 2 nhân"; khi đã có 2 màng nhân, "1 tế bào · 2 nhân ·
      mỗi nhân 2n NST đơn" (số đếm từ mô hình). Nhờ giáo viên xác nhận cách diễn đạt.
16. **Bộ 42 câu đánh giá cách giảng** (`tests/teaching/teaching-eval.json`, đợt audit 13/10/2026,
    thêm 12 câu ngày 14/10/2026): 14 câu mỗi môn Vật lý / Hóa học / Sinh học, mỗi câu có "ý chính
    phải có" (`keyFacts`, viết dưới dạng mẫu chữ) và "điều không được nói" (`mustNot`). Do Claude
    viết, `review_status: "pending"` (cả bộ và từng câu mới). Tỉ lệ "ý chính đúng" trong
    `docs/AUDIT_2026-10-13.md` chỉ có ý nghĩa khi các mẫu này đúng — nhờ giáo viên kiểm tra đáp án
    và các mẫu chữ (ví dụ cách viết "2n", "NST kép").
    - **12 câu mới** (mỗi môn 2 câu thiếu dữ kiện, 1 câu giải từng bước, 1 câu "bẫy"): P11–P14,
      C11–C14, B11–B14. Câu thiếu dữ kiện ghi đại lượng còn thiếu (`missing`); câu từng bước ghi
      thứ tự các bước (`steps`); câu bẫy ghi lời sửa sai (`trap`). Nhờ giáo viên kiểm tra phần
      `derivation` (cách tính) của từng câu; máy đã tính lại các số trong
      `tests/teaching-rubric.test.ts`:
      - P13: a = 4000 N / 1000 kg = 4 m/s²; s = 20²/(2·4) = **50 m** (kiểm tra: t = 5 s; động năng
        200 000 J = 4000 N · s). Đáp án sai hay gặp: 100 m, 150 m, −50 m.
      - C13: n(Zn) = 6,5/65 = 0,1 mol; M(ZnCl₂) = 65 + 2·35,5 = 136 g/mol; m = **13,6 g**. Đáp án sai
        hay gặp: 10,05 g, 27,2 g, 6,8 g.
      - B13: A = T = 20% · 2400 = 480; G = X = 720; H = 2·480 + 3·720 = **3120** (= N + G). Đáp án
        sai hay gặp: 1560, 2880, 3840.
      - C14: 0,2 mol trong 0,2 L vẫn là 1 M.
    - **C12 cần giáo viên quyết định:** đề "Tính thể tích của 0,2 mol khí CO₂" không nói điều kiện.
      Bộ đánh giá hiện coi câu trả lời tốt là hỏi lại nhiệt độ và áp suất, và coi việc tự chọn
      điều kiện chuẩn rồi đưa ra 4,958 L (hay 4,48 L) là tự bịa số. Có chấp nhận "ngầm hiểu điều kiện
      chuẩn" không?
    - Nhờ giáo viên xác nhận ghi chú của B14: "ban ngày quang hợp thường mạnh hơn hô hấp".
    - **Sửa đáp án 14/10/2026** (sau khi đọc lại 60 câu trả lời đã lưu của Gemma 3 1B): bỏ các mẫu
      quá lỏng (P8, B1, C7, P9, C10, C4 — từng chấm điểm câu trả lời sai), thêm cách nói đúng còn
      thiếu (B6 "thay đổi trong cấu trúc") và các lỗi còn sót (P9 "chu kỳ… tỉ lệ nghịch với khối
      lượng", P2 "vật nặng sẽ rơi nhanh hơn", C4 "dung dịch là bazơ", B9 "Có, … luôn có hại"); B8
      không còn coi "phiên mã ngược (ARN → ADN)" là sai. Mỗi chỗ sửa có một bài kiểm tra trong
      `tests/teaching-rubric.test.ts`. Nhờ giáo viên kiểm tra lại các mẫu mới.
17. **Đáp án tham khảo cho 30 câu đầu của bộ đánh giá** (`tests/teaching/teaching-eval.json`,
    trường `expected` và `keyPoints`, 14/10/2026): giúp người chấm (AI hoặc người) phân biệt câu
    trả lời đúng và sai. Do một AI viết và một AI khác kiểm tra (7 chỗ đã sửa); chưa giáo viên nào
    duyệt — `review_status: "pending"`. Tiêu chí chấm cố định trong `scripts/teaching/judge-rubric.md`.
    Kết quả chấm bằng AI trong `docs/TEACHING_EVAL.md` chỉ có giá trị khi các đáp án này đúng.
18. **Bộ 15 câu kiểm tra độc lập** (`tests/teaching/teaching-heldout.json`, H1–H15, 14/10/2026):
    viết trước khi xem bất kỳ câu trả lời nào của model, để kiểm tra lời nhắc mới không chỉ "học
    thuộc" bộ 42 câu. Mỗi môn 5 câu: hiểu sai thường gặp, câu bẫy, câu hỏi tiếp theo, khái niệm,
    bài toán. Do Claude viết, `review_status: "pending"`. Nhờ giáo viên kiểm tra các mẫu `keyFacts`
    và `mustNot` của từng câu.
19. **19 câu đo giọng đọc** (`src/teacher/voice/ttsBenchSet.json`, B01–B19): câu mẫu để so sánh
    hai cách đọc trong `docs/VOICE_BENCHMARK.md` §6 (không phải dữ liệu khoa học dạy cho học sinh,
    nhưng có công thức, đơn vị, phương trình hóa học). Cách đọc từng câu vẫn cần người nghe xác nhận
    (gói nghe thử mù A/B do người dùng tự nghe; chưa có kết quả nghe).
20. **Kịch bản Science Studio "Rơi tự do: thả từ độ cao gấp đôi"**
    (`src/studio/scenarios/physicsFreeFall.ts`, id `physics.free-fall-height`, 19/10/2026):
    mục tiêu, gợi ý, câu hỏi, giả định, giới hạn và **kết luận tham khảo** ("thời gian rơi tỉ lệ với
    căn bậc hai của độ cao: độ cao gấp đôi thì thời gian tăng √2 lần"). Do Claude viết,
    `review_status: "pending"`; giao diện và báo cáo ghi "chưa được kiểm duyệt". Mọi số đo (thời
    gian, tốc độ chạm đất, tỉ số B/A) do engine `phys.projectile` tính và được kiểm tra chéo với
    `solve()` trong `src/studio/physics/comparison.test.ts`; kịch bản không chứa số đo nào. Nhờ
    giáo viên kiểm tra lời văn và kết luận tham khảo.
21. **Kịch bản Science Studio "Nhận biết ion Cl⁻ bằng dung dịch AgNO₃" và bàn thí nghiệm Hóa học**
    (`src/studio/scenarios/chemistryChlorideTest.ts`, id `chemistry.chloride-silver-nitrate`;
    `src/studio/chemistry/card.ts`; chuỗi `studio.chem.*` trong `src/app/i18n/locales/vi.ts`,
    19/10/2026): mục tiêu, câu hỏi dự đoán, các bước làm, gợi ý, câu hỏi, giả định, giới hạn của
    bàn thí nghiệm, lời nhắc an toàn chung và **kết luận tham khảo** (chép lại bản ghi `agcl` của
    thư viện). Do Claude viết, `review_status: "pending"`; giao diện và báo cáo ghi "chưa được kiểm
    duyệt". Hiện tượng, điều kiện, phương trình và nguồn lấy nguyên văn từ `data/reactions.json`
    (bản ghi `agcl`, `baso4` — cũng đang `pending`); phương trình được kiểm tra bằng `balance.ts`
    trong `src/studio/chemistry/library.test.ts`. Cặp dung dịch không có bản ghi (ví dụ AgNO₃ +
    BaCl₂) chỉ hiện "chưa có trong cơ sở dữ liệu đã kiểm chứng" — ứng dụng không đoán. "Có kết
    tủa" chỉ được xác nhận khi bản ghi có `category: "precipitation"`; thư viện không ghi trường
    hợp "không có kết tủa". Lớp kết tủa trong hình là kí hiệu trung tính (không vẽ màu, không vẽ
    lượng). Nhờ giáo viên kiểm tra lời văn, các bước làm, lời nhắc an toàn và kết luận tham khảo.
22. **Kịch bản Science Studio "Nguyên phân 3D: khi nào NST kép xếp hàng ở mặt phẳng xích đạo?" và
    hoạt động "Tìm bộ phận theo chức năng"** (`src/studio/scenarios/biologyMitosisMetaphase.ts`, id
    `biology.mitosis-equator`; `src/studio/biology/card.ts`; chuỗi `studio.bio.*` trong
    `src/app/i18n/locales/vi.ts`, 19/10/2026): câu hỏi dự đoán, mục tiêu, gợi ý, câu hỏi, giả định,
    giới hạn, hai giả thiết thêm vào Thẻ Khoa học 3D và **kết luận tham khảo**. Do Claude viết,
    `review_status: "pending"`; giao diện và báo cáo ghi "chưa được kiểm duyệt". Đáp án của câu hỏi
    dự đoán không viết tay: ứng dụng đọc mô hình 3D tại thời điểm đặc trưng của từng kì
    (`STAGE_KEY_U`) và tìm kì duy nhất mà mọi NST đều là NST kép và mọi tâm động được mô hình giữ
    trên mặt phẳng xích đạo (`src/studio/biology/model.ts`). Số NST và số NST kép lấy từ mô hình
    đếm; "trên mặt phẳng" lấy theo ý nghĩa của kì trong mô hình (`heldOnPlate` trong
    `src/biology/division/mitosis3d/timeline.ts`: kì giữa, khi sợi thoi đã kéo xong) — không đọc từ
    vị trí minh họa (ở G2 và kì đầu có tâm động được vẽ cách x = 0 chỉ 0,004 đơn vị). Test
    `model.test.ts` kiểm tra với 2n = 2, 4, 6, 8, tế bào động vật và thực vật, rằng chỉ đúng một kì
    thỏa mãn và đó là kì giữa (khớp mô tả kì M3D-4), và đối chiếu: khi mô hình giữ NST ở mặt phẳng
    thì hình vẽ đặt mọi tâm động đúng x = 0. Trong bài học, loại tế bào và 2n bị khoá theo kịch bản
    (tế bào động vật, 2n = 4); bản ghi kì luôn là của tế bào này. Kết luận tham khảo và câu hỏi
    ("2n = 4") được test đối chiếu với mô hình. Tên kì, mô tả
    kì, tên và chức năng bộ phận trong hoạt động lấy nguyên văn từ `components.ts` (các mục M3D-1 …
    M3D-23, cũng đang chờ duyệt); đáp án đúng của hoạt động là chính bộ phận mà chức năng thuộc về.
    Nhờ giáo viên kiểm tra lời văn, cách chọn 5 bộ phận (màng tế bào, nhân, màng nhân, nhân con, thoi
    phân bào) và kết luận tham khảo.
23. **Soạn bài (Science Studio): kịch bản do giáo viên viết và lời giải thích của trình soạn**
    (`src/studio/authoring/`; chuỗi `studio.teacher`, `studio.authoring.*` trong
    `src/app/i18n/locales/vi.ts`, 19/10/2026). Mọi kịch bản soạn hoặc nhập (`author: "teacher"`)
    luôn được lưu với `review_status: "pending"`, kể cả khi tệp nhập ghi `verified`; Studio ghi
    "Nội dung do giáo viên soạn — không phải kết quả của mô phỏng" cạnh mục tiêu, gợi ý, câu hỏi,
    kết luận mong đợi và trong báo cáo. Ứng dụng không kiểm tra nội dung khoa học của chữ giáo viên
    viết; nó chỉ kiểm tra rằng kịch bản chạy được: Vật lí dùng đúng bộ đo của một kịch bản có sẵn
    (hiện chỉ Rơi tự do), giá trị ban đầu nằm trong thang đo của cảnh và lần B (nhân hệ số POE) vẫn
    trong thang đo; Hóa học chỉ chọn phản ứng `precipitation` của thư viện và dung dịch là chất đầu
    của các bản ghi đó (hiện AgNO₃, NaCl, BaCl₂, H₂SO₄); Sinh học chỉ chọn bộ phận mô hình 3D có cho
    loại tế bào, 2n = 2…8. Câu hỏi giáo viên viết có thể không khớp với đáp án mà mô hình tính (Hóa
    học: "có kết tủa"; Sinh học: kì mà tâm động nằm trên mặt phẳng xích đạo) — trình soạn ghi rõ đáp
    án được tính thế nào. Nhờ giáo viên kiểm tra các câu giải thích này và từng kịch bản trước khi
    dùng với học sinh.
24. **Vật lí: miền áp dụng mới và lời giải thích khi sửa lỗi (19/10/2026, bản 0.7).** Các câu dưới
    đây là lời văn mới trong cảnh Vật lí; số liệu vẫn do mô hình tính, không có số viết tay.
    `review_status: "pending"`. Nhờ giáo viên kiểm tra lời văn và điều kiện:
    - Con lắc đơn (`src/physics/pendulum/scenes.ts`, `stringStaysTaut`): bị từ chối khi dây sẽ chùng.
      Lực căng T(α) = m g (3 cos α − 2c), với c = cos α_bđ − l ω_bđ²/(2g); dao động giữ dây căng khi
      biên độ ≤ 90° (c ≥ 0), quay vòng giữ dây căng khi v² > g·l ở điểm cao nhất (c < −1,5). Có lực
      cản thì mọi trạng thái đầu trên mức 90° bị từ chối (con lắc chậm dần nên đi qua vùng dây chùng).
    - Lò xo có lực cản (`src/physics/spring/scenes.ts`): tắt dần nhẹ → "Chu kì dao động tắt dần
      T_d = 2π/ω_d" và "Tần số dao động tắt dần f_d"; tới hạn và quá tới hạn không còn chu kì, tần
      số; ω₀ ghi là "Tần số góc riêng". SGK THPT không định nghĩa T_d (giả chu kì) — xin xác nhận
      cách gọi. Nguồn: Halliday–Resnick–Walker ch. 15.
    - Mặt phẳng nghiêng / định luật Newton (`src/physics/incline/scenes.ts`): vật bắt đầu ngay ở mép
      (chân dốc, đỉnh dốc hoặc đầu đường) và chuyển động ra ngoài thì bị từ chối (rời mặt đỡ ngay
      tại t = 0).
    - Ném xiên, rơi tự do (`src/physics/projectile/scenes.ts`): xuất phát từ mặt đất (h₀ = 0) mà
      không có vận tốc hướng lên thì bị từ chối (chạm đất ngay).
    - Máy Atwood hai vật bằng nhau (`src/physics/pulley/scenes.ts`): "hệ cân bằng, thả từ trạng thái
      nghỉ thì không dịch chuyển"; chỉ báo a = 0 và T = m₂g.
    - Hai ngọn đồi (`src/physics/track/scenes.ts`, `barrierAhead`): kết luận "vượt qua đồi thứ hai"
      so mức cơ năng với điểm cao nhất vật phải vượt qua theo chiều chuyển động (tìm số trên lưới
      mịn rồi tinh chỉnh), thêm hai trường hợp "trượt ra khỏi đầu trái" và "không còn đồi nào phía
      bên phải".
25. **Hóa học – Sinh học: lời văn mới khi sửa lỗi mô hình (19/10/2026, bản 0.7).** Số liệu vẫn do
    mô hình tính, không có số viết tay. `review_status: "pending"`. Nhờ giáo viên kiểm tra:
    - Thẩm thấu, ống chữ U (`src/biology/transport/transport.ts`, `osmosisRunsDry`): nhánh nước có
      hạn; khi h₀ < iC₀RT/(4ρg) nhánh nước cạn (h_R = 0) trước khi ρgΔh bằng Π. Mô hình dừng ở đó,
      chip báo "Nhánh nước cạn trước khi Π được cân bằng" và đường "Δh khi nhánh nước cạn (chưa cân
      bằng)"; Thẻ Khoa học thêm giả thiết "Nhánh nước có hạn…". Mô hình không mô tả tiếp phần nước
      trong ống nối nằm ngang.
    - Đột biến điểm (`src/biology/central/dogma.ts`, `analyzeMutation`): thêm loại "Tạo bộ ba mở
      đầu mới phía trước" (`startGain`) cho đột biến ở vùng 5′ tạo ra AUG trước AUG cũ, theo giả
      thiết của bài "dịch mã từ AUG đầu tiên". SGK không có loại này — xin xác nhận cách gọi. Thêm/
      mất nuclêôtit ở vùng 5′ chỉ làm dịch vị trí AUG thì là "Ngoài vùng mã hóa"; thay thế tạo bộ ba
      kết thúc sớm trong khung đọc không có bộ ba kết thúc ban đầu là "vô nghĩa".
    - Trình tự ADN (`strandDirection`, `parseInput`): đọc dấu 5′/3′ ở hai đầu (cả ’ ‘ ` ´); mạch nhập
      ngược chiều với mạch đã chọn được đảo lại, kèm lời báo cho người học.
    - Cân bằng hóa học (`src/chemistry/particles/equilibrium.ts`, `extentSolution`): nồng độ tính
      bằng nghiệm giải tích chính xác của phương trình tốc độ theo độ tiến phản ứng ξ (phương trình
      Riccati, mọi hệ có bậc mỗi vế ≤ 2); DOPRI5/TR-BDF2 chỉ dùng cho hệ bậc cao hơn. Giới hạn ô
      nhập: k ≤ 10⁶, Eₐ ≤ 300 kJ/mol (chọn để mô phỏng chạy được, không phải số liệu chất thật).
    - Đối chiếu thư viện phản ứng (`matchLibrary`): so riêng từng vế; chiều nghịch chỉ khớp với phản
      ứng thuận nghịch; cùng công thức phân tử nhưng viết khác (có thể là đồng phân khác) thì báo
      "chưa được kiểm chứng".
    - Nguyên tử trung tâm VSEPR (`src/chemistry/data/molecules.ts`, `centralAtom`,
      `hasSeveralCentres`): chọn nguyên tử không phải H liên kết với nhiều nguyên tử nặng nhất (hòa
      thì nhiều liên kết hơn, rồi độ âm điện nhỏ hơn). Phân tử có nhiều nguyên tử trung tâm không
      tương đương (etyl axetat, glyxin, toluen, glucozơ) không hiện một kiểu AXₙEₘ chung.
    - Lotka–Volterra (`src/biology/ecology/ecology.ts`): giải theo ln x, ln y; chip báo "sai số tích
      lũy lớn, đường đi kém tin cậy" khi V lệch quá 10⁻⁶. Logistic: không có điểm uốn khi t ≥ 0 nếu
      N₀ ≥ K/2.
