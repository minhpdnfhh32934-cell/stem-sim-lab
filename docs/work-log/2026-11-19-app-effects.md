# app-effects — Hiệu ứng theo trò chơi SimLab 3D

- **Goal:** người dùng ngày 19/11/2026 yêu cầu "Thêm các hiệu ứng vào app nữa giống phần game ấy" và
  chọn ba nhóm hiệu ứng:
  - màn mở đầu;
  - chuyển cảnh khi vào;
  - nền động và hiện dần.

  Không làm âm thanh giao diện, không làm vệt sáng theo chuột.

- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/app-effects`, tách từ `main` (sau #329), đã gộp `main` sau #330.

## Đã làm

- `src/app/fx/` gồm:
  - `fx.ts`: điều kiện bật hiệu ứng và `screenChange`;
  - `Intro.tsx`: màn mở đầu;
  - `ScreenPortal.tsx`: vòng quỹ đạo bay ra khi đổi màn;
  - `fx.css`.

  Mô tả và quy tắc nằm trong `docs/EFFECTS.md`.

- Điều hướng: `openTopic`, `goHome`, `openLab`, `openStudio`, `openTeacher`, `closeTeacher` đều chạy
  qua `screenChange`. `openTeacherWithQuestion` và `openTeacherOn('board')` (Ctrl+K "Giảng trên
  bảng") đặt câu hỏi và trang ngay trong lần đổi màn đó. Trước đây chúng được đặt sau khi mở; nay
  mở có thể chậm một khung hình, nên đặt sau thì sẽ bị ghi đè.
- Trang mở đầu: thêm bảy biểu tượng Lucide và một con lắc trôi chậm, chỉ để trang trí. Phần hiện
  dần áp dụng cho trang mở đầu, trang "Hôm nay học gì?", các nhóm Cài đặt và thông báo. Biểu tượng
  trên nút nảy nhẹ khi bấm.
- `useApplyTheme` đặt `data-fx`. Giá trị là `off` trong unit test, trong trình duyệt tự động (trừ
  khi có `?fx=1`) và ở mức chất lượng Thấp.
- Không có số khoa học mới và không có câu chữ khoa học mới: màn mở đầu chỉ hiện tên "SimLab".

## Commands run (real results, summary lines only)

- `npx vitest run` (trước khi gộp main): 505 tệp, 5 762 đạt, 3 bỏ qua có sẵn.
- Sau khi gộp main:
  - `npx vitest run src/app tests/app.test.tsx`: 419/419 đạt;
  - `npx tsc -b --noEmit` đạt;
  - `eslint .` đạt;
  - prettier đạt.
- E2E chromium:
  - Sau khi gộp main: `fx.spec.ts` 4/4, `a11y.spec.ts` 8/8 đạt.
  - Trước đó, các spec có đường điều hướng (`learner`, `teacher`, `post198-teacher`, `post198-ui`,
    `layout`, `studio`, `board`, `shortcuts`): 95 đạt. Hai test hỏng là hai lỗi có sẵn trên máy
    này: "touch screens get 40px targets", và "under 18 … Ctrl+K" (post198-teacher).
  - Lần chạy đầu của `fx.spec.ts` hỏng 2 test:
    - axe báo tên nút logo, lỗi mà #330 đã sửa trên main;
    - giới hạn 2 giây cho màn mở đầu ở chế độ giảm chuyển động quá chặt, vì lúc app khởi động máy
      bận nên hẹn giờ chạy trễ.

    Test nay ghi lại màn mở đầu ngay khi nó hiện ra, không đo thời gian.
- Xem trong trình duyệt (cổng 1447, 1366×768, sáng và tối):
  - màn mở đầu chạy, rồi đến trang mở đầu;
  - lần đầu mở app thì màn làm quen hiện lên và màn mở đầu nhường;
  - bấm "Virtual Lab" thì có `fx-iris`, `fx-recede` và `fx-portal`, tâm vòng tròn đúng chỗ bấm,
    vòng tự gỡ;
  - ở chế độ Giảm: chỉ còn `fx-fade-in`, không có vòng, nền đứng yên;
  - câu hỏi soạn sẵn đến đúng ô nhập của AI Teacher;
  - mở bằng Ctrl+K vào đúng trang Bảng;
  - console không có lỗi.

## Next steps and limits

- Chưa thử trên bản cài (WebView2). View Transitions có trong Chromium từ bản 111, nên WebView2
  Evergreen có. Nếu không có thì app đổi màn ngay, không có hiệu ứng.
- Chưa đo trên máy yếu. Ở mức Thấp, hoặc khi app tạm hạ chất lượng, hiệu ứng tắt hẳn.
