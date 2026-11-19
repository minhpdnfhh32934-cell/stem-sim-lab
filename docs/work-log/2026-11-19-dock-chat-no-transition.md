# dock-chat-no-transition — bỏ vòng chuyển màn; khung chat không che mô phỏng

- **Goal:** người dùng yêu cầu ngày 19/11/2026 (kèm ảnh vòng tròn chuyển màn): "Xóa hiệu ứng click
  này đi, và fix lại đừng để màn hình mở AI Teacher che đi màn hình mô phỏng".
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/dock-chat-no-transition`, tách từ `main` (sau #335).

## Người dùng đã chọn

- Khung chat: "Chen thành một cột" (không chọn "đè lên thư viện bài").
- Hiệu ứng: "Chỉ bỏ vòng chuyển màn" (giữ màn mở đầu, nền động, hiện dần, biểu tượng nảy khi bấm).

## Đã làm

- Gỡ `screenChange` (View Transitions) và `ScreenPortal` (vòng quỹ đạo bay ra): `fx.ts`, `fx.css`,
  `ShellOverlays.tsx`; `topics.ts` trở về đúng bản trước #331; `teacherStore.ts` gọi thẳng (giữ
  `openTeacherOn`, `showTeacher`).
- Khung chat trong phòng thí nghiệm là một cột riêng (`chat.css`, `.shell:has(.chat-bubble-root >
.chat-panel)`): vùng giữa chừa đúng chỗ cho khung chat; trong lúc chat mở, thư viện về 200 px và
  bảng thông số về 240 px (cỡ nhỏ nhất của `LAYOUT_LIMITS`), nên vùng giữa vẫn khoảng 460 px ở
  1366×768 và không nút nào bị khung chat che. Đóng chat thì trở lại độ rộng của người học. Màn rộng
  ≤ 520 px vẫn để khung chat là một tấm phủ như cũ.
- Đo ở 1366×768: trước khi sửa vùng giữa 808 px và khung chat che phần bên phải; sau khi sửa vùng
  giữa 461 px, kết thúc trước khung chat 7 px; trang "Hôm nay học gì?" (không có bảng thông số):
  vùng giữa 698 px; không có cuộn ngang.

## Commands run (real results, summary lines only)

- `npx vitest run`: 5 802 đạt, 3 bỏ qua có sẵn. `npx tsc -b --noEmit`: đạt.
- `npx playwright test` teacher, fx, post198-teacher, learner, board, a11y (chromium): 66 đạt, gồm
  bài mới "the open chat takes its own column".
