# (i1) — đồ thị Vật lí đọc được ở 1366×768 (issue #69, kế hoạch #37 mục 9b)

- **Goal:** ở 1366×768, bảng dưới mặc định 220 px: chữ "Nhấn Chạy để ghi dữ liệu cho đồ thị." không đè
  số của trục; chú giải nằm trong bảng; vùng vẽ ≥ 80 px; không cuộn ngang. Không đổi số liệu nào.
- **Date/time:** 2026-10-26, 13:35–14:13 +07:00
- **Status:** PASS
- **Branch / base:** `feat/69-physics-graph-layout` từ `main` `d6f9fec`

## Acceptance criteria (oracle: hình học DOM đo trong trình duyệt, không phải code đang sửa)

1. Mọi chủ đề Vật lí × mọi đồ thị, trước và sau khi Chạy: `.u-over` (vùng vẽ của uPlot) cao ≥ 80 px.
2. Chú giải (`.u-legend`) nằm trong `.bottom-panel`.
3. Chữ "chưa có dữ liệu" (khung của chính dòng chữ) nằm trong vùng vẽ, nên không chạm dải trục.
4. Không cuộn ngang.
5. Rê chuột lên đồ thị (chú giải hiện giá trị) không làm vùng vẽ đổi bề rộng.

## Đo trước khi sửa (main, "Mặt phẳng nghiêng")

Bảng dưới 220 px → khung đồ thị 132 px; trục thời gian 80 px (uPlot mặc định 50 + 30), lề trên 17 px →
vùng vẽ **35 px**; chú giải 24 px nằm dưới khung, đáy 760 > mép bảng 744. `layout.spec.ts` mới báo đúng
ba lỗi này trên code cũ.

## Files

- `src/app/sim/GraphPanel.tsx`: trục thời gian gọn (`X_AXIS_SIZE` dùng chung với `XYChart`), khoảng
  vạch trục tung `yTickSpace` (như `XYChart`), lề trên 8 px; chú giải chuyển sang cột bên phải
  (`legend.mount`); chữ "chưa có dữ liệu" đặt vào vùng vẽ (`createPortal` vào `plot.over`).
- `src/app/sim/sim.css`: `.chart--legend-side`, `.chart__legend` (cột rộng cố định 13rem, tối đa 40 %;
  dòng dài thì xuống dòng), `.chart__empty` căn giữa trong vùng vẽ, `.graph-panel` đệm `--space-1`.
- `tests/e2e/layout.spec.ts` (mới, nhóm nhẹ `chromium`).

## Key decisions

- Chú giải một hàng trên/dưới đồ thị tốn 24–48 px (chủ đề có 4 đồ thị: nút chọn 495 px + chú giải
  "Năng lượng" 432 px không vừa một hàng → vùng vẽ 60 px). Cột bên phải giữ trọn chiều cao cho mọi đồ thị.
- Rà soát 2 agent + kiểm chéo: cột chú giải rộng theo nội dung → vùng vẽ co giãn 25 px khi rê chuột
  (đã thêm bước rê chuột vào test; không sửa thì test hỏng "Received difference: 25"). Lần sửa đầu
  (`min-width: 10ch` cho giá trị) vẫn hỏng 2 px ở "Con lắc lò xo · Năng lượng dao động" (giá trị dài hơn
  10 ký tự) → cột chú giải rộng cố định. Bỏ đoạn `fit()` chép từ XYChart không bao giờ chạy.

## Commands run (real results, summary lines only)

- `npx playwright test tests/e2e/layout.spec.ts --project=chromium` trên code cũ → FAIL (35 px; chú giải
  760 > 744; chữ ngoài vùng vẽ). Sau khi sửa → PASS.
- `npx eslint src tests scripts *.ts *.js` → exit 0; `npm run typecheck` → exit 0;
  `npm test` → 307 file passed, 1 skipped; 4207 tests passed, 1 skipped.

## Tests

- Unit: PASS. E2E `layout.spec.ts`: PASS.
- E2E đầy đủ `npx playwright test`: lần 1 FAIL (`layout.spec.ts`: chờ `aria-current` 5 s khi dev server
  còn biên dịch cảnh "Ròng rọc" lúc chạy song song → nâng lên 20 s như các bước chờ khác); lần 2 FAIL
  (2 px khi rê chuột, xem trên); lần 3 **PASS: 110 passed (7,9 phút)**, @perf p50 33,3 ms / p95 66,6 ms.

## Next steps and limits

- Đồ thị dùng chung `XYChart` (Hoá, Sinh) và mọi màn khác: rà ở (i2) #70 ngày 01/11.
- Chưa đo khi kéo bảng dưới nhỏ nhất (thuộc phạm vi (i2)).
- Ghi cho (i2): đồ thị "Năng lượng dao động" của Con lắc lò xo có đoạn đầu (≈ 0,15–0,7 s) trông như ít
  điểm nối thẳng; có từ trước PR này (không đổi dữ liệu), cần xem nguyên nhân.

## 26/10/2026 chiều — sửa theo so sánh mù (#81 được giữ, #80 đóng)

- `layout.spec.ts`: thẻ Đồ thị không được cuộn (`[role="tabpanel"]` scrollHeight − clientHeight ≤ 1);
  chọn đồ thị bằng bàn phím (Enter) thì đồ thị đó được chọn và con trỏ bàn phím vẫn ở nút chọn; chờ hai
  khung hình thay cho chờ cố định 300 ms ở bước rê chuột; chỉ lặp qua danh sách "Vật lý" (chọn môn trước).
- Chữ "Nhấn Chạy…" dùng font của app (`--font-sans`), không dùng font của uPlot.
- Tài liệu: `docs/USER_GUIDE.md` (Bảng dưới: chú giải ở cột phải, rê chuột để đọc giá trị),
  `tests/e2e/README.md`, `docs/PROGRESS.md`.
- Khác kế hoạch mục (1) ("trừ chiều cao chú giải như XYChart"): làm đúng như vậy cùng trục gọn thì vùng
  vẽ chỉ khoảng 46–63 px (< 80), nên chú giải chuyển sang cột bên phải.
- Chạy: ESLint, typecheck, Prettier PASS; E2E `layout.spec.ts` (chromium) PASS.
