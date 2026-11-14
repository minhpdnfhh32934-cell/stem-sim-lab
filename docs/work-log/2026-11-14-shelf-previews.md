# shelf-previews — Ảnh bìa cho thẻ bài Hóa học, Sinh học và Fourier

- **Goal:** người dùng hỏi (14/11/2026) vì sao thẻ Hóa học và Sinh học không có ảnh bìa như Vật lý,
  rồi chọn cách "ảnh chụp từ app". Mọi thẻ không có khung mô phỏng Vật lý nay hiện ảnh sân khấu
  thật của bài.
- **Date/time:** 2026-11-14 07:04 +0700 (bắt đầu), kết thúc cùng buổi sáng.
- **Status:** PASS
- **Branch / base:** `feat/shelf-previews` từ `main` f781f3a8.

## Files

- `scripts/bench/shelf-previews.mjs`: chụp sân khấu của 28 bài ở giá trị mặc định, sáng và tối,
  cắt khung quanh phần có nội dung, mã hóa WebP bằng chính trình duyệt (không thêm thư viện).
- `public/shelf/<topic>.<light|dark>.webp`: 56 ảnh, tổng khoảng 480 KB.
- `src/app/bench/shelfPreviews.ts` (danh sách, đường dẫn, `hasTopicPicture`),
  `src/app/bench/TopicPicture.tsx` (khung Vật lý, ảnh, hoặc hình nét của môn khi ảnh lỗi).
- `src/app/bench/Library.tsx`, `bench.css`: thẻ bài và thẻ "Tiếp tục" dùng `TopicPicture`.
- Test: `src/app/bench/TopicPicture.test.tsx` (mới), `Library.test.tsx` (thẻ Hóa nay có ảnh).
- `docs/BENCH_DESIGN.md` §9.3.

## Key decisions

- Ảnh là đầu ra của chính app ở giá trị mặc định, không sửa tay; con số trên ảnh do mô hình tính.
- Bài Vật lý "Họa âm và chuỗi Fourier" (module, không có khung mô phỏng) cũng có ảnh, để mọi thẻ
  đều có ảnh bìa. Test bắt mọi bài không có khung mô phỏng phải có ảnh sáng và tối.
- Khung cắt theo vùng có nội dung (so với màu nền ở góc dưới phải), tỉ lệ 2,2; CSS `cover` lo phần
  còn lại cho thẻ 242×88 và ảnh "Tiếp tục" 160×96.

## Commands run (real results, summary lines only)

- `node scripts/bench/shelf-previews.mjs --url http://localhost:1450`: 56 ảnh, thoát 0.
- `npm run check`: Test Files 414 passed, 2 skipped; Tests 5170 passed, 3 skipped (bỏ qua có điều
  kiện có sẵn). `npm run format:check`: sạch.
- Xem trên kệ bài thật (dev server, 1366×768): 14/14 thẻ Hóa học tải được ảnh (giao diện tối);
  kệ Sinh học (giao diện sáng) hiện ảnh đúng bài.

## Errors and fixes

- Lần chụp đầu: tooltip "Scandium" dính vào bảng tuần hoàn (con trỏ còn trên sân khấu) → đưa con
  trỏ ra góc trước khi chụp.
- Thẻ chỉ hiện dải giữa ảnh nên bài có nội dung ở trên (Cân bằng phương trình) thành ô trống →
  cắt khung quanh vùng có nội dung.
- Test đọc tệp bằng `new URL(..., import.meta.url)` lỗi trong jsdom → dùng `import.meta.dirname`
  như các test khác.

## Evidence

- Ảnh chụp kệ bài: trong phiên làm việc (không đưa vào repo).

## Next steps and limits

- E2E chưa chạy trên máy; CI chạy đủ.
- Khi giao diện một bài đổi, chạy lại script. Ảnh Nguyên phân và Giảm phân gần giống nhau vì cả hai
  mở ở kì trung gian (màn hình mặc định thật).
- Người dùng nhận ảnh mới khi có bản web mới (ví dụ 0.8.2; ghi chú phát hành để bước phát hành).
