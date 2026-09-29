# Hướng dẫn sử dụng STEM Sim Lab

_Bản nháp. Tài liệu sẽ được hoàn thiện ở Giai đoạn 7._

## Bố cục màn hình

- **Thanh trên:** chọn môn, ô nhập đề bài, trạng thái AI, các nút ẩn/hiện bảng, sáng/tối, trình
  chiếu, cài đặt.
- **Cột trái:** Thư viện chủ đề và Lịch sử.
- **Giữa:** khung mô phỏng và thanh công cụ nổi. Bên dưới là thanh thời gian (chạy, dừng, tua,
  tốc độ).
- **Dưới:** Đồ thị, Lời giải, Số liệu.
- **Cột phải:** Thuộc tính của vật đang chọn, thông số và Thẻ Khoa học.

Các cột và bảng đều kéo giãn được bằng cách kéo đường viền. Nhấp đúp vào đường viền để trả về kích
thước mặc định. App tự nhớ bố cục cho lần mở sau.

## Đọc đề bằng AI

1. Dán đề vào ô **Đề bài** ở thanh trên, bấm **Phân tích đề** (hoặc Ctrl+Enter).
2. App mở bảng **"Tôi hiểu đề như sau"**. Mỗi dòng có:
   - giá trị (sửa được), đơn vị;
   - nhãn nguồn: **đề bài** (có trích dẫn nguyên văn), **mặc định** (đề không cho, app tự điền),
     **đã chỉnh** (bạn sửa);
   - dòng tô vàng **Cần nhập**: đề thiếu dữ kiện bắt buộc. Hãy nhập, hoặc bấm "Giữ mặc định".
3. Kiểm tra thêm các mục: câu đề hỏi, giả thiết, phần chưa mô phỏng được, cảnh báo.
4. Bấm **Mô phỏng**. Ở tab **Lời giải**, các đáp số đề hỏi được đánh dấu "đề hỏi". Nút **AI diễn
   giải** nhờ AI giải thích bằng lời; nếu AI viết ra con số không do chương trình tính, đoạn đó bị
   ẩn.

Không có AI? Bấm nút **Tự dựng cảnh** (biểu tượng thước và bút chì) cạnh nút Phân tích đề để chọn
chủ đề và nhập thông số bằng tay.

### Cài AI

- **LM Studio (miễn phí, chạy trên máy, không cần mạng):** tải LM Studio, tải một mô hình (khuyên
  dùng Qwen2.5 7B Instruct hoặc lớn hơn), nạp mô hình, vào tab Developer và bật **Start Server**
  (cổng 1234). App tự nhận; nhãn "AI: LM Studio" chuyển màu xanh.
- **AI đám mây (OpenAI / Anthropic):** Cài đặt → AI đọc đề → chọn nhà cung cấp, nhập API key. Khóa
  được lưu trong kho khóa của Windows, không lưu trong tệp. Đề bài sẽ được gửi lên máy chủ của nhà
  cung cấp.

## Hóa học

- **Bảng tuần hoàn:** nhấp một ô để xem dữ liệu; tô màu theo nhóm, khối, độ âm điện, bán kính,
  năng lượng ion hóa. Bảng dưới vẽ xu hướng theo Z.
- **Cấu hình electron / Mô hình Bohr / Orbital:** chọn nguyên tố (hoặc n, l cho orbital hydro).
  Các ngoại lệ như Cr, Cu được ghi chú rõ.
- **Phân tử 3D, VSEPR, độ phân cực:** tìm theo tên (Việt/Anh), công thức hoặc SMILES. Kéo chuột
  để xoay, lăn để phóng to. Nhấp nguyên tử/liên kết để xem chi tiết; Shift+nhấp 2 hoặc 3 nguyên tử
  để đo khoảng cách hoặc góc.
- **Thư viện phản ứng:** chọn phản ứng ở cột phải. Phản ứng có cơ chế có thanh phát: tua từng bước,
  xoay 3D; liên kết đứt màu cam, liên kết tạo màu xanh lá.
- **Cân bằng phương trình:** gõ ví dụ `Fe + O2 -> Fe2O3`. Điện tích: `Fe^3+`, `SO4^2-`.
- **Mức hạt:** Maxwell–Boltzmann (khí 2D), thuyết va chạm, cân bằng hóa học (nhấn các nút thêm
  chất, đổi nhiệt độ, nén để thấy nguyên lí Le Chatelier).

## Sinh học

- **Nguyên phân / Giảm phân:** nhấn ▶ hoặc mũi tên để đi qua từng kì. Chọn bộ NST 2n; ở giảm phân
  bật/tắt trao đổi chéo và bấm "Sắp xếp ngẫu nhiên lại" để thấy phân li độc lập. Bảng dưới liệt kê
  số NST, cromatit, tâm động, ADN ở mọi kì.
- **ADN → mARN → Protein / Đột biến điểm:** dán trình tự ADN (có thể có khoảng trắng, 5′/3′), chọn
  mạch bổ sung hay mạch gốc. Ở Đột biến điểm, chọn dạng đột biến, vị trí và nuclêôtit mới — app so
  sánh protein trước/sau và gọi tên kiểu đột biến.
- **Di truyền Mendel:** chọn lai 1 hoặc 2 cặp tính trạng, kiểu gen P, trội hoàn toàn / không hoàn
  toàn. Bấm "Tạo ngẫu nhiên" để so sánh kết quả ngẫu nhiên với lí thuyết (kiểm định χ²).
- **Hardy–Weinberg:** nhập số cá thể AA, Aa, aa; app tính p, q và kiểm định χ².
- **Phiêu bạt di truyền:** đổi kích thước quần thể N để thấy quần thể nhỏ mất/cố định alen nhanh.
- **Tăng trưởng logistic, Con mồi – vật ăn thịt:** kéo thanh trượt các hệ số. Ở Lotka–Volterra,
  bấm vào mặt phẳng pha để chọn điểm bắt đầu.
- **Động học enzyme:** chọn kiểu chất ức chế; xem đồ thị v–[S], [S] theo thời gian và
  Lineweaver–Burk.
- **Khuếch tán & thẩm thấu:** chuyển giữa hai chế độ. Ống chữ U cho thấy mực nước dâng tới khi
  ρgΔh = iCRT.

## Phím tắt

| Phím                     | Tác dụng                                    |
| ------------------------ | ------------------------------------------- |
| Space                    | Chạy / tạm dừng                             |
| R                        | Đặt lại                                     |
| .                        | Bước tiếp theo                              |
| Ctrl+Z / Ctrl+Y          | Hoàn tác / Làm lại                          |
| Ctrl+B / Ctrl+I / Ctrl+J | Ẩn/hiện Thư viện / Thuộc tính / bảng Đồ thị |
| F5 / Esc                 | Vào / thoát chế độ trình chiếu              |
| Ctrl+= / Ctrl+-          | Tăng / giảm cỡ chữ                          |
| Ctrl+Enter               | Phân tích đề (khi đang ở ô đề bài)          |
