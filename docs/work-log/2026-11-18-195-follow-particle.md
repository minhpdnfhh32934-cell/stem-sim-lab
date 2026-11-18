# 195-follow-particle — "Theo dõi một hạt" trong hộp khí (#195 bước 6)

- **Goal:** #195 bước 6 (kế hoạch 18/11/2026): hộp khí có nút bật/tắt tô một hạt kèm đường đi gần đây.
- **Date/time:** 2026-11-18 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/195-follow-particle`, tách từ `main`.

## Đã làm

- `gasStore.ts`: `follow` (không lưu), `FOLLOWED` (hạt số 0), `TRAIL_TAU` = 12 τ (khoảng 2 giây trên
  màn hình, vì hộp khí chạy 6 τ mỗi giây; tính theo thời gian mô hình nên Tạm dừng không làm mất
  đường), `recordTrail()` ghi đúng `x`, `y`, `time` của mô hình; Làm lại xóa đường.
- `GasStage.tsx`: nút **Theo dõi một hạt** (Crosshair, `aria-pressed`) cạnh Chạy / Làm lại; hạt và
  đường vẽ bằng màu chữ `--text`, đường mờ dần về phía cũ; nhãn "Một hạt của mô hình và đường nó vừa
  đi (đơn vị rút gọn, minh họa)". Khung vẽ vẽ lại khi bật/tắt (kể cả lúc dừng hoặc giảm chuyển động).
- **Đổi so với kế hoạch:** kế hoạch ghi màu `--stage-accent`. Ảnh chụp cho thấy hạt xanh lẫn vào các
  hạt xanh của Maxwell–Boltzmann, còn bài va chạm dùng đủ 4 màu hạt (A, B, C, D) cho dữ liệu, nên hạt
  theo dõi dùng màu chữ trung tính.
- `docs/DATA_REVIEW.md` dòng `GAS-FLW-1` (câu chữ, `pending`), `docs/USER_GUIDE.md`.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/particles`: 8 tệp, 33 test đạt (test mới: mỗi điểm của đường bằng đúng
  vị trí mô hình lúc đó, chỉ giữ 12 τ, Làm lại xóa đường; nút bật/tắt, `aria-pressed`, nhãn hiện/ẩn).
- `npx tsc -b --noEmit`: đạt.
- E2E `tests/e2e/follow-particle.spec.ts` (chromium, 1366×768): 1 đạt (nút bật, nhãn hiện, đường dài
  dần theo mô hình, nút cao bằng nút Làm lại, tắt thì nhãn mất). Ảnh chụp kiểm bằng mắt.

## Next steps and limits

- Có sẵn từ trước, chưa sửa: khi bật giảm chuyển động, khung hộp khí chỉ vẽ một lần (`useCanvas`
  không chạy vòng vẽ), nên bấm Chạy thì số liệu vẫn chạy nhưng hình đứng yên.
- Bước 7 của #195: kiểm axe.
