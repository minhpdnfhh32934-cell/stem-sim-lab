# (g2) — thanh "Lớp 10 · Lớp 11 · Lớp 12 · Tất cả" trong Thư viện (issue #71, kế hoạch #37 mục 10)

- **Goal:** thay "Nền tảng · Đại cương" bằng thanh chọn lớp; lớp = chủ đề dưới tên chương SGK theo thứ tự
  sách, kèm "Bài n" và nhãn "Theo SGK Kết nối tri thức · Đang chờ giáo viên duyệt"; "Tất cả" như cũ; không
  ngõ cụt; lần đầu hỏi lớp; trang chủ gợi ý theo lớp; `profileStore` thêm `grade` (v2); lớp không gửi cho AI.
- **Date/time:** 2026-10-26, 18:20–19:50 +07:00
- **Status:** PASS (xem "Tests"; một lượt E2E đầy đủ sau bản sửa rà soát chưa chạy)
- **Branch / base:** `feat/71-grade-switch`, cắt từ `feat/71-curriculum-data` (`38eb38a`), đã merge
  `origin/main` sau khi #82 (g1) gộp (`70b5b7c`).

## Files

- `src/app/levels.ts`: `GRADE_CHOICES`, `chaptersFor(grade, subject)` (lớp → `gradeView`; "Tất cả" →
  `CATALOG`), `suggestions` và `availableCount` theo lớp. Bỏ `LEVELS`/`LevelInfo`.
- `src/app/learner/profileStore.ts`: `grade: GradeChoice` (mặc định `all`), `setGrade`; bản lưu v2:
  v1 → `grade: 'all'`, `level: 'foundation'`; lớp hỏng trong bản lưu → `all`. Bỏ `setLevel`.
- `src/app/layout/LeftSidebar.tsx` (`Library`, một dòng trong `ChapterNode`), `HomeScreen.tsx`,
  `Onboarding.tsx`, `learner.css` (mục "Grade picker"), i18n `levels.*` thêm cuối nhóm; đổi giá trị
  `levels.label`, `onboarding.levelTitle/levelBody`, `home.suggestedTitle/noSuggestions`; bỏ khoá không còn
  dùng (`levels.foundationDesc/generalDesc/soon/plannedHint/mappingPending`).
- Test: `src/app/learner/learner.test.tsx`, `tests/e2e/learner.spec.ts`, `tests/e2e/project.spec.ts`.
- Tài liệu: `docs/USER_GUIDE.md` (mục "Trình độ"), `CLAUDE.md` (Learner UI: profileStore, Library views).

## Key decisions

- `Level` giữ nguyên (`foundation`), `LEVEL_HINT` không đổi; lớp chỉ xếp danh sách. Người dùng v1 lỡ
  chọn "Đại cương" (chưa bao giờ có chủ đề) được đưa về "Nền tảng", vì không còn chỗ nào đổi trình độ.
- Tên chương SGK hiện nguyên văn, cả ở giao diện tiếng Anh (quy tắc chép nguyên văn của (g1)).
- Ô tìm kiếm tìm trong khung đang xem; khi không thấy ở một lớp thì có thêm nút "Xem tất cả".
- Rà soát độc lập: 2 agent (logic + test; UI/a11y + chữ). Các điểm đã kiểm lại và sửa: thanh 4 nút tràn
  ở Thư viện 200 px / chữ 140 % (E2E mới bắt được 3 px, sửa bằng co giãn + gấp dòng); trang chủ thiếu
  nhãn chờ duyệt; tiêu đề gợi ý; mất focus sau "Xem tất cả"; câu ở bước làm quen; "Lessons" số nhiều; câu
  "chưa có chủ đề … nào được xếp vào lớp …"; `level: 'general'` của v1; lớp hỏng trong bản lưu; thiếu test
  nút "có ở môn khác" và trang chủ theo lớp; CSS `.home__soon` thừa.

## Commands run (real results, summary lines only)

- `npm ci` → OK. `npm run typecheck` → 0 lỗi. `npm run lint` (`eslint .`) → 0 lỗi.
- `npm test` (trước bản sửa rà soát) → 308 tệp đạt, 4219 test đạt, 1 bỏ qua (sẵn có).
- `npx vitest run src/app/i18n src/app/learner src/app/curriculum.test.ts src/teacher/chat/chatQuality.test.ts`
  (sau bản sửa) → 60/60.
- `npx prettier --check` trên mọi tệp khác `main` → sạch.

## Tests

| Kiểm tra                                                                                                                                                                                                                                                | Kết quả                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit `learner.test.tsx` (15 test: lớp/“Tất cả”, gợi ý, chuyển bản lưu v1 + lớp hỏng, thanh lớp trong Thư viện, lớp trống, nút “có ở môn khác”, focus, trang chủ theo lớp, làm quen)                                                                     | PASS                                                                                                                                                                             |
| Unit `curriculum.test.ts` (`gradeView` theo thứ tự SGK, chủ đề ở hai lớp, lớp trống) — của (g1)                                                                                                                                                         | PASS                                                                                                                                                                             |
| Unit i18n (đủ khoá vi/en)                                                                                                                                                                                                                               | PASS                                                                                                                                                                             |
| E2E `learner.spec.ts` (7 test, gồm: Lớp 10 → "Chuyển động thẳng đều Bài 4–5, 7" dưới "Chương II. Động học"; Sinh học Lớp 11 → câu "chưa có" + "Xem tất cả"; nút ≥ 40 px; không cuộn ngang 1366×768; Thư viện 200 px + chữ 140 % + tiếng Anh không tràn) | PASS (sau bản sửa)                                                                                                                                                               |
| E2E `project.spec.ts` (bước đầu: "Bạn đang học hoặc ôn lớp nào?" → Lớp 12 → Thư viện mở ở Lớp 12)                                                                                                                                                       | PASS trước bản sửa rà soát; lượt sau bản sửa: xem "Next steps"                                                                                                                   |
| E2E toàn bộ (trước bản sửa rà soát)                                                                                                                                                                                                                     | 69 đạt, 5 hỏng do máy quá tải (ai-flow:139, board-picture:190, chemistry:24, lesson-flow:74, studio:137 — chạy lại riêng 1 worker: 5/5 đạt), 9 không chạy (nhóm 3D chờ nhóm đầu) |

## Errors and fixes

- Tên nút "Chuyển động thẳng đềuBài 4–5, 7" (thiếu dấu cách trong tên đọc cho trình đọc màn hình) → thêm `' '`.
- Test chuyển bản lưu: `setState` ghi đè bản lưu cũ → đặt `setState` trước `localStorage.setItem`.
- Trên Windows, bộ lọc `tests/e2e/x.spec.ts` không lọc; chạy không có `--project` kéo cả nhóm `chromium`
  (phụ thuộc của `chromium-3d`). Dùng `x.spec.ts --project=chromium`.
- Sự cố khoá E2E: một lệnh của phiên này lỡ xoá khoá của phiên khác (rm sau `;` khi mkdir thất bại); đã tạo
  lại khoá, báo điều phối viên; từ đó dùng script chỉ xoá khoá mình tạo.

## Next steps and limits

- Dự án chuyển sang `D:\Projects\stem-sim-lab` (quyết định của người dùng 26/10). Nhánh đã push:
  `feat/71-grade-switch`.
- Việc còn lại: (1) chạy lại `npx playwright test project.spec.ts --project=chromium` sau bản sửa rà soát
  nếu lượt xếp hàng chưa kịp chạy (xem mô tả PR); (2) một lượt E2E đầy đủ `npx playwright test` trước khi gộp
  (theo giao thức khoá); (3) khi #79 (f) gộp: `git merge origin/main`, sửa xung đột ở `LeftSidebar.tsx`
  (`ChapterNode`: giữ `TopicButton` của (f) và thêm `lessons` + tên chương `chapterTitle`) và
  `tests/e2e/learner.spec.ts`; (4) khi Sinh (a) #77 gộp: kiểm số chủ đề Sinh và chạy lại script xếp lớp
  nếu có dòng mới.
- Giới hạn: "Đại cương" vẫn là giá trị của trường "trình độ" trong Soạn bài (không đổi theo kế hoạch).
