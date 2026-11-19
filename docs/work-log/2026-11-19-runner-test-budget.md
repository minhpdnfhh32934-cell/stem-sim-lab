# runner-test-budget — bài `runner.test.ts` không còn đỏ ngẫu nhiên trên CI

- **Goal:** CI của #332 (19/11/2026) đỏ ở bài "reports real-time speed on high-refresh screens (no
  false slow motion)", trong khi #332 không đụng tới phần này.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/runner-test-budget`, tách từ `main` (sau #333).

## Nguyên nhân

Bài chạy `EngineRunner` với giới hạn mặc định 8 ms mỗi khung hình, mà giới hạn này đo bằng giờ
thật. Máy CI có lúc chậm một nhịp, khung hình vượt 8 ms, nên runner báo `throttled = true` và bài
đỏ. Trong khi đó bài chỉ cần kiểm tra giới hạn số bước con (lỗi "chạy chậm giả" trên màn hình tần
số cao), không cần kiểm tra giờ thật.

## Đã làm

- `src/core/sim/runner.test.ts`: bài này dùng giới hạn rộng 1000 ms, giống hai bài khác trong cùng
  tệp. Bài "slows down honestly when the frame budget is exceeded" vẫn kiểm tra riêng phần giới
  hạn giờ thật. Không sửa mã của app.

## Commands run (real results, summary lines only)

- `npx vitest run src/core/sim/runner.test.ts`: 9/9 đạt.
- `npx eslint`, `npx prettier --check` trên tệp đã sửa: đạt.
