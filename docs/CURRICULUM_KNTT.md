# Đối chiếu SimLab với SGK "Kết nối tri thức với cuộc sống"

> **Tệp sinh tự động** bởi `scripts/data/gen_curriculum_kntt.py` (cùng nguồn với
> `data/curriculum_kntt.json`, dữ liệu cho thanh chia lớp của thư viện, việc (g2) của #37). Không sửa tay: sửa script rồi chạy
> `python scripts/data/gen_curriculum_kntt.py`. **Mọi dòng đang chờ giáo viên duyệt** (`review_status: "pending"`,
> DATA_REVIEW mục 12 và các dòng `KNTT-*`).

## Nguồn và cách đọc

- **Sách:** Vật lí, Hoá học, Sinh học lớp 10, 11, 12 bộ "Kết nối tri thức với cuộc sống", NXB Giáo dục Việt Nam.
- **Nguồn chính thức:** mục lục (trang in số 4, có cuốn sang trang 5) trong sách đọc trực tuyến trên trang tập huấn của NXB Giáo dục, ảnh trang tải lên tháng 4/2026. **Ngày truy cập: 2026-10-26.**
- **Cách đọc:** `hanhtrangso.nxbgd.vn` là ứng dụng JavaScript nên không đọc được; trang `taphuan.nxbgd.vn` đọc được bằng `curl` thường (có kiểm chứng chỉ, không dùng `-k`): lấy địa chỉ ảnh trang trong trang đọc sách rồi xem ảnh.
- **Chép gì:** chỉ tên chương và tên bài, nguyên văn bản in (mục lục in tên chương bằng chữ hoa; bảng dưới viết lại chữ thường, cùng từ). Không chép nội dung sách. Các trang phụ (vietjack, loigiaihay…) lệch bản in ở vài tên bài nên không dùng.
- **Cần giáo viên xác nhận:** SimLab đối chiếu theo bản in nào (năm, lần tái bản); mỗi chủ đề có thật sự ứng với bài đã ghi không (chủ đề có thể chỉ ứng với một phần của bài).

| Sách | Địa chỉ đọc |
| --- | --- |
| Vật lí 10 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-vat-li-10.4700746482 |
| Vật lí 11 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-vat-li-11.4701093133 |
| Vật lí 12 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/shs-vat-li-12.4701697631 |
| Hoá học 10 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-10.4700854983 |
| Hoá học 11 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-11.4701111834 |
| Hoá học 12 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoa-hoc-12.4701708102 |
| Sinh học 10 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-10.4700819489 |
| Sinh học 11 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-11.4701129740 |
| Sinh học 12 | https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-sinh-hoc-12.4701665546 |

## Số bài

Bài **lí thuyết** = mọi bài trừ mở đầu môn học, thực hành, ôn tập, bài tập (kể cả "Một số ví dụ về cách giải…"), dự án, ngành nghề.

| Sách | Số bài | Lí thuyết | Lí thuyết có chủ đề SimLab |
| --- | --- | --- | --- |
| Vật lí 10 | 34 | 26 | 19 |
| Vật lí 11 | 26 | 20 | 13 |
| Vật lí 12 | 25 | 21 | 0 |
| Hoá học 10 | 23 | 16 | 5 |
| Hoá học 11 | 25 | 19 | 1 |
| Hoá học 12 | 30 | 22 | 1 |
| Sinh học 10 | 26 | 17 | 5 |
| Sinh học 11 | 29 | 20 | 0 |
| Sinh học 12 | 35 | 28 | 7 |
| **Cộng** | **253** | **189** | **51** |

Các chỗ đếm có thể khác (giáo viên chọn):

- VL10 Bài 1 (Làm quen với Vật lí) tính là mở đầu môn học; VL10 Bài 3 (Thực hành tính sai số…, không có dấu hai chấm) tính là thực hành.
- VL10 Bài 2 (quy tắc an toàn) tính là mở đầu môn học; VL10 Bài 20 (Một số ví dụ về cách giải…) tính là bài tập.
- SH10 Bài 1–2 tính là mở đầu môn học; SH10 Bài 3 tính là lí thuyết.
- SH11 Bài 29 (ngành nghề) không tính là lí thuyết.
- HH10 "Mở đầu" không đánh số: không tính vào tổng số bài.

## Bài SGK ↔ chủ đề SimLab

Gồm **mọi bài** trong mục lục của 9 cuốn (kể cả bài SimLab chưa có; #54 mục 7). Cột "Chủ đề SimLab" là đề xuất, chờ giáo viên duyệt; "chưa có" là bài SimLab chưa có chủ đề nào.

| Sách | Chương | Bài | Tên bài | Trang | Loại | Chủ đề SimLab | Ghi chú | review_status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vật lí 10 | Chương I. Mở đầu | 1 | Làm quen với Vật lí | 7 | Mở đầu môn học | chưa có |  | pending |
| Vật lí 10 | Chương I. Mở đầu | 2 | Các quy tắc an toàn trong phòng thực hành Vật lí | 12 | Mở đầu môn học | chưa có |  | pending |
| Vật lí 10 | Chương I. Mở đầu | 3 | Thực hành tính sai số trong phép đo. Ghi kết quả đo | 17 | Thực hành | chưa có |  | pending |
| Vật lí 10 | Chương II. Động học | 4 | Độ dịch chuyển và quãng đường đi được | 21 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 5 | Tốc độ và vận tốc | 26 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 6 | Thực hành: Đo tốc độ của vật chuyển động | 30 | Thực hành | chưa có |  | pending |
| Vật lí 10 | Chương II. Động học | 7 | Đồ thị độ dịch chuyển – thời gian | 34 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 8 | Chuyển động biến đổi. Gia tốc | 37 | Lí thuyết | Chuyển động thẳng biến đổi đều | Tên Bài 8–9: gia tốc và chuyển động thẳng biến đổi đều. | pending |
| Vật lí 10 | Chương II. Động học | 9 | Chuyển động thẳng biến đổi đều | 40 | Lí thuyết | Chuyển động thẳng biến đổi đều | Tên Bài 8–9: gia tốc và chuyển động thẳng biến đổi đều. | pending |
| Vật lí 10 | Chương II. Động học | 10 | Sự rơi tự do | 44 | Lí thuyết | Rơi tự do | Tên Bài 10: sự rơi tự do. | pending |
| Vật lí 10 | Chương II. Động học | 11 | Thực hành: Đo gia tốc rơi tự do | 47 | Thực hành | chưa có |  | pending |
| Vật lí 10 | Chương II. Động học | 12 | Chuyển động ném | 49 | Lí thuyết | Ném ngang, Ném xiên | Tên Bài 12: chuyển động ném. | pending |
| Vật lí 10 | Chương III. Động lực học | 13 | Tổng hợp và phân tích lực. Cân bằng lực | 56 | Lí thuyết | Tổng hợp và phân tích lực | Tên Bài 13: tổng hợp và phân tích lực, cân bằng lực (cảnh có 2–3 lực đồng quy, hợp lực, hai thành phần theo trục, vòng đứng yên khi hợp lực bằng 0). | pending |
| Vật lí 10 | Chương III. Động lực học | 14 | Định luật 1 Newton | 60 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương III. Động lực học | 15 | Định luật 2 Newton | 63 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương III. Động lực học | 16 | Định luật 3 Newton | 67 | Lí thuyết | Định luật III Newton | Tên Bài 16: định luật 3 Newton (cảnh hai xe đẩy nhau bằng lò xo, lực tương tác cùng độ lớn, ngược chiều). | pending |
| Vật lí 10 | Chương III. Động lực học | 17 | Trọng lực và lực căng | 69 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương III. Động lực học | 18 | Lực ma sát | 72 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương III. Động lực học | 19 | Lực cản và lực nâng | 77 | Lí thuyết | Lực cản của chất lưu | Tên Bài 19: lực cản và lực nâng (cảnh có lực cản của chất lưu và lực đẩy Archimedes lên quả cầu rơi hoặc nổi; chưa có lực nâng khí động của cánh). | pending |
| Vật lí 10 | Chương III. Động lực học | 20 | Một số ví dụ về cách giải các bài toán thuộc phần động lực học | 80 | Bài tập | chưa có |  | pending |
| Vật lí 10 | Chương III. Động lực học | 21 | Moment lực. Cân bằng của vật rắn | 83 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương III. Động lực học | 22 | Thực hành: Tổng hợp lực | 86 | Thực hành | chưa có |  | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 23 | Năng lượng. Công cơ học | 91 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 24 | Công suất | 96 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 25 | Động năng, thế năng | 99 | Lí thuyết | Bảo toàn cơ năng | Tên Bài 25–26: động năng, thế năng, cơ năng và định luật bảo toàn cơ năng. | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 26 | Cơ năng và định luật bảo toàn cơ năng | 102 | Lí thuyết | Bảo toàn cơ năng | Tên Bài 25–26: động năng, thế năng, cơ năng và định luật bảo toàn cơ năng. | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 27 | Hiệu suất | 106 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương V. Động lượng | 28 | Động lượng | 110 | Lí thuyết | Va chạm đàn hồi và va chạm mềm | Tên Bài 28–29: động lượng và định luật bảo toàn động lượng. | pending |
| Vật lí 10 | Chương V. Động lượng | 29 | Định luật bảo toàn động lượng | 113 | Lí thuyết | Va chạm đàn hồi và va chạm mềm | Tên Bài 28–29: động lượng và định luật bảo toàn động lượng. | pending |
| Vật lí 10 | Chương V. Động lượng | 30 | Thực hành: Xác định động lượng của vật trước và sau va chạm | 116 | Thực hành | chưa có |  | pending |
| Vật lí 10 | Chương VI. Chuyển động tròn đều | 31 | Động học của chuyển động tròn đều | 120 | Lí thuyết | Chuyển động tròn đều | Tên Bài 31–32: động học của chuyển động tròn đều; lực hướng tâm và gia tốc hướng tâm. | pending |
| Vật lí 10 | Chương VI. Chuyển động tròn đều | 32 | Lực hướng tâm và gia tốc hướng tâm | 123 | Lí thuyết | Chuyển động tròn đều | Tên Bài 31–32: động học của chuyển động tròn đều; lực hướng tâm và gia tốc hướng tâm. | pending |
| Vật lí 10 | Chương VII. Biến dạng của vật rắn. Áp suất chất lỏng | 33 | Biến dạng của vật rắn | 128 | Lí thuyết | chưa có |  | pending |
| Vật lí 10 | Chương VII. Biến dạng của vật rắn. Áp suất chất lỏng | 34 | Khối lượng riêng. Áp suất chất lỏng | 131 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương I. Dao động | 1 | Dao động điều hoà | 6 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 2 | Mô tả dao động điều hoà | 10 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 3 | Vận tốc, gia tốc trong dao động điều hoà | 14 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 4 | Bài tập về dao động điều hoà | 17 | Bài tập | chưa có |  | pending |
| Vật lí 11 | Chương I. Dao động | 5 | Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà | 20 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 6 | Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng | 24 | Lí thuyết | Con lắc lò xo, Con lắc đơn, Dao động cưỡng bức và cộng hưởng | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Dao động cưỡng bức và cộng hưởng: Tên Bài 6: dao động tắt dần, dao động cưỡng bức, hiện tượng cộng hưởng (cảnh lò xo nằm ngang có cản và ngoại lực điều hoà). | pending |
| Vật lí 11 | Chương I. Dao động | 7 | Bài tập về sự chuyển hoá năng lượng trong dao động điều hoà | 28 | Bài tập | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 8 | Mô tả sóng | 32 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 9 | Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ | 37 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 10 | Thực hành: Đo tần số của sóng âm | 41 | Thực hành | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 11 | Sóng điện từ | 44 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 12 | Giao thoa sóng | 48 | Lí thuyết | Giao thoa sóng hai nguồn | Tên Bài 12: giao thoa sóng (cảnh có hai nguồn cùng pha trên mặt nước; phần phách là mở rộng). | pending |
| Vật lí 11 | Chương II. Sóng | 13 | Sóng dừng | 52 | Lí thuyết | Sóng dừng trên dây | Tên Bài 13: sóng dừng (cảnh chỉ có dây hai đầu cố định). | pending |
| Vật lí 11 | Chương II. Sóng | 14 | Bài tập về sóng | 55 | Bài tập | chưa có |  | pending |
| Vật lí 11 | Chương II. Sóng | 15 | Thực hành: Đo tốc độ truyền âm | 58 | Thực hành | chưa có |  | pending |
| Vật lí 11 | Chương III. Điện trường | 16 | Lực tương tác giữa các điện tích | 61 | Lí thuyết | Điện trường của điện tích điểm | Tên Bài 16–18: lực tương tác giữa các điện tích, khái niệm điện trường, điện trường đều. | pending |
| Vật lí 11 | Chương III. Điện trường | 17 | Khái niệm điện trường | 65 | Lí thuyết | Điện trường của điện tích điểm | Tên Bài 16–18: lực tương tác giữa các điện tích, khái niệm điện trường, điện trường đều. | pending |
| Vật lí 11 | Chương III. Điện trường | 18 | Điện trường đều | 71 | Lí thuyết | Điện trường của điện tích điểm | Tên Bài 16–18: lực tương tác giữa các điện tích, khái niệm điện trường, điện trường đều. | pending |
| Vật lí 11 | Chương III. Điện trường | 19 | Thế năng điện | 76 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương III. Điện trường | 20 | Điện thế | 79 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương III. Điện trường | 21 | Tụ điện | 83 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 22 | Cường độ dòng điện | 91 | Lí thuyết | chưa có |  | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 23 | Điện trở. Định luật Ohm | 95 | Lí thuyết | Mạch điện một chiều | Tên Bài 23–25: điện trở, định luật Ohm, nguồn điện, năng lượng và công suất điện (cảnh có nguồn E, r và 1–3 điện trở). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 24 | Nguồn điện | 102 | Lí thuyết | Mạch điện một chiều | Tên Bài 23–25: điện trở, định luật Ohm, nguồn điện, năng lượng và công suất điện (cảnh có nguồn E, r và 1–3 điện trở). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 25 | Năng lượng và công suất điện | 106 | Lí thuyết | Mạch điện một chiều | Tên Bài 23–25: điện trở, định luật Ohm, nguồn điện, năng lượng và công suất điện (cảnh có nguồn E, r và 1–3 điện trở). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 26 | Thực hành: Đo suất điện động và điện trở trong của pin điện hoá | 111 | Thực hành | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 1 | Cấu trúc của chất. Sự chuyển thể | 6 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 2 | Nội năng. Định luật I của nhiệt động lực học | 10 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 3 | Nhiệt độ. Thang nhiệt độ – nhiệt kế | 15 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 4 | Nhiệt dung riêng | 20 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 5 | Nhiệt nóng chảy riêng | 24 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 6 | Nhiệt hoá hơi riêng | 27 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương I. Vật lí nhiệt | 7 | Bài tập về vật lí nhiệt | 30 | Bài tập | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 8 | Mô hình động học phân tử chất khí | 34 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 9 | Định luật Boyle | 37 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 10 | Định luật Charles | 41 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 11 | Phương trình trạng thái của khí lí tưởng | 45 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 12 | Áp suất khí theo mô hình động học phân tử. Quan hệ giữa động năng phân tử và nhiệt độ | 48 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương II. Khí lí tưởng | 13 | Bài tập về khí lí tưởng | 52 | Bài tập | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 14 | Từ trường | 56 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 15 | Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ | 61 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 16 | Từ thông. Hiện tượng cảm ứng điện từ | 66 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 17 | Máy phát điện xoay chiều | 72 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 18 | Ứng dụng hiện tượng cảm ứng điện từ | 78 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 19 | Điện từ trường. Mô hình sóng điện từ | 82 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương III. Từ trường | 20 | Bài tập về từ trường | 86 | Bài tập | chưa có |  | pending |
| Vật lí 12 | Chương IV. Vật lí hạt nhân | 21 | Cấu trúc hạt nhân | 91 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương IV. Vật lí hạt nhân | 22 | Phản ứng hạt nhân và năng lượng liên kết | 96 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương IV. Vật lí hạt nhân | 23 | Hiện tượng phóng xạ | 104 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương IV. Vật lí hạt nhân | 24 | Công nghiệp hạt nhân | 114 | Lí thuyết | chưa có |  | pending |
| Vật lí 12 | Chương IV. Vật lí hạt nhân | 25 | Bài tập về vật lí hạt nhân | 119 | Bài tập | chưa có |  | pending |
| Hoá học 10 | Mở đầu |  | Mở đầu | 6 | Mở đầu môn học | chưa có |  | pending |
| Hoá học 10 | Chương 1. Cấu tạo nguyên tử | 1 | Thành phần của nguyên tử | 13 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 1. Cấu tạo nguyên tử | 2 | Nguyên tố hoá học | 17 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 1. Cấu tạo nguyên tử | 3 | Cấu trúc lớp vỏ electron nguyên tử | 21 | Lí thuyết | Cấu hình electron, Hình dạng orbital | Tên Bài 3: cấu trúc lớp vỏ electron nguyên tử. | pending |
| Hoá học 10 | Chương 1. Cấu tạo nguyên tử | 4 | Ôn tập chương 1 | 26 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 5 | Cấu tạo của bảng tuần hoàn các nguyên tố hoá học | 30 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 6 | Xu hướng biến đổi một số tính chất của nguyên tử các nguyên tố trong một chu kì và trong một nhóm | 34 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 7 | Xu hướng biến đổi thành phần và một số tính chất của hợp chất trong một chu kì | 40 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 8 | Định luật tuần hoàn. Ý nghĩa của bảng tuần hoàn các nguyên tố hoá học | 43 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 9 | Ôn tập chương 2 | 45 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 3. Liên kết hoá học | 10 | Quy tắc octet | 49 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 3. Liên kết hoá học | 11 | Liên kết ion | 51 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 3. Liên kết hoá học | 12 | Liên kết cộng hoá trị | 55 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 3. Liên kết hoá học | 13 | Liên kết hydrogen và tương tác van der Waals | 64 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 3. Liên kết hoá học | 14 | Ôn tập chương 3 | 68 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 4. Phản ứng oxi hoá – khử | 15 | Phản ứng oxi hoá – khử | 71 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 4. Phản ứng oxi hoá – khử | 16 | Ôn tập chương 4 | 78 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 5. Năng lượng hoá học | 17 | Biến thiên enthalpy trong các phản ứng hoá học | 81 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 5. Năng lượng hoá học | 18 | Ôn tập chương 5 | 89 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 6. Tốc độ phản ứng | 19 | Tốc độ phản ứng | 92 | Lí thuyết | Thuyết va chạm | Tên Bài 19: tốc độ phản ứng. | pending |
| Hoá học 10 | Chương 6. Tốc độ phản ứng | 20 | Ôn tập chương 6 | 101 | Ôn tập | chưa có |  | pending |
| Hoá học 10 | Chương 7. Nguyên tố nhóm halogen | 21 | Nhóm halogen | 104 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 7. Nguyên tố nhóm halogen | 22 | Hydrogen halide · Muối halide | 112 | Lí thuyết | chưa có |  | pending |
| Hoá học 10 | Chương 7. Nguyên tố nhóm halogen | 23 | Ôn tập chương 7 | 117 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 1. Cân bằng hoá học | 1 | Khái niệm về cân bằng hoá học | 6 | Lí thuyết | Cân bằng hóa học & Le Chatelier | Tên Bài 1: khái niệm về cân bằng hoá học. | pending |
| Hoá học 11 | Chương 1. Cân bằng hoá học | 2 | Cân bằng trong dung dịch nước | 16 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 1. Cân bằng hoá học | 3 | Ôn tập chương 1 | 27 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 4 | Nitrogen | 29 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 5 | Ammonia • Muối ammonium | 33 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 6 | Một số hợp chất của nitrogen với oxygen | 38 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 7 | Sulfur và sulfur dioxide | 42 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 8 | Sulfuric acid và muối sulfate | 48 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 2. Nitrogen – sulfur | 9 | Ôn tập chương 2 | 55 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 3. Đại cương về hoá học hữu cơ | 10 | Hợp chất hữu cơ và hoá học hữu cơ | 57 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 3. Đại cương về hoá học hữu cơ | 11 | Phương pháp tách biệt và tinh chế hợp chất hữu cơ | 63 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 3. Đại cương về hoá học hữu cơ | 12 | Công thức phân tử hợp chất hữu cơ | 70 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 3. Đại cương về hoá học hữu cơ | 13 | Cấu tạo hoá học hợp chất hữu cơ | 74 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 3. Đại cương về hoá học hữu cơ | 14 | Ôn tập chương 3 | 80 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 4. Hydrocarbon | 15 | Alkane | 82 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 4. Hydrocarbon | 16 | Hydrocarbon không no | 92 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 4. Hydrocarbon | 17 | Arene (Hydrocarbon thơm) | 102 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 4. Hydrocarbon | 18 | Ôn tập chương 4 | 110 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 5. Dẫn xuất halogen – alcohol – phenol | 19 | Dẫn xuất halogen | 112 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 5. Dẫn xuất halogen – alcohol – phenol | 20 | Alcohol | 119 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 5. Dẫn xuất halogen – alcohol – phenol | 21 | Phenol | 129 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 5. Dẫn xuất halogen – alcohol – phenol | 22 | Ôn tập chương 5 | 134 | Ôn tập | chưa có |  | pending |
| Hoá học 11 | Chương 6. Hợp chất carbonyl – carboxylic acid | 23 | Hợp chất carbonyl | 136 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 6. Hợp chất carbonyl – carboxylic acid | 24 | Carboxylic acid | 145 | Lí thuyết | chưa có |  | pending |
| Hoá học 11 | Chương 6. Hợp chất carbonyl – carboxylic acid | 25 | Ôn tập chương 6 | 153 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 1. Ester – Lipid | 1 | Ester – Lipid | 6 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 1. Ester – Lipid | 2 | Xà phòng và chất giặt rửa | 14 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 1. Ester – Lipid | 3 | Ôn tập chương 1 | 18 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 2. Carbohydrate | 4 | Giới thiệu về carbohydrate. Glucose và fructose | 20 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 2. Carbohydrate | 5 | Saccharose và maltose | 25 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 2. Carbohydrate | 6 | Tinh bột và cellulose | 28 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 2. Carbohydrate | 7 | Ôn tập chương 2 | 33 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 3. Hợp chất chứa nitrogen | 8 | Amine | 35 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 3. Hợp chất chứa nitrogen | 9 | Amino acid và peptide | 41 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 3. Hợp chất chứa nitrogen | 10 | Protein và enzyme | 46 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 3. Hợp chất chứa nitrogen | 11 | Ôn tập chương 3 | 49 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 4. Polymer | 12 | Đại cương về polymer | 51 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 4. Polymer | 13 | Vật liệu polymer | 56 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 4. Polymer | 14 | Ôn tập chương 4 | 65 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 5. Pin điện và điện phân | 15 | Thế điện cực và nguồn điện hoá học | 67 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 5. Pin điện và điện phân | 16 | Điện phân | 78 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 5. Pin điện và điện phân | 17 | Ôn tập chương 5 | 85 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 18 | Cấu tạo và liên kết trong tinh thể kim loại | 87 | Lí thuyết | Tinh thể kim loại và NaCl | Tên Bài 18: cấu tạo và liên kết trong tinh thể kim loại (cảnh có thêm tinh thể NaCl; Bài 11 Hoá học 10 tên là liên kết ion, không nêu tinh thể nên không xếp). | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 19 | Tính chất vật lí và tính chất hoá học của kim loại | 89 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 20 | Kim loại trong tự nhiên và phương pháp tách kim loại | 94 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 21 | Hợp kim | 99 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 22 | Sự ăn mòn kim loại | 102 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 6. Đại cương về kim loại | 23 | Ôn tập chương 6 | 106 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 7. Nguyên tố nhóm IA và nhóm IIA | 24 | Nguyên tố nhóm IA | 108 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 7. Nguyên tố nhóm IA và nhóm IIA | 25 | Nguyên tố nhóm IIA | 116 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 7. Nguyên tố nhóm IA và nhóm IIA | 26 | Ôn tập chương 7 | 126 | Ôn tập | chưa có |  | pending |
| Hoá học 12 | Chương 8. Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất | 27 | Đại cương về kim loại chuyển tiếp dãy thứ nhất | 128 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 8. Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất | 28 | Sơ lược về phức chất | 134 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 8. Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất | 29 | Một số tính chất và ứng dụng của phức chất | 138 | Lí thuyết | chưa có |  | pending |
| Hoá học 12 | Chương 8. Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất | 30 | Ôn tập chương 8 | 142 | Ôn tập | chưa có |  | pending |
| Sinh học 10 | Phần mở đầu | 1 | Giới thiệu khái quát môn Sinh học | 5 | Mở đầu môn học | chưa có |  | pending |
| Sinh học 10 | Phần mở đầu | 2 | Phương pháp nghiên cứu và học tập môn Sinh học | 12 | Mở đầu môn học | chưa có |  | pending |
| Sinh học 10 | Phần mở đầu | 3 | Các cấp độ tổ chức của thế giới sống | 18 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 1. Thành phần hoá học của tế bào | 4 | Các nguyên tố hoá học và nước | 23 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 1. Thành phần hoá học của tế bào | 5 | Các phân tử sinh học | 28 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 1. Thành phần hoá học của tế bào | 6 | Thực hành: Nhận biết một số phân tử sinh học | 41 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 2. Cấu trúc tế bào | 7 | Tế bào nhân sơ | 44 | Lí thuyết | Tế bào nhân sơ và nhân thực | Tên Bài 7–8: tế bào nhân sơ và tế bào nhân thực. | pending |
| Sinh học 10 | Chương 2. Cấu trúc tế bào | 8 | Tế bào nhân thực | 48 | Lí thuyết | Tế bào nhân sơ và nhân thực, Từ tế bào đến DNA | Tế bào nhân sơ và nhân thực: Tên Bài 7–8: tế bào nhân sơ và tế bào nhân thực. Từ tế bào đến DNA: Tên Bài 8: tế bào nhân thực (cấp tế bào và nhân của bài phóng to). Không xếp Bài 7 (tế bào nhân sơ): bài chỉ có tế bào nhân thực, dù thang kích thước H 7.1 của Bài 7 là một nguồn số liệu. | pending |
| Sinh học 10 | Chương 2. Cấu trúc tế bào | 9 | Thực hành: Quan sát tế bào | 61 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 3. Trao đổi chất qua màng và truyền tin tế bào | 10 | Trao đổi chất qua màng tế bào | 64 | Lí thuyết | Khuếch tán & thẩm thấu | Tên Bài 10: trao đổi chất qua màng tế bào. Chỉ phần vận chuyển thụ động (khuếch tán, thẩm thấu), trên mô hình hai ngăn và ống chữ U, không phải màng tế bào thật. | pending |
| Sinh học 10 | Chương 3. Trao đổi chất qua màng và truyền tin tế bào | 11 | Thực hành: Thí nghiệm co và phản co nguyên sinh | 71 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 3. Trao đổi chất qua màng và truyền tin tế bào | 12 | Truyền tin tế bào | 73 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 4. Chuyển hoá năng lượng trong tế bào | 13 | Khái quát về chuyển hoá vật chất và năng lượng | 78 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 4. Chuyển hoá năng lượng trong tế bào | 14 | Phân giải và tổng hợp các chất trong tế bào | 85 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 4. Chuyển hoá năng lượng trong tế bào | 15 | Thực hành: Thí nghiệm phân tích ảnh hưởng của một số yếu tố đến hoạt tính của enzyme và kiểm tra hoạt tính của enzyme amylase | 94 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 16 | Chu kì tế bào và nguyên phân | 97 | Lí thuyết | Nguyên phân | Tên Bài 16: chu kì tế bào và nguyên phân. | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 17 | Giảm phân | 104 | Lí thuyết | Giảm phân | Tên Bài 17: giảm phân. | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 18 | Thực hành: Làm và quan sát tiêu bản quá trình nguyên phân và giảm phân | 108 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 19 | Công nghệ tế bào | 110 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 6. Sinh học vi sinh vật | 20 | Sự đa dạng và phương pháp nghiên cứu vi sinh vật | 116 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 6. Sinh học vi sinh vật | 21 | Trao đổi chất, sinh trưởng và sinh sản ở vi sinh vật | 122 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 6. Sinh học vi sinh vật | 22 | Vai trò và ứng dụng của vi sinh vật | 131 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 6. Sinh học vi sinh vật | 23 | Thực hành: Một số phương pháp nghiên cứu vi sinh vật thông dụng, tìm hiểu về các sản phẩm công nghệ vi sinh vật và làm một số sản phẩm lên men từ vi sinh vật | 138 | Thực hành | chưa có |  | pending |
| Sinh học 10 | Chương 7. Virus | 24 | Khái quát về virus | 141 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 7. Virus | 25 | Một số bệnh do virus và các thành tựu nghiên cứu ứng dụng virus | 145 | Lí thuyết | chưa có |  | pending |
| Sinh học 10 | Chương 7. Virus | 26 | Thực hành: Điều tra một số bệnh do virus và tuyên truyền phòng chống bệnh | 155 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 1 | Khái quát về trao đổi chất và chuyển hoá năng lượng | 5 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 2 | Trao đổi nước và khoáng ở thực vật | 9 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 3 | Thực hành: Trao đổi nước và khoáng ở thực vật | 22 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 4 | Quang hợp ở thực vật | 26 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 5 | Thực hành: Quang hợp ở thực vật | 35 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 6 | Hô hấp ở thực vật | 38 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 7 | Thực hành: Hô hấp ở thực vật | 44 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 8 | Dinh dưỡng và tiêu hoá ở động vật | 46 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 9 | Hô hấp ở động vật | 54 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 10 | Tuần hoàn ở động vật | 61 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 11 | Thực hành: Một số thí nghiệm về hệ tuần hoàn | 69 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 12 | Miễn dịch ở người và động vật | 72 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật | 13 | Bài tiết và cân bằng nội môi | 80 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 2. Cảm ứng ở sinh vật | 14 | Khái quát về cảm ứng ở sinh vật | 88 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 2. Cảm ứng ở sinh vật | 15 | Cảm ứng ở thực vật | 90 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 2. Cảm ứng ở sinh vật | 16 | Thực hành: Cảm ứng ở thực vật | 97 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 2. Cảm ứng ở sinh vật | 17 | Cảm ứng ở động vật | 100 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 2. Cảm ứng ở sinh vật | 18 | Tập tính ở động vật | 115 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 3. Sinh trưởng và phát triển ở sinh vật | 19 | Khái quát về sinh trưởng và phát triển ở sinh vật | 125 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 3. Sinh trưởng và phát triển ở sinh vật | 20 | Sinh trưởng và phát triển ở thực vật | 129 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 3. Sinh trưởng và phát triển ở sinh vật | 21 | Thực hành: Bấm ngọn, tỉa cành; xử lí kích thích tố và tính tuổi cây | 141 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 3. Sinh trưởng và phát triển ở sinh vật | 22 | Sinh trưởng và phát triển ở động vật | 145 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 3. Sinh trưởng và phát triển ở sinh vật | 23 | Thực hành: Quan sát quá trình biến thái ở động vật | 153 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 4. Sinh sản ở sinh vật | 24 | Khái quát về sinh sản ở sinh vật | 156 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 4. Sinh sản ở sinh vật | 25 | Sinh sản ở thực vật | 159 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 4. Sinh sản ở sinh vật | 26 | Thực hành: Nhân giống vô tính và thụ phấn cho cây | 167 | Thực hành | chưa có |  | pending |
| Sinh học 11 | Chương 4. Sinh sản ở sinh vật | 27 | Sinh sản ở động vật | 170 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 5. Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật và một số ngành nghề liên quan đến sinh học cơ thể | 28 | Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật | 183 | Lí thuyết | chưa có |  | pending |
| Sinh học 11 | Chương 5. Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật và một số ngành nghề liên quan đến sinh học cơ thể | 29 | Một số ngành nghề liên quan đến sinh học cơ thể | 185 | Ngành nghề | chưa có |  | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 1 | DNA và cơ chế tái bản DNA | 5 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 2 | Gene, hệ gene và quá trình truyền đạt thông tin di truyền | 9 | Lí thuyết | ADN → mARN → Protein | Tên Bài 2: quá trình truyền đạt thông tin di truyền (Bài 1 về DNA và tái bản: giáo viên quyết định). | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 3 | Điều hoà biểu hiện gene | 18 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 4 | Đột biến gene | 23 | Lí thuyết | Đột biến điểm | Tên Bài 4: đột biến gene. | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 5 | Công nghệ gene | 27 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 6 | Thực hành: Tách chiết DNA | 32 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 7 | Cấu trúc và chức năng của nhiễm sắc thể | 36 | Lí thuyết | Từ tế bào đến DNA | Tên Bài 7: cấu trúc và chức năng của nhiễm sắc thể (cấp NST kép, sợi nhiễm sắc, nucleosome, DNA). | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 8 | Học thuyết di truyền Mendel | 40 | Lí thuyết | Di truyền Mendel | Tên Bài 8–9: học thuyết di truyền Mendel và mở rộng học thuyết Mendel (cảnh chỉ mở rộng tới trội không hoàn toàn). | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 9 | Mở rộng học thuyết Mendel | 46 | Lí thuyết | Di truyền Mendel | Tên Bài 8–9: học thuyết di truyền Mendel và mở rộng học thuyết Mendel (cảnh chỉ mở rộng tới trội không hoàn toàn). | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 10 | Di truyền giới tính và di truyền liên kết với giới tính | 50 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 11 | Liên kết gene và hoán vị gene | 54 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 12 | Đột biến nhiễm sắc thể | 60 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 13 | Di truyền học người và di truyền y học | 68 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 14 | Thực hành: Quan sát một số dạng đột biến nhiễm sắc thể | 75 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 3. Mở rộng học thuyết di truyền nhiễm sắc thể | 15 | Di truyền gene ngoài nhân | 78 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 3. Mở rộng học thuyết di truyền nhiễm sắc thể | 16 | Tương tác giữa kiểu gene với môi trường và thành tựu chọn giống | 83 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 3. Mở rộng học thuyết di truyền nhiễm sắc thể | 17 | Thực hành: Thí nghiệm về thường biến ở cây trồng | 88 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 4. Di truyền quần thể | 18 | Di truyền học quần thể | 91 | Lí thuyết | Định luật Hardy–Weinberg | Tên Bài 18: di truyền học quần thể. | pending |
| Sinh học 12 | Chương 5. Bằng chứng và các học thuyết tiến hoá | 19 | Các bằng chứng tiến hoá | 97 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 5. Bằng chứng và các học thuyết tiến hoá | 20 | Quan niệm của Darwin về chọn lọc tự nhiên và hình thành loài | 101 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 5. Bằng chứng và các học thuyết tiến hoá | 21 | Học thuyết tiến hoá tổng hợp hiện đại | 106 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 5. Bằng chứng và các học thuyết tiến hoá | 22 | Tiến hoá lớn và quá trình phát sinh chủng loại | 113 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 6. Môi trường và sinh thái học quần thể | 23 | Môi trường và các nhân tố sinh thái | 122 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 6. Môi trường và sinh thái học quần thể | 24 | Sinh thái học quần thể | 128 | Lí thuyết | Tăng trưởng logistic | Tên Bài 24: sinh thái học quần thể. | pending |
| Sinh học 12 | Chương 6. Môi trường và sinh thái học quần thể | 25 | Thực hành: Xác định một số đặc trưng của quần thể | 138 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 26 | Quần xã sinh vật | 141 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 27 | Thực hành: Tìm hiểu cấu trúc dinh dưỡng của quần xã trong tự nhiên | 150 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 28 | Hệ sinh thái | 152 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 29 | Trao đổi vật chất và chuyển hoá năng lượng trong hệ sinh thái | 155 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 30 | Diễn thế sinh thái | 161 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 31 | Sinh quyển, khu sinh học và chu trình sinh - địa - hoá | 165 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 7. Sinh thái học quần xã | 32 | Thực hành: Thiết kế một hệ sinh thái nhân tạo | 172 | Thực hành | chưa có |  | pending |
| Sinh học 12 | Chương 8. Sinh thái học phục hồi, bảo tồn và phát triển bền vững | 33 | Sinh thái học phục hồi và bảo tồn đa dạng sinh vật | 175 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 8. Sinh thái học phục hồi, bảo tồn và phát triển bền vững | 34 | Phát triển bền vững | 180 | Lí thuyết | chưa có |  | pending |
| Sinh học 12 | Chương 8. Sinh thái học phục hồi, bảo tồn và phát triển bền vững | 35 | Dự án: Tìm hiểu thực trạng bảo tồn hệ sinh thái tại địa phương và đề xuất giải pháp bảo tồn | 188 | Dự án | chưa có |  | pending |

## Chủ đề chưa xếp lớp

Tên bài SGK chưa nói rõ chủ đề, hoặc không có bài nào: để "Chưa xếp lớp" cho tới khi giáo viên chọn (khi thư viện có thanh chia lớp, các chủ đề này chỉ hiện ở "Tất cả").

| Môn | Chủ đề SimLab | Lí do | review_status |
| --- | --- | --- | --- |
| Vật lí | Mặt phẳng nghiêng | Không bài nào có tên về mặt phẳng nghiêng; cảnh dùng cùng mô hình với "Các định luật Newton" (định luật 2 Newton, lực ma sát). Bài có thể liên quan: VL10 Bài 13, 15, 18. | pending |
| Vật lí | Ròng rọc – dây nối | Không bài nào có tên về ròng rọc; tên Bài 17 có nêu lực căng (cảnh tính lực căng dây) nhưng không nêu hệ ròng rọc. Bài có thể liên quan: VL10 Bài 17. | pending |
| Vật lí | Lò xo (định luật Hooke) | Tên Bài 33 là biến dạng của vật rắn (cảnh vẽ lực đàn hồi theo độ biến dạng), không nêu định luật Hooke. Bài có thể liên quan: VL10 Bài 33. | pending |
| Hoá học | Mô hình Bohr | Không bài nào có tên về mô hình Bohr; chưa rõ thuộc Bài 1 hay Bài 3. Bài có thể liên quan: HH10 Bài 1 hoặc 3. | pending |
| Hoá học | Phân tử 3D | Không bài nào trong ba cuốn Hoá học có tên về hình học phân tử 3D. Bài có thể liên quan: —. | pending |
| Hoá học | Hình học phân tử (VSEPR) | Không bài nào trong ba cuốn Hoá học có tên về mô hình VSEPR. Bài có thể liên quan: —. | pending |
| Hoá học | Độ phân cực liên kết | Tên Bài 11–12 là liên kết ion và liên kết cộng hoá trị, không nêu độ phân cực. Bài có thể liên quan: HH10 Bài 11, 12. | pending |
| Hoá học | Thư viện phản ứng đã kiểm chứng | Thư viện nhiều phản ứng, không ứng với một bài. Bài có thể liên quan: —. | pending |
| Hoá học | Cân bằng phương trình | Không bài nào có tên về cân bằng phương trình; Bài 15 (phản ứng oxi hoá – khử) chỉ liên quan một phần. Bài có thể liên quan: HH10 Bài 15. | pending |
| Hoá học | Phân bố Maxwell–Boltzmann | Không bài nào trong ba cuốn Hoá học có tên về phân bố Maxwell–Boltzmann; hai bài Vật lí 12 nói về mô hình động học phân tử chất khí. Bài có thể liên quan: VL12 Bài 8, 12 (sách Vật lí; trong app chủ đề thuộc Hoá học). | pending |
| Sinh học | Động học enzyme (Michaelis–Menten) | Không bài nào có tên về động học enzyme. Bài có thể liên quan: SH10 Bài 13–15. | pending |
| Sinh học | Con mồi – vật ăn thịt (Lotka–Volterra) | Tên Bài 26 là quần xã sinh vật, không nêu quan hệ con mồi – vật ăn thịt. Bài có thể liên quan: SH12 Bài 26. | pending |
| Hoá học | Chuẩn độ acid – base | Tên Bài 2 là cân bằng trong dung dịch nước, không nêu chuẩn độ acid – base. Bài có thể liên quan: HH11 Bài 2. | pending |
| Sinh học | Phiêu bạt di truyền | Tên Bài 18, 21 là di truyền học quần thể và học thuyết tiến hoá tổng hợp hiện đại, không nêu phiêu bạt di truyền. Bài có thể liên quan: SH12 Bài 18, 21. | pending |
| Vật lí | Định luật II Kepler | Không bài nào trong ba cuốn Vật lí có tên về định luật Kepler; chuyên đề học tập không thuộc 9 cuốn nên giáo viên kiểm. Bài có thể liên quan: — (ngoài 9 cuốn; có thể thuộc chuyên đề Vật lí 11 “Trường hấp dẫn”). | pending |
| Vật lí | Hoạ âm và chuỗi Fourier | Không bài nào có tên về hoạ âm hay chuỗi Fourier; hoạ âm của dây chỉ là một phần của Bài 13 (sóng dừng). Bài có thể liên quan: VL11 Bài 13 (mở rộng). | pending |
