# Giảng trên bảng của AI Teacher: nghiên cứu, thiết kế, hiện trạng

Ngày: 12/10/2026. Mã nguồn: `src/teacher/board/`. Đặc tả nền: `PROMPT_PHAN_2.md` mục B3, B7, B8 và
`docs/TEACHSCRIPT.md`. Tài liệu này gom phần nghiên cứu (để đưa vào báo cáo) và mô tả những gì app
thật sự làm.

## 1. Giáo viên thật dùng bảng như thế nào

Tổng hợp từ tài liệu sư phạm và hướng dẫn thực hành (nguồn ở mục 6; phần lớn là tài liệu hướng dẫn,
không phải nghiên cứu thực nghiệm, nên chỉ coi là kinh nghiệm thực hành tốt):

| Nguyên tắc                            | Ý nghĩa                                                                                           | App làm thế nào                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chia bảng trước khi giảng**         | Bảng có vùng nội dung chính và vùng phụ (nháp, ví dụ, ghi chú); học sinh biết nhìn đâu, chép đâu. | Bố cục cố định 3 cột dưới dải tiêu đề: trái = tóm tắt đề/ghi chú, giữa = các bước giải, phải = hình, bảng số, nháp. Có đường kẻ chia cột nhạt.       |
| **Viết ý chính, ngắn gọn**            | Bảng quá trống thì khó theo, quá dày thì rối.                                                     | Câu dài chỉ được _nói_; trên bảng chỉ có tiêu đề, dữ kiện, công thức, bước, kết quả. Một dòng viết tối đa ~150 ký tự.                                |
| **Trái → phải, trên → dưới**          | Thứ tự đọc rõ ràng.                                                                               | Mỗi cột điền từ trên xuống; không bao giờ chồng chữ (có test sinh ngẫu nhiên 400 thao tác).                                                          |
| **Màu có nghĩa cố định**              | 3–4 màu, mỗi màu một vai trò, học sinh quen dần.                                                  | Đỏ = tiêu đề, khoanh, đóng khung; xanh dương = đề mục, từ khóa, gạch chân, đồ thị; xanh lá = ghi chú; mực = nội dung. Học sinh có bút màu tím riêng. |
| **Tín hiệu hướng chú ý** (signaling)  | Gạch chân, khoanh, mũi tên, bàn tay đang viết dẫn mắt người học.                                  | Gạch chân đúng cụm chữ, khoanh tròn hơi hở như vẽ tay, đóng khung kết quả, mũi tên cong có nhãn, đầu bút hiện ở chỗ đang viết.                       |
| **Chia nhỏ** (segmenting)             | Học từng phần nhỏ, có nhịp nghỉ.                                                                  | Giảng từng câu: thầy nói câu nào thì viết phần của câu đó; câu sau chờ cả lời và bút xong; có nút Tạm dừng, tốc độ viết 0,75×–2×.                    |
| **Giải từng bước, hỏi lại**           | Không đưa đáp án ngay, mời học sinh nghĩ.                                                         | Lời nhắc chế độ bảng yêu cầu: tiêu đề → Cho/Tìm → các bước đánh số → kết quả → một câu hỏi gợi mở.                                                   |
| **Giữ những gì quan trọng, xóa nháp** | Công thức chính ở lại trên bảng.                                                                  | Thầy có `<erase>`, `<correct>` (gạch và viết lại bên cạnh), `<newboard>` sang mặt bảng mới; các mặt cũ vẫn xem lại được.                             |

## 2. Sản phẩm và nghiên cứu tương tự (tra 12/10/2026)

- **Dudely** (khởi nghiệp): gia sư STEM vẽ lời giải từng bước lên bảng và đọc to; kiểm tra hiểu bài
  trước khi đi tiếp.
- **Scribe AI** (dự án hackathon): AI viết "kịch bản hình ảnh" từng bước, bộ vẽ hoạt ảnh từng ký hiệu
  trong khi giọng đọc giải thích, dùng Gemini API. Gần ý tưởng của SimLab nhất.
- **Gauth AI Course** (2/10/2026): bảng chung để học sinh và gia sư AI cùng làm bài.
- **Thinkverse, DeskProf, Solversboard**: bảng cạnh khung chat; AI khoanh chỗ sai trên bài của học sinh.
- Nghiên cứu: **DrawDash** (arXiv, 12/2025) biến lời nói thành cập nhật sơ đồ dần dần; **AmIWrite**
  (CHI 2026) gia sư toán dựa trên chữ viết tay.

**Điểm khác của SimLab:** (1) AI không bao giờ chọn tọa độ: bố cục do code tất định; (2) mọi con số
viết lên bảng được kiểm nguồn gốc (có trong đề / phép tính máy kiểm lại / chưa kiểm chứng); (3) đồ thị
do code tính từ biểu thức, không vẽ theo số AI gõ; (4) chạy được cả với Gemma trên máy (câu trả lời
thường được tự xếp lên bảng); (5) tiếng Việt có dấu viết tay và giọng đọc tiếng Việt.

## 3. Yêu cầu từ tài liệu nhóm

Từ "Stem Sim Lab app" (P8.3 – T2 Bảng trắng; phần B7 của PROMPT_PHAN_2) và khung báo cáo:

- Chữ viết tay tiếng Việt có dấu, hiệu ứng viết từng chữ, gạch chân, khoanh tròn, mũi tên, sơ đồ, xóa
  và sửa, bố cục tự động không chồng lấn, lịch sử bảng; thử với nội dung dài.
- Báo cáo (2.3.1.4) nhấn mạnh: AI Teacher hỗ trợ có mục đích sư phạm, phân biệt số liệu thật từ mô
  phỏng với suy luận của AI, liên kết hiện tượng – công thức – bảng số – đồ thị.

## 4. Thiết kế đã làm

```
Câu trả lời AI ──► TeachScript? ──có──► parseTeachScript (chịu lỗi)
                    │                        │
                    └──không──► markdownToScript (tự xếp câu trả lời thường)
                                             ▼
                       câu 1, câu 2, … (lời nói + hành động bảng)
                                             ▼
          lesson.ts: nói câu (giọng tiếng Việt) ∥ bút viết / đánh dấu / vẽ
                                             ▼
          layout.ts (3 cột, không chồng)   provenance.ts (nguồn gốc số)
                                             ▼
          Whiteboard.tsx: chữ viết tay, đầu bút, nét vẽ tay (rough.ts), hình (BoardDrawing.tsx)
```

- **Chữ viết tay:** phông Patrick Hand (nội dung) và Pangolin (tiêu đề), giấy phép OFL, có bộ chữ
  tiếng Việt, đóng gói sẵn trong app (không tải từ mạng). Mỗi chữ cái lệch nhẹ (xoay ±2°, lệch dòng,
  co giãn ±3%) theo seed cố định; dòng dài hơi trôi xuống như viết tay.
- **Hoạt ảnh viết:** hiện từng ký tự theo nhịp không đều (dừng ngắn giữa các từ), đầu bút đi theo; công
  thức KaTeX hiện dần từ trái sang phải. "Viết nhanh" viết ngay phần còn lại.
- **Đánh dấu:** gạch chân (đúng cụm chữ nếu có `span`), khoanh (elip hơi hở, có chỗ vẽ trùm), khung
  (bốn nét lố góc), bút dạ quang, gạch bỏ khi sửa, mũi tên cong có nhãn. Mỗi nét tự vẽ ra (600 ms).
- **Hình:** đồ thị hàm số (code tự lấy mẫu biểu thức, bộ đọc biểu thức an toàn không dùng `eval`), trục
  tọa độ, sơ đồ lực (hướng theo tên lực: P xuống, N lên, F sang phải, Fms sang trái), véc-tơ, sơ đồ quá
  trình, bảng số.
- **Nguồn gốc con số:** số có trong câu hỏi (hoặc g = 9,8/9,81/10, số nguyên nhỏ) là "cho sẵn"; phép
  tính viết trên bảng ("a = 10/2 = 5") được máy tính lại, đúng thì đánh dấu ✓ "Phép tính đã được máy
  kiểm lại"; số không rõ nguồn được gắn ⚠ "Có số do AI tự tính, chưa kiểm chứng".
- **Đồng bộ lời – bút:** câu nào nói thì phần bảng của câu đó được viết cùng lúc; câu sau chờ cả hai
  xong (giọng không chạy trước bút). Không bật giọng thì có thời gian đọc phụ đề.
- **Camera và mặt bảng:** bảng dài xuống dưới, khung nhìn tự lia theo bút; `<newboard>` mở mặt mới, có
  thẻ "Bảng 1, Bảng 2…" để xem lại.
- **Bút của học sinh:** bật "Bút của em" để viết/vẽ bằng chuột hoặc cảm ứng (màu tím), xóa nét của
  mình. Nét chỉ ở trên máy, không gửi đi.
- **Chế độ bảng với AI cloud:** lời nhắc TeachScript (`BOARD_SYSTEM` trong
  `src/teacher/chat/chatService.ts`): ví dụ mẫu, cấm tọa độ, yêu cầu viết rõ phép tính. Think giữ nguyên
  định dạng thẻ khi rà soát. Gemma (mô hình nhỏ) trả lời bình thường, bảng tự xếp.

## 5. Chưa làm (để lại cho các bước sau)

- "Thầy xem giúp" (gửi ảnh phần bảng học sinh vẽ cho AI nhận xét) và xuất bảng thành ảnh PNG/PDF.
- Viết tay mức 2 (vẽ theo khung xương nét, dấu thanh viết sau chữ cái gốc).
- Khẩu hình theo âm, nhận dạng giọng nói, nút "Giơ tay", ngắt lời (T3, T5).
- Tạm dừng giữa câu sẽ cắt giọng của câu đó; khi tiếp tục, bút viết tiếp nhưng câu đó không đọc lại.
- Chưa có công cụ tính toán tất định cho AI gọi (T4): hiện chỉ kiểm lại phép tính AI viết ra.

## 6. Nguồn

- Kỹ năng trình bày bảng: luatduonggia.vn (Kỹ năng trình bày bảng lớp của giáo viên Tiểu học),
  luatminhkhue.vn (mẹo cho giáo viên khi đứng lớp), vjol.vista.gov.vn (Rèn luyện kỹ năng trình bày bảng
  cho sinh viên ngành Giáo dục tiểu học), nvsp.hnue.edu.vn.
- Bảng trắng và học đa phương tiện: uis.edu (lightboard videos: segmenting, pre-training),
  Computers and Education Open 2021 (signaling và concept map, doaj.org), theteflacademy.com
  (whiteboard technique: chia vùng, màu cố định).
- Sản phẩm: f4.fund/startups/dudely, devpost.com/software/scribe-ai-4569xd, taiwannews.com.tw (Gauth),
  thinkverse.co, arxiv.org/abs/2512.01234 (DrawDash).
