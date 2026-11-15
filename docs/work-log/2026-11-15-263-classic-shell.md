# 263-classic-shell — Quay lại cửa sổ cũ làm giao diện duy nhất

- **Goal:** người dùng quyết định (15/11/2026, issue #263) dùng lại cửa sổ cũ (`AppShell`: thanh
  trên, cột Thư viện, khung mô phỏng, thanh thời gian, bảng dưới, cột Thuộc tính, thanh trạng thái;
  trang "Hôm nay học gì?"; bong bóng AI Teacher) làm giao diện duy nhất. Bàn thí nghiệm không còn
  hiện ở đâu. Bài học, bản sửa và kí hiệu thêm sau PR #198 vẫn giữ.
- **Date/time:** 2026-11-15. Commit mốc `992c44ee` lúc 09:25 +0700 (theo git); bản ghi này viết lúc
  14:12 +0700.
- **Status:** PASS trên máy A, trừ 2 test E2E hỏng vì `node_modules` của bản làm việc tạm (xem "Kết quả kiểm thử cuối"); CI kiểm lại.
- **Branch / base:** `feat/old-shell` từ `main` 66c4f8b3.

## Quyết định và hai lần đổi phạm vi

1. Quyết định gốc: quay lại giao diện có trước PR #198; Bàn thí nghiệm thôi làm giao diện chính.
2. Phạm vi lúc đầu: vẫn giữ trang Kệ bài của Bàn thí nghiệm.
3. Phạm vi sau cùng: không giữ trang Kệ bài. Bàn thí nghiệm không hiện ở bất kì màn hình nào; tính
   năng chỉ bench mới có thì gắn lại vào cửa sổ cũ.

## Files

Commit mốc `992c44ee` (104 tệp):

- Lấy lại từ `f2e535e9^1` (commit ngay trước #198): `src/app/layout/` (`AppShell`, `TopBar`,
  `LeftSidebar`, `BottomPanel`, `Timeline`, `StatusBar`, `SubjectSwitch`, `Inspector` bản cũ,
  `layout.css`), `src/app/learner/` (`HomeScreen`, `LandingScreen`, `learner.css`),
  `src/teacher/chat/ChatBubble.tsx` + `chat.css`, `src/app/tauri.ts`, chữ i18n (`vi.ts`, `en.ts`) và
  token `--glass-*` trong `tokens.css`.
- `src/app/App.tsx` gắn `AppShell`; `src/main.tsx` thôi nạp `bench.css`; `index.html` và
  `public/theme-boot.js` thôi đặt giao diện bench trước khung hình đầu.
- Tính năng giữ lại trong cửa sổ cũ: nút SimLab 3D ở cột Thư viện (`LeftSidebar`), Tệp → "Thông tin
  máy" ở chế độ Nâng cao (`FileMenu`).
- E2E: 31 tệp spec của `tests/e2e/bench/` bị xoá, 33 tệp chuyển về `tests/e2e/`, thêm lại
  `layout.spec.ts`, `bio3d.spec.ts`, `cell-bio3d.spec.ts`, `cellzoom-bio3d.spec.ts` bản cũ;
  `playwright.config.ts` có `testDir: 'tests/e2e'`, một giao diện.

Sau commit mốc, trong cây làm việc (chưa commit lúc viết bản ghi này):

- Unit test của phần giao diện và các spec E2E đang được sửa cho cửa sổ cũ; test viết cho bench sau
  #198 mà tính năng còn thì chuyển sang `tests/e2e/post198-*.spec.ts`.
- Tài liệu: `CLAUDE.md` (mục "Giao diện: the classic window"), `README.md`, `docs/USER_GUIDE.md`,
  `docs/ARCHITECTURE.md`, `docs/PERFORMANCE.md`, `docs/AI_TUTOR.md`, `tests/e2e/README.md`,
  `docs/PROGRESS.md`, ghi chú trạng thái ở đầu `docs/BENCH_DESIGN.md`; đường dẫn E2E trong
  `docs/AI_COMPATIBILITY.md`, `docs/WHITEBOARD.md`, `docs/GAME.md`.

## Key decisions

- Lấy lại từng tệp của giao diện cũ từ `f2e535e9^1`, không đảo ngược cả PR #198: mọi thứ thêm sau
  #198 (bài học, bản sửa, kí hiệu) vẫn giữ.
- Mã nguồn Bàn thí nghiệm (`src/app/bench/`, `bench.css`, token và phông của bench) còn trong kho
  nhưng không được gắn: `BenchContext` là `false` ở mọi nơi, `<html data-shell="bench">` không bao
  giờ được đặt. Việc xoá hẳn để một PR dọn dẹp, người dùng xác nhận trước.
- Không thêm lại giao diện kiểu bench (kệ bài, sổ, khay, mép bàn); phần mới của bài học đặt vào
  các bảng của cửa sổ cũ. Quy tắc này ghi trong `CLAUDE.md`.

## Commands run (real results, summary lines only)

- Ở commit mốc: `npm run typecheck` sạch; eslint sạch trên các tệp vừa lấy lại.
- Ở commit mốc: Playwright `layout.spec.ts` + `learner.spec.ts`: 21/21 PASS.
- Sau commit mốc: Playwright nhóm `chromium-3d` 41/41 PASS và `chromium-3d-perf` 1/1 PASS (16 spec
  Sinh học / 3D; chỉ đổi cách tìm thanh trượt, vì thanh trượt đổi sau commit 8bd9e995).
- Sau commit mốc: Playwright nhóm nhẹ A: 66/67. Một test trượt: `chemistry.spec.ts:85` (SMILES lạ).
  Nguyên nhân thấy được: `node_modules` của worktree này là junction nên tệp wasm của RDKit không
  được phục vụ; cần xác nhận trên CI.
- Tài liệu: `npx prettier --check` trên các tệp tài liệu đã sửa: sạch.

## Tests

- Chưa chạy đủ `npm run check`, `npm run format:check` và toàn bộ E2E trên cây cuối cùng.

## Errors and fixes

- Chưa có lỗi nào được sửa trong phần tài liệu. Các điểm còn mở thấy được khi đọc mã để viết tài
  liệu nằm ở mục dưới.

## Evidence

- Ảnh chụp trang AI Teacher trên dev server (15/11/2026): trong phiên làm việc, không đưa vào repo.

## Next steps and limits

Đã sửa sau khi rà soát (subagent đọc mã và đo trên dev server):

- Token của trạm AI Teacher, `--text-caption` (thang cỡ chữ), `--shadow-l2`: trước chỉ có ở khối
  `:root[data-shell='bench']`, nay khai báo cả ở khối giao diện cũ (`tokens.css`).
- Quy tắc tuổi `teacherLocked` (#246): thẻ AI Teacher ở trang mở đầu và nút "Mở AI Teacher" bị tắt
  và ghi "AI Teacher cần bạn đủ 18 tuổi"; bong bóng chat không còn nút mở trang AI Teacher.
- Trang AI Teacher có lại tên ("AI Teacher" ở đầu khung chat).
- Thanh trượt bài Sinh và bài khí (`SliderField`), hộp "Thông tin máy", thanh tua của lần chạy liên
  tục (#212), bài Maxwell không còn hai biểu đồ, nét đứt của lần chạy đã ghim trên đồ thị, vạch
  trượt của ô chọn môn, dòng chữ "bong bóng chat" thay cho "sổ ghi".
- `playwright.config.ts`: `HEAVY_3D` có lại `drift3d`.

Còn mở:

- `PerfNotes` không còn được gắn: ở chế độ trình chiếu (không có thanh trạng thái) cảnh báo "chuyển
  động chậm" và "hạ chất lượng" không hiện.
- `CLAUDE.md` mục "Phase status" còn ghi 0.8.1 "not released yet", trong khi
  `release-notes/versions.json` ghi 0.8.1 và 0.8.2 đã phát hành; chưa sửa trong lần này.
- USER_GUIDE và README còn gọi nút "Think"; app ghi "Deepthink". Chưa sửa (không thuộc phần giao
  diện).

## Kết quả kiểm thử cuối

Chạy ngày 15/11/2026 trên máy A (laptop), dev server của bản làm việc, 1366 × 768:

- `npm run format:check`, `npm run lint`, `npm run typecheck`: PASS (cả repo).
- `npx vitest run`: 422/427 tệp đạt, 5263/5269 test đạt, 3 bỏ qua (có sẵn từ trước). 3 test trượt khi chạy cùng lúc với E2E 3D: `GraphPanel.test.tsx` (test cũ khẳng định giao diện cũ không vẽ nét đứt; đã sửa theo #263), `tests/app.test.tsx` "Science Studio…" và `mitosis3d/scene.perf.test.ts` (đo thời gian, máy đang bận). Chạy lại riêng 3 tệp: 25/25 PASS.
- E2E `chromium`: 180/185 PASS. 3 test viết sau #198 theo giao diện mới đã sửa theo giao diện cũ (`post198-chemistry.spec.ts` Maxwell 100 % và 140 %: biểu đồ ở bảng dưới; `post198-teacher.spec.ts` dưới 18 tuổi: thẻ AI Teacher tắt và ghi lý do); chạy lại hai tệp: 21/21 PASS. 2 FAIL do môi trường: `chemistry.spec.ts:85` (SMILES lạ) và `bench-fonts.spec.ts` — `node_modules` là junction sang ổ D nên dev server không trả tệp `/@fs/…` (RDKit wasm, phông); không phải lỗi app, CI kiểm.
- E2E `chromium-3d`: 58/58 PASS. `chromium-3d-perf`: 1/1 PASS.
