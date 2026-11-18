# remove-bench — Xóa mã "Bàn thí nghiệm" không còn dùng

- **Goal:** người dùng quyết định ngày 18/11/2026: "xóa mã Bàn thí nghiệm không dùng". Giao diện
  "Bàn thí nghiệm" (0.8.1) đã không còn hiện từ #263 (15/11); mã của nó vẫn nằm trong repo.
- **Date/time:** 2026-11-18 (+0700).
- **Status:** PASS
- **Branch / base:** `chore/remove-bench`, tách từ `main` 4a0a7b91. Thay cho #200 (đã đóng: kế
  hoạch đó định giữ Bàn thí nghiệm, quyết định 15/11 chọn ngược lại).

## Cách tìm mã chết

- Dựng đồ thị import của `src/` từ `src/main.tsx`, không đi qua `BenchShell` (không ai gắn nó):
  13 tệp của `src/app/bench/` không còn đường nào tới.
- `BenchContext` chỉ `BenchShell` đặt là true, nên mọi nhánh `bench` / `onEdge` ở 40 tệp còn lại là
  nhánh chết: giữ nhánh giao diện cũ, bỏ nhánh Bàn thí nghiệm.
- Mỗi phần chỉ nhánh chết dùng cũng chết theo: `Driver` của 6 bài Hóa học (và trường `Driver`,
  `trayStartsFolded` của `ModuleView`), `EdgePortal` / `EdgeSteps` / `DriverGrid`, "sân khấu sống"
  `Live` của bài Vật lí trong Studio (`PhysicsLive`), `ReportOrigins`, `DimRestSwitch`, `poeRun`
  ("Chốt dự đoán"), "Tự xoay" của phân tử, `UpdateReminder`, `useCutTip`, `gateFirstRun`, các
  trường khay / sổ ghi của `layoutStore`.

## Giữ lại và chuyển chỗ

- `MachineInfo` → `src/app/project/` (Tệp → "Thông tin máy").
- `ShellOverlays`, `useLoaded` → `src/app/layout/`.
- Khóa i18n còn dùng: `bench.loadFailed` → `app.loadFailed`, `bench.decrease` / `bench.increase`
  → `params.decrease` / `params.increase`, `bench.teacherLocked` → `teacher.ageLocked`. Các khóa
  khác của nhóm `bench` và các khóa chỉ mã đã xóa dùng thì bỏ (vi và en như nhau).
- `stemsim.layout` vẫn version 1: trường khay / sổ ghi đã lưu bị bỏ qua khi nạp, mất ở lần lưu sau.

## Đã xóa thêm

- `bench.css`, khối `:root[data-shell='bench']` trong `tokens.css`, `benchFonts.ts`, E2E
  `bench-fonts.spec.ts`, nhánh `isBench` và `openProblem` trong `tests/e2e/nav.ts`.
- `docs/THIRD_PARTY.md`: mục mẫu uiverse.io (chỉ `bench.css` và `ThemeSwitch` dùng) và mục phông
  Be Vietnam Pro / JetBrains Mono.
- Test chỉ kiểm Bàn thí nghiệm. Test màu: `tokens.test.ts`, `recipes.test.ts`, `looks.test.ts` nay
  chỉ kiểm bảng màu sáng / tối thật; test màu trạm AI Teacher (#234) chuyển sang bảng màu này
  (các biến `--teacher-*` có sẵn trong khối sáng / tối).

## Commands run (real results, summary lines only)

- `npx tsc -b --noEmit`: đạt.
- `npx eslint . --ignore-pattern "*.local.config.ts"`: đạt.
- `npx prettier --check`: đạt.
- `npx vitest run`: 5 726 test, 5 722 đạt, 3 bỏ qua có sẵn. `tests/app.test.tsx` "Science Studio
  shows inside the lab" hỏng một lần vì màn Studio nạp lần đầu chậm khi cả bộ chạy; chạy lại 15/15
  đạt. (`useCutTip.test.tsx` báo "không tìm thấy" vì tệp bị xóa trong lúc bộ test đang chạy.)
- E2E `chromium` (learner, physics, chemistry, post198-chemistry, post198-physics, project,
  studio): 79 đạt, 2 hỏng: "touch screens get 40px targets" (chỉ hỏng trong thư mục tạm, như các
  đợt trước) và "every chemistry topic opens…" (quá tải khi chạy song song; chạy riêng đạt).

## Next steps and limits

- `useDimRest` (làm mờ phần không chọn ở nguyên phân / giảm phân 3D) không còn công tắc, luôn bật
  như mặc định trước đây; `speed` của bài cơ chế phản ứng luôn 1×. Giữ vì cảnh 3D và hình vẫn đọc
  chúng.
- `docs/BENCH_DESIGN.md` giữ làm tài liệu lịch sử.
