# Cửa AI Teacher theo một quy tắc tuổi ở mọi lối vào

- **Goal:** khi người học đã trả lời "chưa đủ 18 tuổi", trang đầu khoá cửa AI Teacher, nhưng Ctrl+K
  vẫn mở được trang (phát hiện khi cài thử bản a85ff62). Sửa cho mọi lối vào theo đúng điều kiện
  trang đầu dùng; không viết điều kiện khác.
- **Date/time:** 2026-11-13 (máy bàn)
- **Status:** PASS
- **Branch / base:** `fix/teacher-gate-palette`, từ `main` a85ff62, PR vào `main`.

## Các lối vào đã soát

| Lối vào                                            | Trước                     | Sau                                                                |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Thẻ AI Teacher ở trang đầu (`Landing.tsx`)         | khoá khi `status.minor`   | dùng `teacherLocked` (cùng điều kiện)                              |
| Tab "Hỏi AI" của sổ (`Notebook.tsx`)               | khoá khi `status.minor`   | dùng `teacherLocked` (cùng điều kiện)                              |
| Ctrl+K "AI Teacher — trò chuyện / giảng trên bảng" | **mở được**               | ẩn khi `teacherLocked`                                             |
| "Hỏi thầy" trong 3D Nguyên phân, Giảm phân         | **mở được**               | nút ẩn khi `teacherLocked`                                         |
| `openTeacher()` / `openTeacherWithQuestion()`      | mở trang                  | không làm gì khi `teacherLocked` (chặn mọi lối, kể cả lối sau này) |
| Nút AI Teacher ở đầu kệ bài (`BenchHeader`)        | chỉ hiện khi `aiAllowed`  | giữ nguyên (chặt hơn)                                              |
| "Hỏi thầy" của Science Studio (`askInBubble`)      | vào tab "Hỏi AI", đã khoá | giữ nguyên                                                         |

AI vốn không trả lời được khi chưa đủ 18 tuổi: `chatService.ts` kiểm `currentSafety().aiAllowed` trước
mỗi câu hỏi, và cổng trong Rust cũng chặn. Đây là sửa cho giao diện nhất quán, không phải lỗ an toàn.

## Tests

- **Unit:**
  - `teacherGate.test.ts` (2): chưa đủ 18 thì `openTeacher` và `openTeacherWithQuestion` không mở trang,
    không ghi câu hỏi; đủ 18 thì mở và có câu hỏi trong ô.
  - `CommandPalette.test.tsx` (+2): chưa đủ 18 thì không có lệnh AI Teacher; đủ 18 thì có cả hai.
  - `askTeacher.test.tsx` (nguyên phân, +1) và `Meiosis3DView.test.tsx` (+1): chưa đủ 18 thì thẻ bộ
    phận không có nút "Hỏi thầy".
  - Cả 4 ca "chưa đủ 18" FAIL với mã trước khi sửa (đã chạy thử), PASS với mã mới.
- **E2E mới** `teacher-gate.spec.ts` (2): lần đầu chạy, trả lời "chưa đủ 18 tuổi", thẻ trang đầu khoá
  và Ctrl+K không có lệnh AI Teacher; đủ 18 (trạng thái lưu sẵn của E2E) thì Ctrl+K có 2 lệnh và mở
  được trang.

## Commands run (real results, summary lines only)

- `npm run check`: 411 tệp test đạt, 2 bỏ qua; 5156 test đạt, 3 bỏ qua.
- `npm run format:check`: đạt.
- `npx playwright test --workers=2`: 291 passed (9,2 phút).

## Next steps and limits

- Không đổi Rust (cổng trong Rust đã chặn mọi lời gọi AI).
