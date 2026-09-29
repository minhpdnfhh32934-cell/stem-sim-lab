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
