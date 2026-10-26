# (j) — hướng dẫn "Cách học" trong Science Studio (issue #72, kế hoạch #37 mục 9c)

- **Goal:** nút "Cách học" (icon Lucide `CircleHelp`, ≥ 40 px) ở đầu màn Science Studio mở một chuỗi bước ngắn
  chỉ vào từng phần thật trên màn hình; tự mở một lần ở lần đầu vào Studio, sau đó chỉ khi bấm nút; dùng lại
  `Tour.tsx`; "đã xem" lưu trong `stemsim.studio` (nâng phiên bản lưu); Esc đóng; không chuyển động khi giảm
  chuyển động; tour lần đầu của Phòng thí nghiệm không đổi.
- **Date/time:** 2026-10-26, 17:00–18:35 +07:00
- **Status:** PASS
- **Branch / base:** `feat/72-studio-guide` từ `main` `d6f9fec`

## Acceptance criteria

1. Lần đầu vào Studio thấy hướng dẫn; đóng rồi mở lại app (tải lại trang) không tự hiện nữa; bấm "Cách học" hiện lại.
2. Mỗi bước chỉ vào phần có thật (bộ chọn tìm thấy phần tử); bước "Lưu báo cáo" chỉ vào bước Báo cáo.
3. Thẻ hướng dẫn luôn nằm trong cửa sổ ở mọi bước (1366×768); không cuộn ngang.
4. Esc đóng; Tab không ra khỏi thẻ; đóng xong con trỏ bàn phím về nút "Cách học".
5. Dữ liệu `stemsim.studio` phiên bản 1 → coi như chưa xem; phiên bản 2 giữ `guideSeen`.
6. Tour lần đầu của Phòng thí nghiệm như cũ (`Tour.test.tsx` giữ nguyên, 5 test).

## Files

- `src/app/project/Tour.tsx`: tách `TourOverlay` (thẻ, điểm sáng, Tiếp/Quay lại/Bỏ qua, Esc) dùng chung; thêm:
  cuộn tới mục tiêu trước khi đo, giữ thẻ trong cửa sổ, Tab vòng trong thẻ, trả focus khi đóng, `aria-describedby`,
  id bằng `useId`.
- `src/studio/StudioGuide.tsx`, `src/studio/guideSteps.ts` (mới), `StudioScreen.tsx` (nút, `data-tour`), `studio.css`.
- `src/studio/studioStore.ts` (`guideSeen` lưu, `guideStep` không lưu), `session.ts` (phiên bản 2, `migrateStudio`).
- i18n vi/en: nhóm `studio.guide` ở cuối nhóm `studio`.
- Test: `StudioGuide.test.tsx` (mới), `session.test.ts` (+ chuyển đổi), `tests/setup.ts` và `tests/e2e/storage-state.json`
  (các test khác bắt đầu với hướng dẫn đã xem), E2E `studio.spec.ts` (+1).
- Tài liệu: `docs/USER_GUIDE.md` (Cách học), `CLAUDE.md` (Science Studio), `tests/e2e/README.md`.

## Key decisions

- Dùng lại `Tour.tsx` (không viết loại hướng dẫn thứ hai). Không có số liệu khoa học → không cần DATA_REVIEW.
- Rà soát 2 agent + kiểm chéo, đã sửa: bộ chọn bước "Lưu báo cáo" khớp nhầm bước "Dự đoán"; thẻ có thể rơi ngoài
  cửa sổ khi mục tiêu ở dưới (Studio cuộn được); focus không trở lại sau khi đóng, Tab ra khỏi hộp thoại; lời văn
  ("AI Teacher" thống nhất, "dấu ✓ thay cho số").

## Tests

- Unit: `npm test` PASS — 308 file, 4211 test (1 skipped có sẵn) trước khi sửa sau rà soát; sau sửa:
  `StudioGuide.test.tsx` + `Tour.test.tsx` 10/10, `session.test.ts` 10/10, `src/studio` + `src/app/project` 162/162.
- `npm run typecheck`, ESLint (`src tests scripts` + cấu hình gốc), Prettier (mọi tệp khác `main`): PASS.
- E2E `studio.spec.ts` (chromium): PASS 8/8 (có bài mới).
- E2E đầy đủ `npx playwright test`: lần 1 (17,3 phút, máy đang chạy song song 8 agent rà soát có chạy vitest) FAIL 4
  bài không liên quan — `teacher.spec.ts:307`, `ai-flow.spec.ts:312`, `board.spec.ts:412`, `studio.spec.ts:452`
  ("waiting for navigation to finish", quá giờ) → phân loại **chập chờn khi máy quá tải**; lần 2 khi máy rảnh (sau
  sửa rà soát): **PASS 110 passed (9,0 phút)**, @perf p50 33,4 ms / p95 83,3 ms.

## Next steps and limits

- (g2) chờ PR (g1) #82 gộp; tiếp theo (k) #73.
