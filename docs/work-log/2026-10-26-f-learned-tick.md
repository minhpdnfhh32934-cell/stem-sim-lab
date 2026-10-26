# (f) — dấu "Đã học" trong thư viện (issue #68, kế hoạch #37 mục 9)

- **Goal:** mở chủ đề nào (môn nào) cũng có dấu "Đã học"; chủ đề Vật lí còn việc hiện "1/3"; xong hết
  hiện "Hoàn thành" (khác dấu tick); số trên chương = chủ đề đã mở; huy hiệu chương giữ luật "hoàn thành".
- **Date/time:** 2026-10-26, 12:45–13:28 +07:00
- **Status:** PASS
- **Branch / base:** `feat/68-learned-tick` từ `main` `d6f9fec`

## Acceptance criteria (oracle không phải code đang sửa)

1. Mở `periodicTable` (Hoá), `mitosis` (Sinh), `freeFall` (Lí) → cả ba có "Đã học" (oracle: danh sách
   thử thách / POE trong `src/learn/challenges.ts`, `poe.ts`: Hoá, Sinh không có hoạt động).
2. `freeFall` chỉ mở → "1/3", còn "Dự đoán trước" và 1 thử thách (oracle: 1 POE `freeFall.h0`,
   1 thử thách `freeFall.t2`).
3. Đủ ba bước → "Hoàn thành", không còn "1/3".
4. Chương "Động học" có 2 chủ đề đã mở → "2/5" (oracle: `CATALOG` có 5 chủ đề).
5. Hai test cũ của `progress.test.ts` giữ nguyên.
6. E2E: mở "Ném ngang" → mô tả "Đã học — xong 1/3 bước…"; làm xong → "Đã hoàn thành chủ đề".

## Files

- `src/learn/progress.ts`: `topicStatus` (new / opened / complete + done/total + việc còn lại);
  `chapterProgress` đếm chủ đề đã mở. `topicProgress` giữ nguyên (huy hiệu dùng).
- `src/app/layout/LeftSidebar.tsx`: `TopicButton` — dấu là mô tả (`aria-describedby`) nên tên nút
  vẫn là tên chủ đề; chú thích (`data-tip`) trên cả dòng; lúc tìm kiếm, số chương là số chủ đề khớp.
- `src/app/layout/layout.css` (`.tree__mark`, `.tree__steps`, chỉ token), i18n vi/en (5 khoá cuối nhóm
  `learn`, bỏ khoá `learn.progress` không còn dùng), `docs/USER_GUIDE.md`, `CLAUDE.md`.
- Test: `src/learn/progress.test.ts` (+2), `src/app/layout/LeftSidebar.test.tsx` (mới, 3),
  `tests/e2e/learner.spec.ts`.

## Key decisions

- Chủ đề không có hoạt động (Hoá, Sinh) dừng ở "Đã học", không hiện "Hoàn thành".
- Dấu chuyển từ `aria-label` trong tên nút sang mô tả: E2E tìm nút theo tên đúng (`exact`) không vỡ
  khi chủ đề đã mở.
- Rà soát bằng 3 agent + kiểm chéo: sửa 4 điểm (số chương khi tìm kiếm; tương phản "1/3" trên dòng
  đang chọn 4,29:1 → `--text-muted`; chú thích trên cả dòng cho bàn phím; tiếng Anh "{count} challenge(s)").

## Commands run (real results, summary lines only)

- `npm ci` (node_modules cũ, thiếu `@fontsource/*` sau các bản nâng của dependabot) → xong.
- `npx eslint src tests scripts *.ts *.js` → exit 0.
- `npx prettier --check <các mục git theo dõi>` → không cảnh báo nào ngoài `.claude/worktrees/`.
- `npm run typecheck` → exit 0.
- `npm test` → 308 file passed, 1 skipped; 4212 tests passed, 1 skipped.

## Tests

- Unit: PASS (như trên).
- E2E `npx playwright test` (cả 3 nhóm chromium, chromium-3d, chromium-3d-perf): PASS, 109 passed (7,5 phút);
  @perf nguyên phân p50 33,3 ms / p95 66,7 ms.

## Errors and fixes

- `npm run check` / `npm run lint` hỏng trên máy này: `prettier --check .` và `eslint .` quét cả
  `.claude/worktrees/*` (4 worktree của phiên khác, có `src-tauri/target`) → prettier báo hàng trăm
  file, eslint hết bộ nhớ (heap 4 GB). Môi trường, không phải code; CI không có thư mục này. Chạy
  lại trên các mục git theo dõi (lệnh ở trên).
- 4 unit test AI Teacher hỏng trước `npm ci` (thiếu `@fontsource/pangolin`) → hết sau `npm ci`.

## Next steps and limits

- Đề xuất riêng (cần người dùng đồng ý vì là cấu hình công cụ): thêm `.claude/worktrees` vào
  `.prettierignore` và `ignores` của eslint để `npm run check` chạy được trên máy có worktree.
- Kế tiếp: (i1) #69.
