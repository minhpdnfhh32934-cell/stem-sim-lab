# teacher-sweep — rà lỗi AI Teacher và nâng cấp nhỏ

- **Goal:** người dùng yêu cầu ngày 19/11/2026: "kiểm tra lại toàn bộ AI Teacher xem có lỗi bug nào
  không, xong thì xem thử có thể nâng cấp được gì thì nâng cấp".
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/teacher-sweep`, tách từ `main` (sau #333).

## Cách rà

- Chạy app bằng `vite` trong trình duyệt ở 1366×768, Gemini giả lập ngay trong trang (cùng định
  dạng với `tests/e2e/fakeAi.ts`, không gọi API thật). Đã thử: hỏi đáp có công thức, câu trả lời
  hiện dần, nút Dừng giữa chừng, Bảng giảng, lỗi 429 và 500, Deepthink thiếu khóa thứ hai, nút xóa
  cuộc trò chuyện.
- Đọc mã các phần đó (`chatService.ts`, `ChatPanel.tsx`, `ChatComposer.tsx`, `MessageBody.tsx`,
  `knowledge.ts`).
- Mục AT-01 của #128 (`chatVision` bỏ qua `inputBudget`) đã được sửa từ trước
  (`visionPromptWithin`).

## Lỗi tìm thấy và đã sửa

1. Câu trả lời có các bước "1. 2. 3." hiện thành dấu chấm tròn trong khung chat (bảng trắng thì
   đúng), nên mất số bước. Nay là danh sách đánh số; bước sau một công thức vẫn giữ số (ví dụ 3).
2. Nút Deepthink luôn có dấu ✓, kể cả khi tắt. Nay chỉ có ✓ khi bật.
3. Ba lỗi khi bật Deepthink (thiếu khóa thứ hai, cùng nhà cung cấp, AI trực tuyến tắt) không có nút
   "Cài đặt" như các lỗi khác. Nay mở đúng trang (AI Teacher hoặc Kết nối AI).
4. Câu trả lời ngắn "Tăng 4 lần" sau câu hỏi rơi tự do kéo thêm ghi chú "Giao thoa sóng" vào lời
   nhắc và mục "Nguồn kiến thức", qua hai chữ "tăng" và "lần". Bốn chữ chỉ lượng "lần, gấp, tăng,
   giảm" nay không tự chọn ghi chú; "giảm phân", "tăng trưởng" vẫn tìm đúng. Bộ câu hỏi giữ lại để
   kiểm thư viện (`tests/teaching/retrieval-heldout.json`) vẫn đạt. Chưa chạy lại bộ đo chất lượng
   Gemma trên GPU (lời nhắc không đổi chữ nào, chỉ có thể bớt một ghi chú lạc đề).

## Nâng cấp

5. Xóa cuộc trò chuyện xong có thông báo kèm nút **Hoàn tác** (8 giây); chỉ khôi phục khi chưa có
   câu hỏi mới. Thông báo (toast) của app có thêm nút tùy chọn.
6. Câu trả lời đang hiện dần được trình bày ngay (đề mục, danh sách, chữ đậm, công thức đã đóng),
   thay vì chữ thô "## …", "$\frac{1}{2}…$" tới cuối.

## Không làm (ghi lại)

- Bản trình duyệt (không phải app desktop) không thử lại khi Gemini lỗi 500: đúng thiết kế, bản
  desktop thử lại trong Rust (`stream.rs`).
- Cảnh báo `willReadFrequently` của Canvas2D trong console: chỉ là gợi ý hiệu năng, chưa xử lý.

## Commands run (real results, summary lines only)

- `npx vitest run`: 5 808 đạt, 3 bỏ qua có sẵn.
- `npx tsc -b --noEmit`: đạt. `npm run lint`: đạt (lỗi duy nhất là tệp cấu hình cục bộ
  `vite.local.config.ts` không commit).
- `npx playwright test` teacher, board, board-picture, post198-teacher, local-ai, qwen-builtin,
  ai-flow (chromium): 73 đạt.
- Thử trong trình duyệt (bản nhánh, cổng 1448): danh sách 1-2-3, công thức khi đang viết, ✓ của
  Deepthink, Hoàn tác đưa lại cả câu hỏi, câu trả lời và nút "Xem mô phỏng"; console không lỗi.
