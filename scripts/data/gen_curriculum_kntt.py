"""Generate data/curriculum_kntt.json and docs/CURRICULUM_KNTT.md: where SimLab's topics sit in
the textbooks "Kết nối tri thức với cuộc sống" (NXB Giáo dục Việt Nam), Vật lí / Hoá học /
Sinh học 10–12.

Source: the official tables of contents (MỤC LỤC, printed page 4–5 of each book) in NXBGD's
training reader https://taphuan.nxbgd.vn/tap-huan/doc-sach/<book>, page images uploaded in
April 2026, read on 26/10/2026. Chapter and lesson titles are copied verbatim (the table of
contents prints chapter names in capitals; `label` is the same words in normal case). Only titles
are copied, never the books' content. Everything is review_status "pending": a teacher has not
checked the placements yet (plan #37 §3.3, user decision 2026-10-22; DATA_REVIEW 12, KNTT-*).

Placement rule: a topic is placed only when a lesson title clearly names what the topic shows;
otherwise it stays unplaced with its reason and the candidate lessons. Never guess.

    python scripts/data/gen_curriculum_kntt.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT_JSON = ROOT / "data" / "curriculum_kntt.json"
OUT_MD = ROOT / "docs" / "CURRICULUM_KNTT.md"
VI = ROOT / "src" / "app" / "i18n" / "locales" / "vi.ts"
ACCESSED = "2026-10-26"
READER = "https://taphuan.nxbgd.vn/tap-huan/doc-sach/"

# id, subject, grade, title, reader slug, printed pages of the MỤC LỤC
BOOKS = [
    ("VL10", "physics", 10, "Vật lí 10", "sgk-vat-li-10.4700746482", [4]),
    ("VL11", "physics", 11, "Vật lí 11", "sgk-vat-li-11.4701093133", [4]),
    ("VL12", "physics", 12, "Vật lí 12", "shs-vat-li-12.4701697631", [4]),
    ("HH10", "chemistry", 10, "Hoá học 10", "sgk-hoa-hoc-10.4700854983", [4, 5]),
    ("HH11", "chemistry", 11, "Hoá học 11", "sgk-hoa-hoc-11.4701111834", [4, 5]),
    ("HH12", "chemistry", 12, "Hoá học 12", "sgk-hoa-hoc-12.4701708102", [4, 5]),
    ("SH10", "biology", 10, "Sinh học 10", "sgk-sinh-hoc-10.4700819489", [4]),
    ("SH11", "biology", 11, "Sinh học 11", "sgk-sinh-hoc-11.4701129740", [4]),
    ("SH12", "biology", 12, "Sinh học 12", "sgk-sinh-hoc-12.4701665546", [4]),
]

# Table of contents, verbatim: (printed heading, label in normal case, part label or None,
# [(lesson number or None, title, page)]). Front and back matter (Hướng dẫn sử dụng sách, Lời nói
# đầu, Bảng đơn vị…, Giải thích một số thuật ngữ…) are left out. HH10's unnumbered "Mở đầu" row
# and SH10's "PHẦN MỞ ĐẦU" (Bài 1–3, no chapter) are kept as their own group.
TOC = {
    "VL10": [
        ("CHƯƠNG I. MỞ ĐẦU", "Chương I. Mở đầu", None, [
            (1, "Làm quen với Vật lí", 7),
            (2, "Các quy tắc an toàn trong phòng thực hành Vật lí", 12),
            (3, "Thực hành tính sai số trong phép đo. Ghi kết quả đo", 17),
        ]),
        ("CHƯƠNG II. ĐỘNG HỌC", "Chương II. Động học", None, [
            (4, "Độ dịch chuyển và quãng đường đi được", 21),
            (5, "Tốc độ và vận tốc", 26),
            (6, "Thực hành: Đo tốc độ của vật chuyển động", 30),
            (7, "Đồ thị độ dịch chuyển – thời gian", 34),
            (8, "Chuyển động biến đổi. Gia tốc", 37),
            (9, "Chuyển động thẳng biến đổi đều", 40),
            (10, "Sự rơi tự do", 44),
            (11, "Thực hành: Đo gia tốc rơi tự do", 47),
            (12, "Chuyển động ném", 49),
        ]),
        ("CHƯƠNG III. ĐỘNG LỰC HỌC", "Chương III. Động lực học", None, [
            (13, "Tổng hợp và phân tích lực. Cân bằng lực", 56),
            (14, "Định luật 1 Newton", 60),
            (15, "Định luật 2 Newton", 63),
            (16, "Định luật 3 Newton", 67),
            (17, "Trọng lực và lực căng", 69),
            (18, "Lực ma sát", 72),
            (19, "Lực cản và lực nâng", 77),
            (20, "Một số ví dụ về cách giải các bài toán thuộc phần động lực học", 80),
            (21, "Moment lực. Cân bằng của vật rắn", 83),
            (22, "Thực hành: Tổng hợp lực", 86),
        ]),
        ("CHƯƠNG IV. NĂNG LƯỢNG, CÔNG, CÔNG SUẤT", "Chương IV. Năng lượng, công, công suất", None, [
            (23, "Năng lượng. Công cơ học", 91),
            (24, "Công suất", 96),
            (25, "Động năng, thế năng", 99),
            (26, "Cơ năng và định luật bảo toàn cơ năng", 102),
            (27, "Hiệu suất", 106),
        ]),
        ("CHƯƠNG V. ĐỘNG LƯỢNG", "Chương V. Động lượng", None, [
            (28, "Động lượng", 110),
            (29, "Định luật bảo toàn động lượng", 113),
            (30, "Thực hành: Xác định động lượng của vật trước và sau va chạm", 116),
        ]),
        ("CHƯƠNG VI. CHUYỂN ĐỘNG TRÒN ĐỀU", "Chương VI. Chuyển động tròn đều", None, [
            (31, "Động học của chuyển động tròn đều", 120),
            (32, "Lực hướng tâm và gia tốc hướng tâm", 123),
        ]),
        ("CHƯƠNG VII. BIẾN DẠNG CỦA VẬT RẮN. ÁP SUẤT CHẤT LỎNG", "Chương VII. Biến dạng của vật rắn. Áp suất chất lỏng", None, [
            (33, "Biến dạng của vật rắn", 128),
            (34, "Khối lượng riêng. Áp suất chất lỏng", 131),
        ]),
    ],
    "VL11": [
        ("Chương I. DAO ĐỘNG", "Chương I. Dao động", None, [
            (1, "Dao động điều hoà", 6),
            (2, "Mô tả dao động điều hoà", 10),
            (3, "Vận tốc, gia tốc trong dao động điều hoà", 14),
            (4, "Bài tập về dao động điều hoà", 17),
            (5, "Động năng. Thế năng. Sự chuyển hoá năng lượng trong dao động điều hoà", 20),
            (6, "Dao động tắt dần. Dao động cưỡng bức. Hiện tượng cộng hưởng", 24),
            (7, "Bài tập về sự chuyển hoá năng lượng trong dao động điều hoà", 28),
        ]),
        ("Chương II. SÓNG", "Chương II. Sóng", None, [
            (8, "Mô tả sóng", 32),
            (9, "Sóng ngang. Sóng dọc. Sự truyền năng lượng của sóng cơ", 37),
            (10, "Thực hành: Đo tần số của sóng âm", 41),
            (11, "Sóng điện từ", 44),
            (12, "Giao thoa sóng", 48),
            (13, "Sóng dừng", 52),
            (14, "Bài tập về sóng", 55),
            (15, "Thực hành: Đo tốc độ truyền âm", 58),
        ]),
        ("Chương III. ĐIỆN TRƯỜNG", "Chương III. Điện trường", None, [
            (16, "Lực tương tác giữa các điện tích", 61),
            (17, "Khái niệm điện trường", 65),
            (18, "Điện trường đều", 71),
            (19, "Thế năng điện", 76),
            (20, "Điện thế", 79),
            (21, "Tụ điện", 83),
        ]),
        ("Chương IV. DÒNG ĐIỆN. MẠCH ĐIỆN", "Chương IV. Dòng điện. Mạch điện", None, [
            (22, "Cường độ dòng điện", 91),
            (23, "Điện trở. Định luật Ohm", 95),
            (24, "Nguồn điện", 102),
            (25, "Năng lượng và công suất điện", 106),
            (26, "Thực hành: Đo suất điện động và điện trở trong của pin điện hoá", 111),
        ]),
    ],
    "VL12": [
        ("Chương I. VẬT LÍ NHIỆT", "Chương I. Vật lí nhiệt", None, [
            (1, "Cấu trúc của chất. Sự chuyển thể", 6),
            (2, "Nội năng. Định luật I của nhiệt động lực học", 10),
            (3, "Nhiệt độ. Thang nhiệt độ – nhiệt kế", 15),
            (4, "Nhiệt dung riêng", 20),
            (5, "Nhiệt nóng chảy riêng", 24),
            (6, "Nhiệt hoá hơi riêng", 27),
            (7, "Bài tập về vật lí nhiệt", 30),
        ]),
        ("Chương II. KHÍ LÍ TƯỞNG", "Chương II. Khí lí tưởng", None, [
            (8, "Mô hình động học phân tử chất khí", 34),
            (9, "Định luật Boyle", 37),
            (10, "Định luật Charles", 41),
            (11, "Phương trình trạng thái của khí lí tưởng", 45),
            (12, "Áp suất khí theo mô hình động học phân tử. Quan hệ giữa động năng phân tử và nhiệt độ", 48),
            (13, "Bài tập về khí lí tưởng", 52),
        ]),
        ("Chương III. TỪ TRƯỜNG", "Chương III. Từ trường", None, [
            (14, "Từ trường", 56),
            (15, "Lực từ tác dụng lên dây dẫn mang dòng điện. Cảm ứng từ", 61),
            (16, "Từ thông. Hiện tượng cảm ứng điện từ", 66),
            (17, "Máy phát điện xoay chiều", 72),
            (18, "Ứng dụng hiện tượng cảm ứng điện từ", 78),
            (19, "Điện từ trường. Mô hình sóng điện từ", 82),
            (20, "Bài tập về từ trường", 86),
        ]),
        ("Chương IV. VẬT LÍ HẠT NHÂN", "Chương IV. Vật lí hạt nhân", None, [
            (21, "Cấu trúc hạt nhân", 91),
            (22, "Phản ứng hạt nhân và năng lượng liên kết", 96),
            (23, "Hiện tượng phóng xạ", 104),
            (24, "Công nghiệp hạt nhân", 114),
            (25, "Bài tập về vật lí hạt nhân", 119),
        ]),
    ],
    "HH10": [
        ("Mở đầu", "Mở đầu", None, [
            (None, "Mở đầu", 6),
        ]),
        ("Chương 1. Cấu tạo nguyên tử", "Chương 1. Cấu tạo nguyên tử", None, [
            (1, "Thành phần của nguyên tử", 13),
            (2, "Nguyên tố hoá học", 17),
            (3, "Cấu trúc lớp vỏ electron nguyên tử", 21),
            (4, "Ôn tập chương 1", 26),
        ]),
        ("Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn", "Chương 2. Bảng tuần hoàn các nguyên tố hoá học và định luật tuần hoàn", None, [
            (5, "Cấu tạo của bảng tuần hoàn các nguyên tố hoá học", 30),
            (6, "Xu hướng biến đổi một số tính chất của nguyên tử các nguyên tố trong một chu kì và trong một nhóm", 34),
            (7, "Xu hướng biến đổi thành phần và một số tính chất của hợp chất trong một chu kì", 40),
            (8, "Định luật tuần hoàn. Ý nghĩa của bảng tuần hoàn các nguyên tố hoá học", 43),
            (9, "Ôn tập chương 2", 45),
        ]),
        ("Chương 3. Liên kết hoá học", "Chương 3. Liên kết hoá học", None, [
            (10, "Quy tắc octet", 49),
            (11, "Liên kết ion", 51),
            (12, "Liên kết cộng hoá trị", 55),
            (13, "Liên kết hydrogen và tương tác van der Waals", 64),
            (14, "Ôn tập chương 3", 68),
        ]),
        ("Chương 4. Phản ứng oxi hoá – khử", "Chương 4. Phản ứng oxi hoá – khử", None, [
            (15, "Phản ứng oxi hoá – khử", 71),
            (16, "Ôn tập chương 4", 78),
        ]),
        ("Chương 5. Năng lượng hoá học", "Chương 5. Năng lượng hoá học", None, [
            (17, "Biến thiên enthalpy trong các phản ứng hoá học", 81),
            (18, "Ôn tập chương 5", 89),
        ]),
        ("Chương 6. Tốc độ phản ứng", "Chương 6. Tốc độ phản ứng", None, [
            (19, "Tốc độ phản ứng", 92),
            (20, "Ôn tập chương 6", 101),
        ]),
        ("Chương 7. Nguyên tố nhóm halogen", "Chương 7. Nguyên tố nhóm halogen", None, [
            (21, "Nhóm halogen", 104),
            (22, "Hydrogen halide · Muối halide", 112),
            (23, "Ôn tập chương 7", 117),
        ]),
    ],
    "HH11": [
        ("Chương 1. CÂN BẰNG HOÁ HỌC", "Chương 1. Cân bằng hoá học", None, [
            (1, "Khái niệm về cân bằng hoá học", 6),
            (2, "Cân bằng trong dung dịch nước", 16),
            (3, "Ôn tập chương 1", 27),
        ]),
        ("Chương 2. NITROGEN – SULFUR", "Chương 2. Nitrogen – sulfur", None, [
            (4, "Nitrogen", 29),
            (5, "Ammonia • Muối ammonium", 33),
            (6, "Một số hợp chất của nitrogen với oxygen", 38),
            (7, "Sulfur và sulfur dioxide", 42),
            (8, "Sulfuric acid và muối sulfate", 48),
            (9, "Ôn tập chương 2", 55),
        ]),
        ("Chương 3. ĐẠI CƯƠNG VỀ HOÁ HỌC HỮU CƠ", "Chương 3. Đại cương về hoá học hữu cơ", None, [
            (10, "Hợp chất hữu cơ và hoá học hữu cơ", 57),
            (11, "Phương pháp tách biệt và tinh chế hợp chất hữu cơ", 63),
            (12, "Công thức phân tử hợp chất hữu cơ", 70),
            (13, "Cấu tạo hoá học hợp chất hữu cơ", 74),
            (14, "Ôn tập chương 3", 80),
        ]),
        ("Chương 4. HYDROCARBON", "Chương 4. Hydrocarbon", None, [
            (15, "Alkane", 82),
            (16, "Hydrocarbon không no", 92),
            (17, "Arene (Hydrocarbon thơm)", 102),
            (18, "Ôn tập chương 4", 110),
        ]),
        ("Chương 5. DẪN XUẤT HALOGEN – ALCOHOL – PHENOL", "Chương 5. Dẫn xuất halogen – alcohol – phenol", None, [
            (19, "Dẫn xuất halogen", 112),
            (20, "Alcohol", 119),
            (21, "Phenol", 129),
            (22, "Ôn tập chương 5", 134),
        ]),
        ("Chương 6. HỢP CHẤT CARBONYL – CARBOXYLIC ACID", "Chương 6. Hợp chất carbonyl – carboxylic acid", None, [
            (23, "Hợp chất carbonyl", 136),
            (24, "Carboxylic acid", 145),
            (25, "Ôn tập chương 6", 153),
        ]),
    ],
    "HH12": [
        ("Chương 1. ESTER – LIPID", "Chương 1. Ester – Lipid", None, [
            (1, "Ester – Lipid", 6),
            (2, "Xà phòng và chất giặt rửa", 14),
            (3, "Ôn tập chương 1", 18),
        ]),
        ("CHƯƠNG 2. CARBOHYDRATE", "Chương 2. Carbohydrate", None, [
            (4, "Giới thiệu về carbohydrate. Glucose và fructose", 20),
            (5, "Saccharose và maltose", 25),
            (6, "Tinh bột và cellulose", 28),
            (7, "Ôn tập chương 2", 33),
        ]),
        ("Chương 3. HỢP CHẤT CHỨA NITROGEN", "Chương 3. Hợp chất chứa nitrogen", None, [
            (8, "Amine", 35),
            (9, "Amino acid và peptide", 41),
            (10, "Protein và enzyme", 46),
            (11, "Ôn tập chương 3", 49),
        ]),
        ("Chương 4. POLYMER", "Chương 4. Polymer", None, [
            (12, "Đại cương về polymer", 51),
            (13, "Vật liệu polymer", 56),
            (14, "Ôn tập chương 4", 65),
        ]),
        ("Chương 5. PIN ĐIỆN VÀ ĐIỆN PHÂN", "Chương 5. Pin điện và điện phân", None, [
            (15, "Thế điện cực và nguồn điện hoá học", 67),
            (16, "Điện phân", 78),
            (17, "Ôn tập chương 5", 85),
        ]),
        ("Chương 6. ĐẠI CƯƠNG VỀ KIM LOẠI", "Chương 6. Đại cương về kim loại", None, [
            (18, "Cấu tạo và liên kết trong tinh thể kim loại", 87),
            (19, "Tính chất vật lí và tính chất hoá học của kim loại", 89),
            (20, "Kim loại trong tự nhiên và phương pháp tách kim loại", 94),
            (21, "Hợp kim", 99),
            (22, "Sự ăn mòn kim loại", 102),
            (23, "Ôn tập chương 6", 106),
        ]),
        ("Chương 7. NGUYÊN TỐ NHÓM IA VÀ NHÓM IIA", "Chương 7. Nguyên tố nhóm IA và nhóm IIA", None, [
            (24, "Nguyên tố nhóm IA", 108),
            (25, "Nguyên tố nhóm IIA", 116),
            (26, "Ôn tập chương 7", 126),
        ]),
        ("Chương 8. SƠ LƯỢC VỀ DÃY KIM LOẠI CHUYỂN TIẾP THỨ NHẤT VÀ PHỨC CHẤT", "Chương 8. Sơ lược về dãy kim loại chuyển tiếp thứ nhất và phức chất", None, [
            (27, "Đại cương về kim loại chuyển tiếp dãy thứ nhất", 128),
            (28, "Sơ lược về phức chất", 134),
            (29, "Một số tính chất và ứng dụng của phức chất", 138),
            (30, "Ôn tập chương 8", 142),
        ]),
    ],
    "SH10": [
        ("PHẦN MỞ ĐẦU", "Phần mở đầu", None, [
            (1, "Giới thiệu khái quát môn Sinh học", 5),
            (2, "Phương pháp nghiên cứu và học tập môn Sinh học", 12),
            (3, "Các cấp độ tổ chức của thế giới sống", 18),
        ]),
        ("CHƯƠNG 1 THÀNH PHẦN HOÁ HỌC CỦA TẾ BÀO", "Chương 1. Thành phần hoá học của tế bào", "Phần một. Sinh học tế bào", [
            (4, "Các nguyên tố hoá học và nước", 23),
            (5, "Các phân tử sinh học", 28),
            (6, "Thực hành: Nhận biết một số phân tử sinh học", 41),
        ]),
        ("CHƯƠNG 2 CẤU TRÚC TẾ BÀO", "Chương 2. Cấu trúc tế bào", "Phần một. Sinh học tế bào", [
            (7, "Tế bào nhân sơ", 44),
            (8, "Tế bào nhân thực", 48),
            (9, "Thực hành: Quan sát tế bào", 61),
        ]),
        ("CHƯƠNG 3 TRAO ĐỔI CHẤT QUA MÀNG VÀ TRUYỀN TIN TẾ BÀO", "Chương 3. Trao đổi chất qua màng và truyền tin tế bào", "Phần một. Sinh học tế bào", [
            (10, "Trao đổi chất qua màng tế bào", 64),
            (11, "Thực hành: Thí nghiệm co và phản co nguyên sinh", 71),
            (12, "Truyền tin tế bào", 73),
        ]),
        ("CHƯƠNG 4 CHUYỂN HOÁ NĂNG LƯỢNG TRONG TẾ BÀO", "Chương 4. Chuyển hoá năng lượng trong tế bào", "Phần một. Sinh học tế bào", [
            (13, "Khái quát về chuyển hoá vật chất và năng lượng", 78),
            (14, "Phân giải và tổng hợp các chất trong tế bào", 85),
            (15, "Thực hành: Thí nghiệm phân tích ảnh hưởng của một số yếu tố đến hoạt tính của enzyme và kiểm tra hoạt tính của enzyme amylase", 94),
        ]),
        ("CHƯƠNG 5 CHU KÌ TẾ BÀO VÀ PHÂN BÀO", "Chương 5. Chu kì tế bào và phân bào", "Phần một. Sinh học tế bào", [
            (16, "Chu kì tế bào và nguyên phân", 97),
            (17, "Giảm phân", 104),
            (18, "Thực hành: Làm và quan sát tiêu bản quá trình nguyên phân và giảm phân", 108),
            (19, "Công nghệ tế bào", 110),
        ]),
        ("CHƯƠNG 6 SINH HỌC VI SINH VẬT", "Chương 6. Sinh học vi sinh vật", "Phần hai. Sinh học vi sinh vật và virus", [
            (20, "Sự đa dạng và phương pháp nghiên cứu vi sinh vật", 116),
            (21, "Trao đổi chất, sinh trưởng và sinh sản ở vi sinh vật", 122),
            (22, "Vai trò và ứng dụng của vi sinh vật", 131),
            (23, "Thực hành: Một số phương pháp nghiên cứu vi sinh vật thông dụng, tìm hiểu về các sản phẩm công nghệ vi sinh vật và làm một số sản phẩm lên men từ vi sinh vật", 138),
        ]),
        ("CHƯƠNG 7 VIRUS", "Chương 7. Virus", "Phần hai. Sinh học vi sinh vật và virus", [
            (24, "Khái quát về virus", 141),
            (25, "Một số bệnh do virus và các thành tựu nghiên cứu ứng dụng virus", 145),
            (26, "Thực hành: Điều tra một số bệnh do virus và tuyên truyền phòng chống bệnh", 155),
        ]),
    ],
    "SH11": [
        ("CHƯƠNG 1 TRAO ĐỔI CHẤT VÀ CHUYỂN HOÁ NĂNG LƯỢNG Ở SINH VẬT", "Chương 1. Trao đổi chất và chuyển hoá năng lượng ở sinh vật", "Phần ba. Sinh học cơ thể", [
            (1, "Khái quát về trao đổi chất và chuyển hoá năng lượng", 5),
            (2, "Trao đổi nước và khoáng ở thực vật", 9),
            (3, "Thực hành: Trao đổi nước và khoáng ở thực vật", 22),
            (4, "Quang hợp ở thực vật", 26),
            (5, "Thực hành: Quang hợp ở thực vật", 35),
            (6, "Hô hấp ở thực vật", 38),
            (7, "Thực hành: Hô hấp ở thực vật", 44),
            (8, "Dinh dưỡng và tiêu hoá ở động vật", 46),
            (9, "Hô hấp ở động vật", 54),
            (10, "Tuần hoàn ở động vật", 61),
            (11, "Thực hành: Một số thí nghiệm về hệ tuần hoàn", 69),
            (12, "Miễn dịch ở người và động vật", 72),
            (13, "Bài tiết và cân bằng nội môi", 80),
        ]),
        ("CHƯƠNG 2 CẢM ỨNG Ở SINH VẬT", "Chương 2. Cảm ứng ở sinh vật", "Phần ba. Sinh học cơ thể", [
            (14, "Khái quát về cảm ứng ở sinh vật", 88),
            (15, "Cảm ứng ở thực vật", 90),
            (16, "Thực hành: Cảm ứng ở thực vật", 97),
            (17, "Cảm ứng ở động vật", 100),
            (18, "Tập tính ở động vật", 115),
        ]),
        ("CHƯƠNG 3 SINH TRƯỞNG VÀ PHÁT TRIỂN Ở SINH VẬT", "Chương 3. Sinh trưởng và phát triển ở sinh vật", "Phần ba. Sinh học cơ thể", [
            (19, "Khái quát về sinh trưởng và phát triển ở sinh vật", 125),
            (20, "Sinh trưởng và phát triển ở thực vật", 129),
            (21, "Thực hành: Bấm ngọn, tỉa cành; xử lí kích thích tố và tính tuổi cây", 141),
            (22, "Sinh trưởng và phát triển ở động vật", 145),
            (23, "Thực hành: Quan sát quá trình biến thái ở động vật", 153),
        ]),
        ("CHƯƠNG 4 SINH SẢN Ở SINH VẬT", "Chương 4. Sinh sản ở sinh vật", "Phần ba. Sinh học cơ thể", [
            (24, "Khái quát về sinh sản ở sinh vật", 156),
            (25, "Sinh sản ở thực vật", 159),
            (26, "Thực hành: Nhân giống vô tính và thụ phấn cho cây", 167),
            (27, "Sinh sản ở động vật", 170),
        ]),
        ("CHƯƠNG 5 MỐI QUAN HỆ GIỮA CÁC QUÁ TRÌNH SINH LÍ TRONG CƠ THỂ SINH VẬT VÀ MỘT SỐ NGÀNH NGHỀ LIÊN QUAN ĐẾN SINH HỌC CƠ THỂ", "Chương 5. Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật và một số ngành nghề liên quan đến sinh học cơ thể", "Phần ba. Sinh học cơ thể", [
            (28, "Mối quan hệ giữa các quá trình sinh lí trong cơ thể sinh vật", 183),
            (29, "Một số ngành nghề liên quan đến sinh học cơ thể", 185),
        ]),
    ],
    "SH12": [
        ("Chương 1 DI TRUYỀN PHÂN TỬ", "Chương 1. Di truyền phân tử", "Phần bốn. Di truyền học", [
            (1, "DNA và cơ chế tái bản DNA", 5),
            (2, "Gene, hệ gene và quá trình truyền đạt thông tin di truyền", 9),
            (3, "Điều hoà biểu hiện gene", 18),
            (4, "Đột biến gene", 23),
            (5, "Công nghệ gene", 27),
            (6, "Thực hành: Tách chiết DNA", 32),
        ]),
        ("Chương 2 DI TRUYỀN NHIỄM SẮC THỂ", "Chương 2. Di truyền nhiễm sắc thể", "Phần bốn. Di truyền học", [
            (7, "Cấu trúc và chức năng của nhiễm sắc thể", 36),
            (8, "Học thuyết di truyền Mendel", 40),
            (9, "Mở rộng học thuyết Mendel", 46),
            (10, "Di truyền giới tính và di truyền liên kết với giới tính", 50),
            (11, "Liên kết gene và hoán vị gene", 54),
            (12, "Đột biến nhiễm sắc thể", 60),
            (13, "Di truyền học người và di truyền y học", 68),
            (14, "Thực hành: Quan sát một số dạng đột biến nhiễm sắc thể", 75),
        ]),
        ("Chương 3 MỞ RỘNG HỌC THUYẾT DI TRUYỀN NHIỄM SẮC THỂ", "Chương 3. Mở rộng học thuyết di truyền nhiễm sắc thể", "Phần bốn. Di truyền học", [
            (15, "Di truyền gene ngoài nhân", 78),
            (16, "Tương tác giữa kiểu gene với môi trường và thành tựu chọn giống", 83),
            (17, "Thực hành: Thí nghiệm về thường biến ở cây trồng", 88),
        ]),
        ("Chương 4 DI TRUYỀN QUẦN THỂ", "Chương 4. Di truyền quần thể", "Phần bốn. Di truyền học", [
            (18, "Di truyền học quần thể", 91),
        ]),
        ("Chương 5 BẰNG CHỨNG VÀ CÁC HỌC THUYẾT TIẾN HOÁ", "Chương 5. Bằng chứng và các học thuyết tiến hoá", "Phần năm. Tiến hoá", [
            (19, "Các bằng chứng tiến hoá", 97),
            (20, "Quan niệm của Darwin về chọn lọc tự nhiên và hình thành loài", 101),
            (21, "Học thuyết tiến hoá tổng hợp hiện đại", 106),
            (22, "Tiến hoá lớn và quá trình phát sinh chủng loại", 113),
        ]),
        ("Chương 6 MÔI TRƯỜNG VÀ SINH THÁI HỌC QUẦN THỂ", "Chương 6. Môi trường và sinh thái học quần thể", "Phần sáu. Sinh thái học và môi trường", [
            (23, "Môi trường và các nhân tố sinh thái", 122),
            (24, "Sinh thái học quần thể", 128),
            (25, "Thực hành: Xác định một số đặc trưng của quần thể", 138),
        ]),
        ("Chương 7 SINH THÁI HỌC QUẦN XÃ", "Chương 7. Sinh thái học quần xã", "Phần sáu. Sinh thái học và môi trường", [
            (26, "Quần xã sinh vật", 141),
            (27, "Thực hành: Tìm hiểu cấu trúc dinh dưỡng của quần xã trong tự nhiên", 150),
            (28, "Hệ sinh thái", 152),
            (29, "Trao đổi vật chất và chuyển hoá năng lượng trong hệ sinh thái", 155),
            (30, "Diễn thế sinh thái", 161),
            (31, "Sinh quyển, khu sinh học và chu trình sinh - địa - hoá", 165),
            (32, "Thực hành: Thiết kế một hệ sinh thái nhân tạo", 172),
        ]),
        ("Chương 8 SINH THÁI HỌC PHỤC HỒI, BẢO TỒN VÀ PHÁT TRIỂN BỀN VỮNG", "Chương 8. Sinh thái học phục hồi, bảo tồn và phát triển bền vững", "Phần sáu. Sinh thái học và môi trường", [
            (33, "Sinh thái học phục hồi và bảo tồn đa dạng sinh vật", 175),
            (34, "Phát triển bền vững", 180),
            (35, "Dự án: Tìm hiểu thực trạng bảo tồn hệ sinh thái tại địa phương và đề xuất giải pháp bảo tồn", 188),
        ]),
    ],
}

# Lessons that are not "theory" (plan #37 §4.3): subject openings, practicals, reviews, exercise
# lessons ("Bài tập…", "Một số ví dụ về cách giải…"), projects, careers. Prefixes decide; the
# openings and the careers lesson are listed by number (their titles carry no prefix).
KIND_PREFIXES = [
    ("Thực hành", "practice"),
    ("Ôn tập", "review"),
    ("Bài tập", "exercise"),
    ("Một số ví dụ về cách giải", "exercise"),
    ("Dự án", "project"),
]
KIND_BY_NUMBER = {
    # Chương I "Mở đầu": getting to know physics, lab safety (Bài 3 is a practical).
    ("VL10", 1): "intro",
    ("VL10", 2): "intro",
    # Phần mở đầu: the subject and how to study it (Bài 3, levels of organisation, is theory).
    ("SH10", 1): "intro",
    ("SH10", 2): "intro",
    ("SH11", 29): "career",
}
# Counting choices a teacher may change (plan #37 §4.3).
COUNT_NOTES = [
    "VL10 Bài 1 (Làm quen với Vật lí) tính là mở đầu môn học; VL10 Bài 3 (Thực hành tính sai số…, không có dấu hai chấm) tính là thực hành.",
    "VL10 Bài 2 (quy tắc an toàn) tính là mở đầu môn học; VL10 Bài 20 (Một số ví dụ về cách giải…) tính là bài tập.",
    "SH10 Bài 1–2 tính là mở đầu môn học; SH10 Bài 3 tính là lí thuyết.",
    "SH11 Bài 29 (ngành nghề) không tính là lí thuyết.",
    "HH10 \"Mở đầu\" không đánh số: không tính vào tổng số bài.",
]

# Placed topics: (topic, book, lessons, reason). Only when the lesson titles clearly name it.
PLACEMENTS = [
    ("uniformMotion", "VL10", [4, 5, 7], "Tên Bài 4–5: độ dịch chuyển, quãng đường, tốc độ, vận tốc; Tên Bài 7: đồ thị độ dịch chuyển – thời gian (cảnh vẽ đồ thị tọa độ – thời gian)."),
    ("uniformAcceleration", "VL10", [8, 9], "Tên Bài 8–9: gia tốc và chuyển động thẳng biến đổi đều."),
    ("freeFall", "VL10", [10], "Tên Bài 10: sự rơi tự do."),
    ("horizontalProjectile", "VL10", [12], "Tên Bài 12: chuyển động ném."),
    ("obliqueProjectile", "VL10", [12], "Tên Bài 12: chuyển động ném."),
    ("newtonLaws", "VL10", [14, 15, 18], "Tên Bài 14–15: định luật 1, 2 Newton; Tên Bài 18: lực ma sát (cảnh có hệ số ma sát). Cảnh chỉ có một vật nên không xếp Bài 16 (định luật 3)."),
    ("energyConservation", "VL10", [25, 26], "Tên Bài 25–26: động năng, thế năng, cơ năng và định luật bảo toàn cơ năng."),
    ("collisions", "VL10", [28, 29], "Tên Bài 28–29: động lượng và định luật bảo toàn động lượng."),
    ("springPendulum", "VL11", [1, 2, 3, 5, 6], "Tên Bài 1–3, 5: dao động điều hoà, vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng)."),
    ("simplePendulum", "VL11", [1, 2, 3, 5, 6], "Tên Bài 1–3, 5: dao động điều hoà (con lắc đơn dao động điều hoà khi góc nhỏ), vận tốc, gia tốc, năng lượng; Bài 6: chỉ phần dao động tắt dần (cảnh có lực cản, không có dao động cưỡng bức, cộng hưởng)."),
    ("periodicTable", "HH10", [5, 6, 8], "Tên Bài 5, 6, 8: cấu tạo bảng tuần hoàn, xu hướng biến đổi tính chất, định luật tuần hoàn."),
    ("electronConfiguration", "HH10", [3], "Tên Bài 3: cấu trúc lớp vỏ electron nguyên tử."),
    ("orbitals", "HH10", [3], "Tên Bài 3: cấu trúc lớp vỏ electron nguyên tử."),
    ("collisionTheory", "HH10", [19], "Tên Bài 19: tốc độ phản ứng."),
    ("chemicalEquilibrium", "HH11", [1], "Tên Bài 1: khái niệm về cân bằng hoá học."),
    ("diffusionOsmosis", "SH10", [10], "Tên Bài 10: trao đổi chất qua màng tế bào. Chỉ phần vận chuyển thụ động (khuếch tán, thẩm thấu), trên mô hình hai ngăn và ống chữ U, không phải màng tế bào thật."),
    ("mitosis", "SH10", [16], "Tên Bài 16: chu kì tế bào và nguyên phân."),
    ("meiosis", "SH10", [17], "Tên Bài 17: giảm phân."),
    ("centralDogma", "SH12", [2], "Tên Bài 2: quá trình truyền đạt thông tin di truyền (Bài 1 về DNA và tái bản: giáo viên quyết định)."),
    ("pointMutation", "SH12", [4], "Tên Bài 4: đột biến gene."),
    ("mendel", "SH12", [8, 9], "Tên Bài 8–9: học thuyết di truyền Mendel và mở rộng học thuyết Mendel (cảnh chỉ mở rộng tới trội không hoàn toàn)."),
    ("hardyWeinberg", "SH12", [18], "Tên Bài 18: di truyền học quần thể."),
    ("logisticGrowth", "SH12", [24], "Tên Bài 24: sinh thái học quần thể."),
    ("cellStructure", "SH10", [7, 8], "Tên Bài 7–8: tế bào nhân sơ và tế bào nhân thực."),
    ("uniformCircularMotion", "VL10", [31, 32], "Tên Bài 31–32: động học của chuyển động tròn đều; lực hướng tâm và gia tốc hướng tâm."),
    ("electricField", "VL11", [16, 17, 18], "Tên Bài 16–18: lực tương tác giữa các điện tích, khái niệm điện trường, điện trường đều."),
]

# Not placed (title not clear, or no lesson): (topic, subject, candidates, reason).
UNPLACED = [
    ("inclinedPlane", "physics", "VL10 Bài 13, 15, 18", "Không bài nào có tên về mặt phẳng nghiêng; cảnh dùng cùng mô hình với \"Các định luật Newton\" (định luật 2 Newton, lực ma sát)."),
    ("pulley", "physics", "VL10 Bài 17", "Không bài nào có tên về ròng rọc; tên Bài 17 có nêu lực căng (cảnh tính lực căng dây) nhưng không nêu hệ ròng rọc."),
    ("hookeSpring", "physics", "VL10 Bài 33", "Tên Bài 33 là biến dạng của vật rắn (cảnh vẽ lực đàn hồi theo độ biến dạng), không nêu định luật Hooke."),
    ("bohrModel", "chemistry", "HH10 Bài 1 hoặc 3", "Không bài nào có tên về mô hình Bohr; chưa rõ thuộc Bài 1 hay Bài 3."),
    ("molecule3d", "chemistry", "—", "Không bài nào trong ba cuốn Hoá học có tên về hình học phân tử 3D."),
    ("vsepr", "chemistry", "—", "Không bài nào trong ba cuốn Hoá học có tên về mô hình VSEPR."),
    ("bondPolarity", "chemistry", "HH10 Bài 11, 12", "Tên Bài 11–12 là liên kết ion và liên kết cộng hoá trị, không nêu độ phân cực."),
    ("reactionLibrary", "chemistry", "—", "Thư viện nhiều phản ứng, không ứng với một bài."),
    ("equationBalancing", "chemistry", "HH10 Bài 15", "Không bài nào có tên về cân bằng phương trình; Bài 15 (phản ứng oxi hoá – khử) chỉ liên quan một phần."),
    ("maxwellBoltzmann", "chemistry", "VL12 Bài 8, 12 (sách Vật lí; trong app chủ đề thuộc Hoá học)", "Không bài nào trong ba cuốn Hoá học có tên về phân bố Maxwell–Boltzmann; hai bài Vật lí 12 nói về mô hình động học phân tử chất khí."),
    ("michaelisMenten", "biology", "SH10 Bài 13–15", "Không bài nào có tên về động học enzyme."),
    ("lotkaVolterra", "biology", "SH12 Bài 26", "Tên Bài 26 là quần xã sinh vật, không nêu quan hệ con mồi – vật ăn thịt."),
    ("geneticDrift", "biology", "SH12 Bài 18, 21", "Tên Bài 18, 21 là di truyền học quần thể và học thuyết tiến hoá tổng hợp hiện đại, không nêu phiêu bạt di truyền."),
]

# Lessons of 0.8.0 Part A (plan #37 §4.2): listed in the document before their topics exist.
PART_A = {
    ("VL10", 31): "(a) Chuyển động tròn đều", ("VL10", 32): "(a) Chuyển động tròn đều",
    ("VL11", 13): "(b) Sóng dừng trên dây",
    ("VL11", 16): "(d) Điện trường", ("VL11", 17): "(d) Điện trường", ("VL11", 18): "(d) Điện trường",
    ("VL11", 23): "(e) Mạch điện một chiều, chuyển sang 0.8.1", ("VL11", 24): "(e) Mạch điện một chiều, chuyển sang 0.8.1",
    ("VL11", 25): "(e) Mạch điện một chiều, chuyển sang 0.8.1",
    ("SH10", 7): "Sinh (a) Tế bào nhân sơ và nhân thực", ("SH10", 8): "Sinh (a) Tế bào nhân sơ và nhân thực",
}
SUBJECT_VI = {"physics": "Vật lí", "chemistry": "Hoá học", "biology": "Sinh học"}
KIND_VI = {"theory": "Lí thuyết", "intro": "Mở đầu môn học", "practice": "Thực hành", "review": "Ôn tập", "exercise": "Bài tập", "project": "Dự án", "career": "Ngành nghề"}


def kind_of(book: str, number, title: str) -> str:
    if number is None:
        return "intro"
    if (book, number) in KIND_BY_NUMBER:
        return KIND_BY_NUMBER[(book, number)]
    for prefix, kind in KIND_PREFIXES:
        if title.startswith(prefix):
            return kind
    return "theory"


def topic_titles() -> dict:
    """Vietnamese topic names from the app's own i18n file (the source of truth)."""
    text = VI.read_text(encoding="utf-8")
    block = re.search(r"\n  topics: \{\n(.*?)\n  \},", text, re.S)
    assert block, "topics group not found in vi.ts"
    return dict(re.findall(r"^\s+(\w+): '([^']*)',", block.group(1), re.M))


def build():
    books = []
    for book_id, subject, grade, title, slug, pages in BOOKS:
        chapters = []
        for printed, label, part, lessons in TOC[book_id]:
            chapter = {"label": label, "printed": printed}
            if part:
                chapter["part"] = part
            chapter["lessons"] = [
                {"number": n, "title": t, "page": p, "kind": kind_of(book_id, n, t)} for n, t, p in lessons
            ]
            chapters.append(chapter)
        numbered = [l for c in chapters for l in c["lessons"] if l["number"] is not None]
        assert [l["number"] for l in numbered] == list(range(1, len(numbered) + 1)), book_id
        books.append({
            "id": book_id, "subject": subject, "grade": grade, "title": title, "url": READER + slug,
            "tocPages": pages, "chapters": chapters,
            "counts": {"total": len(numbered), "theory": sum(l["kind"] == "theory" for l in numbered)},
        })
    by_id = {b["id"]: b for b in books}
    items = []
    for topic, book_id, lessons, reason in PLACEMENTS:
        # gradeView orders topics by their first lesson.
        assert lessons == sorted(set(lessons)), (topic, lessons)
        book = by_id[book_id]
        chapters = {c["label"] for c in book["chapters"] for l in c["lessons"] if l["number"] in lessons}
        found = {l["number"] for c in book["chapters"] for l in c["lessons"]}
        assert set(lessons) <= found and len(chapters) == 1, (topic, chapters)
        items.append({
            "topic": topic, "subject": book["subject"], "grade": book["grade"], "book": book_id,
            "chapter": chapters.pop(), "lessons": lessons, "reason": reason, "review_status": "pending",
        })
    placed = {p["topic"] for p in items}
    unplaced = []
    for topic, subject, candidates, reason in UNPLACED:
        assert topic not in placed, topic
        unplaced.append({"topic": topic, "subject": subject, "reason": f"{reason} Bài có thể liên quan: {candidates}.",
                         "review_status": "pending"})
    return {
        "dataset": "curriculum_kntt",
        "version": 1,
        "review_status": "pending",
        "accessed": ACCESSED,
        "source": {
            "id": "nxbgd-kntt-toc",
            "citation": "SGK Vật lí, Hoá học, Sinh học 10–12 \"Kết nối tri thức với cuộc sống\" (NXB Giáo dục Việt Nam), mục lục bản đọc trên trang tập huấn NXBGD (ảnh trang tải lên tháng 4/2026)",
            "url": "https://taphuan.nxbgd.vn/",
        },
        "generated_by": "scripts/data/gen_curriculum_kntt.py",
        "books": books,
        "items": items,
        "unplaced": unplaced,
    }


def markdown(data: dict) -> str:
    names = topic_titles()
    books = data["books"]
    by_lesson, reasons = {}, {}
    for p in data["items"]:
        for n in p["lessons"]:
            by_lesson.setdefault((p["book"], n), []).append(names.get(p["topic"], p["topic"]))
            reasons.setdefault((p["book"], n), []).append((names.get(p["topic"], p["topic"]), p["reason"]))
    out = [
        "# Đối chiếu SimLab với SGK \"Kết nối tri thức với cuộc sống\"",
        "",
        "> **Tệp sinh tự động** bởi `scripts/data/gen_curriculum_kntt.py` (cùng nguồn với",
        "> `data/curriculum_kntt.json`, dữ liệu cho thanh chia lớp của thư viện, việc (g2) của #37). Không sửa tay: sửa script rồi chạy",
        "> `python scripts/data/gen_curriculum_kntt.py`. **Mọi dòng đang chờ giáo viên duyệt** (`review_status: \"pending\"`,",
        "> DATA_REVIEW mục 12 và các dòng `KNTT-*`).",
        "",
        "## Nguồn và cách đọc",
        "",
        "- **Sách:** Vật lí, Hoá học, Sinh học lớp 10, 11, 12 bộ \"Kết nối tri thức với cuộc sống\", NXB Giáo dục Việt Nam.",
        f"- **Nguồn chính thức:** mục lục (trang in số 4, có cuốn sang trang 5) trong sách đọc trực tuyến trên trang tập huấn của NXB Giáo dục, ảnh trang tải lên tháng 4/2026. **Ngày truy cập: {data['accessed']}.**",
        "- **Cách đọc:** `hanhtrangso.nxbgd.vn` là ứng dụng JavaScript nên không đọc được; trang `taphuan.nxbgd.vn` đọc được bằng `curl` thường (có kiểm chứng chỉ, không dùng `-k`): lấy địa chỉ ảnh trang trong trang đọc sách rồi xem ảnh.",
        "- **Chép gì:** chỉ tên chương và tên bài, nguyên văn bản in (mục lục in tên chương bằng chữ hoa; bảng dưới viết lại chữ thường, cùng từ). Không chép nội dung sách. Các trang phụ (vietjack, loigiaihay…) lệch bản in ở vài tên bài nên không dùng.",
        "- **Cần giáo viên xác nhận:** SimLab đối chiếu theo bản in nào (năm, lần tái bản); mỗi chủ đề có thật sự ứng với bài đã ghi không (chủ đề có thể chỉ ứng với một phần của bài).",
        "",
        "| Sách | Địa chỉ đọc |",
        "| --- | --- |",
    ]
    out += [f"| {b['title']} | {b['url']} |" for b in books]
    out += [
        "",
        "## Số bài",
        "",
        "Bài **lí thuyết** = mọi bài trừ mở đầu môn học, thực hành, ôn tập, bài tập (kể cả \"Một số ví dụ về cách giải…\"), dự án, ngành nghề.",
        "",
        "| Sách | Số bài | Lí thuyết | Lí thuyết có chủ đề SimLab |",
        "| --- | --- | --- | --- |",
    ]
    total = theory = covered = 0
    for b in books:
        t = sum(1 for c in b["chapters"] for l in c["lessons"] if l["number"] is not None and l["kind"] == "theory" and (b["id"], l["number"]) in by_lesson)
        out.append(f"| {b['title']} | {b['counts']['total']} | {b['counts']['theory']} | {t} |")
        total += b["counts"]["total"]
        theory += b["counts"]["theory"]
        covered += t
    out += [f"| **Cộng** | **{total}** | **{theory}** | **{covered}** |", "", "Các chỗ đếm có thể khác (giáo viên chọn):", ""]
    out += [f"- {n}" for n in COUNT_NOTES]
    out += [
        "",
        "## Bài SGK ↔ chủ đề SimLab",
        "",
        "Gồm các bài đã có chủ đề SimLab (đề xuất) và các bài của kế hoạch 0.8.0 Phần A (#37). Các bài khác sẽ thêm ở 0.8.1 (#54).",
        "",
        "| Sách | Chương | Bài | Tên bài | Trang | Loại | Chủ đề SimLab | Ghi chú | review_status |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for b in books:
        for c in b["chapters"]:
            for l in c["lessons"]:
                key = (b["id"], l["number"])
                if key not in by_lesson and key not in PART_A:
                    continue
                status = ", ".join(by_lesson.get(key, [])) or f"chưa có — kế hoạch {PART_A[key]}"
                pairs = reasons.get(key, [])
                if len({r for _, r in pairs}) > 1:
                    note = " ".join(f"{name}: {r}" for name, r in pairs)
                else:
                    note = pairs[0][1] if pairs else "Bài của 0.8.0 Phần A (#37 mục 4.2)."
                out.append(f"| {b['title']} | {c['label']} | {l['number']} | {l['title']} | {l['page']} | {KIND_VI[l['kind']]} | {status} | {note} | pending |")
    out += [
        "",
        "## Chủ đề chưa xếp lớp",
        "",
        "Tên bài SGK chưa nói rõ chủ đề, hoặc không có bài nào: để \"Chưa xếp lớp\" cho tới khi giáo viên chọn (khi thư viện có thanh chia lớp, các chủ đề này chỉ hiện ở \"Tất cả\").",
        "",
        "| Môn | Chủ đề SimLab | Lí do | review_status |",
        "| --- | --- | --- | --- |",
    ]
    out += [f"| {SUBJECT_VI[u['subject']]} | {names.get(u['topic'], u['topic'])} | {u['reason']} | pending |" for u in data["unplaced"]]
    return "\n".join(out) + "\n"


def main() -> None:
    data = build()
    OUT_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    OUT_MD.write_text(markdown(data), encoding="utf-8", newline="\n")
    counts = ", ".join(f"{b['id']} {b['counts']['total']}/{b['counts']['theory']}" for b in data["books"])
    print(f"wrote {len(data['items'])} placements, {len(data['unplaced'])} unplaced; books (total/theory): {counts}")


if __name__ == "__main__":
    main()
