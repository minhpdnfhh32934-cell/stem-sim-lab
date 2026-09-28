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

_Chưa có._ Khi viết code mà gặp giá trị, phản ứng hay cơ chế không chắc chắn, Claude sẽ ghi vào đây
thay vì tự đoán.
