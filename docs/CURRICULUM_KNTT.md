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
| Vật lí 10 | 34 | 26 | 16 |
| Vật lí 11 | 26 | 20 | 5 |
| Vật lí 12 | 25 | 21 | 0 |
| Hoá học 10 | 23 | 16 | 5 |
| Hoá học 11 | 25 | 19 | 1 |
| Hoá học 12 | 30 | 22 | 0 |
| Sinh học 10 | 26 | 17 | 5 |
| Sinh học 11 | 29 | 20 | 0 |
| Sinh học 12 | 35 | 28 | 6 |
| **Cộng** | **253** | **189** | **38** |

Các chỗ đếm có thể khác (giáo viên chọn):

- VL10 Bài 1 (Làm quen với Vật lí) tính là mở đầu môn học; VL10 Bài 3 (Thực hành tính sai số…, không có dấu hai chấm) tính là thực hành.
- VL10 Bài 2 (quy tắc an toàn) tính là mở đầu môn học; VL10 Bài 20 (Một số ví dụ về cách giải…) tính là bài tập.
- SH10 Bài 1–2 tính là mở đầu môn học; SH10 Bài 3 tính là lí thuyết.
- SH11 Bài 29 (ngành nghề) không tính là lí thuyết.
- HH10 "Mở đầu" không đánh số: không tính vào tổng số bài.

## Bài SGK ↔ chủ đề SimLab

Gồm các bài đã có chủ đề SimLab (đề xuất) và các bài của kế hoạch 0.8.0 Phần A (#37). Các bài khác sẽ thêm ở 0.8.1 (#54).

| Sách | Chương | Bài | Tên bài | Trang | Loại | Chủ đề SimLab | Ghi chú | review_status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vật lí 10 | Chương II. Động học | 4 | Độ dịch chuyển và quãng đường đi được | 21 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 5 | Tốc độ và vận tốc | 26 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 7 | Đồ thị độ dịch chuyển – thời gian | 34 | Lí thuyết | Chuyển động thẳng đều | Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian). | pending |
| Vật lí 10 | Chương II. Động học | 8 | Chuyển động biến đổi. Gia tốc | 37 | Lí thuyết | Chuyển động thẳng biến đổi đều | Tên Bài 8–9: gia tốc và chuyển động thẳng biến đổi đều. | pending |
| Vật lí 10 | Chương II. Động học | 9 | Chuyển động thẳng biến đổi đều | 40 | Lí thuyết | Chuyển động thẳng biến đổi đều | Tên Bài 8–9: gia tốc và chuyển động thẳng biến đổi đều. | pending |
| Vật lí 10 | Chương II. Động học | 10 | Sự rơi tự do | 44 | Lí thuyết | Rơi tự do | Tên Bài 10: sự rơi tự do. | pending |
| Vật lí 10 | Chương II. Động học | 12 | Chuyển động ném | 49 | Lí thuyết | Ném ngang, Ném xiên | Tên Bài 12: chuyển động ném. | pending |
| Vật lí 10 | Chương III. Động lực học | 14 | Định luật 1 Newton | 60 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương III. Động lực học | 15 | Định luật 2 Newton | 63 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương III. Động lực học | 18 | Lực ma sát | 72 | Lí thuyết | Các định luật Newton | Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3). | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 25 | Động năng, thế năng | 99 | Lí thuyết | Bảo toàn cơ năng | Tên Bài 25–26: động năng, thế năng, cơ năng và định luật bảo toàn cơ năng. | pending |
| Vật lí 10 | Chương IV. Năng lượng, công, công suất | 26 | Cơ năng và định luật bảo toàn cơ năng | 102 | Lí thuyết | Bảo toàn cơ năng | Tên Bài 25–26: động năng, thế năng, cơ năng và định luật bảo toàn cơ năng. | pending |
| Vật lí 10 | Chương V. Động lượng | 28 | Động lượng | 110 | Lí thuyết | Va chạm đàn hồi và va chạm mềm | Tên Bài 28–29: động lượng và định luật bảo toàn động lượng. | pending |
| Vật lí 10 | Chương V. Động lượng | 29 | Định luật bảo toàn động lượng | 113 | Lí thuyết | Va chạm đàn hồi và va chạm mềm | Tên Bài 28–29: động lượng và định luật bảo toàn động lượng. | pending |
| Vật lí 10 | Chương VI. Chuyển động tròn đều | 31 | Động học của chuyển động tròn đều | 120 | Lí thuyết | Chuyển động tròn đều | Tên Bài 31–32: động học của chuyển động tròn đều; lực hướng tâm và gia tốc hướng tâm. | pending |
| Vật lí 10 | Chương VI. Chuyển động tròn đều | 32 | Lực hướng tâm và gia tốc hướng tâm | 123 | Lí thuyết | Chuyển động tròn đều | Tên Bài 31–32: động học của chuyển động tròn đều; lực hướng tâm và gia tốc hướng tâm. | pending |
| Vật lí 11 | Chương I. Dao động | 1 | Dao động điều hoà | 6 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 2 | Mô tả dao động điều hoà | 10 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 3 | Vận tốc, gia tốc trong dao động điều hoà | 14 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 5 | Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà | 20 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương I. Dao động | 6 | Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng | 24 | Lí thuyết | Con lắc lò xo, Con lắc đơn | Con lắc lò xo: Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). Con lắc đơn: Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng). | pending |
| Vật lí 11 | Chương II. Sóng | 13 | Sóng dừng | 52 | Lí thuyết | chưa có — kế hoạch (b) Sóng dừng trên dây | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương III. Điện trường | 16 | Lực tương tác giữa các điện tích | 61 | Lí thuyết | chưa có — kế hoạch (d) Điện trường | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương III. Điện trường | 17 | Khái niệm điện trường | 65 | Lí thuyết | chưa có — kế hoạch (d) Điện trường | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương III. Điện trường | 18 | Điện trường đều | 71 | Lí thuyết | chưa có — kế hoạch (d) Điện trường | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 23 | Điện trở. Định luật Ohm | 95 | Lí thuyết | chưa có — kế hoạch (e) Mạch điện một chiều, chuyển sang 0.8.1 | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 24 | Nguồn điện | 102 | Lí thuyết | chưa có — kế hoạch (e) Mạch điện một chiều, chuyển sang 0.8.1 | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Vật lí 11 | Chương IV. Dòng điện. Mạch điện | 25 | Năng lượng và công suất điện | 106 | Lí thuyết | chưa có — kế hoạch (e) Mạch điện một chiều, chuyển sang 0.8.1 | Bài của 0.8.0 Phần A (#37 mục 4.2). | pending |
| Hoá học 10 | Chương 1. Cấu tạo nguyên tử | 3 | Cấu trúc lớp vỏ electron nguyên tử | 21 | Lí thuyết | Cấu hình electron, Hình dạng orbital | Tên Bài 3: cấu trúc lớp vỏ electron nguyên tử. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 5 | Cấu tạo của bảng tuần hoàn các nguyên tố hoá học | 30 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 6 | Xu hướng biến đổi một số tính chất của nguyên tử các nguyên tố trong một chu kì và trong một nhóm | 34 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn | 8 | Định luật tuần hoàn. Ý nghĩa của bảng tuần hoàn các nguyên tố hoá học | 43 | Lí thuyết | Bảng tuần hoàn | Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn. | pending |
| Hoá học 10 | Chương 6. Tốc độ phản ứng | 19 | Tốc độ phản ứng | 92 | Lí thuyết | Thuyết va chạm | Tên Bài 19: tốc độ phản ứng. | pending |
| Hoá học 11 | Chương 1. Cân bằng hoá học | 1 | Khái niệm về cân bằng hoá học | 6 | Lí thuyết | Cân bằng hóa học & Le Chatelier | Tên Bài 1: khái niệm về cân bằng hoá học. | pending |
| Sinh học 10 | Chương 2. Cấu trúc tế bào | 7 | Tế bào nhân sơ | 44 | Lí thuyết | Tế bào nhân sơ và nhân thực | Tên Bài 7–8: tế bào nhân sơ và tế bào nhân thực. | pending |
| Sinh học 10 | Chương 2. Cấu trúc tế bào | 8 | Tế bào nhân thực | 48 | Lí thuyết | Tế bào nhân sơ và nhân thực | Tên Bài 7–8: tế bào nhân sơ và tế bào nhân thực. | pending |
| Sinh học 10 | Chương 3. Trao đổi chất qua màng và truyền tin tế bào | 10 | Trao đổi chất qua màng tế bào | 64 | Lí thuyết | Khuếch tán & thẩm thấu | Tên Bài 10: trao đổi chất qua màng tế bào. Chỉ phần vận chuyển thụ động (khuếch tán, thẩm thấu), trên mô hình hai ngăn và ống chữ U, không phải màng tế bào thật. | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 16 | Chu kì tế bào và nguyên phân | 97 | Lí thuyết | Nguyên phân | Tên Bài 16: chu kì tế bào và nguyên phân. | pending |
| Sinh học 10 | Chương 5. Chu kì tế bào và phân bào | 17 | Giảm phân | 104 | Lí thuyết | Giảm phân | Tên Bài 17: giảm phân. | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 2 | Gene, hệ gene và quá trình truyền đạt thông tin di truyền | 9 | Lí thuyết | ADN → mARN → Protein | Tên Bài 2: quá trình truyền đạt thông tin di truyền (Bài 1 về DNA và tái bản: giáo viên quyết định). | pending |
| Sinh học 12 | Chương 1. Di truyền phân tử | 4 | Đột biến gene | 23 | Lí thuyết | Đột biến điểm | Tên Bài 4: đột biến gene. | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 8 | Học thuyết di truyền Mendel | 40 | Lí thuyết | Di truyền Mendel | Tên Bài 8–9: học thuyết di truyền Mendel và mở rộng học thuyết Mendel (cảnh chỉ mở rộng tới trội không hoàn toàn). | pending |
| Sinh học 12 | Chương 2. Di truyền nhiễm sắc thể | 9 | Mở rộng học thuyết Mendel | 46 | Lí thuyết | Di truyền Mendel | Tên Bài 8–9: học thuyết di truyền Mendel và mở rộng học thuyết Mendel (cảnh chỉ mở rộng tới trội không hoàn toàn). | pending |
| Sinh học 12 | Chương 4. Di truyền quần thể | 18 | Di truyền học quần thể | 91 | Lí thuyết | Định luật Hardy–Weinberg | Tên Bài 18: di truyền học quần thể. | pending |
| Sinh học 12 | Chương 6. Môi trường và sinh thái học quần thể | 24 | Sinh thái học quần thể | 128 | Lí thuyết | Tăng trưởng logistic | Tên Bài 24: sinh thái học quần thể. | pending |

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
| Sinh học | Phiêu bạt di truyền | Tên Bài 18, 21 là di truyền học quần thể và học thuyết tiến hoá tổng hợp hiện đại, không nêu phiêu bạt di truyền. Bài có thể liên quan: SH12 Bài 18, 21. | pending |
