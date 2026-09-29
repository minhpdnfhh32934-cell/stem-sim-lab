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
