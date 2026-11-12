# 205 C3 — Giảm chuyển động: bài mở ở trạng thái dừng

- **Goal:** phần C3 của #205: khi máy bật "giảm chuyển động", bài mở ở trạng thái dừng; nút Tạm
  dừng / Chạy vẫn ở chỗ cũ (D0); Thử thách và Dự đoán trước vẫn đọc `solve()` như cũ.
- **Date/time:** 2026-11-12, +07:00 (máy bàn)
- **Status:** PASS
- **Branch / base:** `feat/205-c3-reduced-motion`, từ `origin/main` (sau #212).
- **Quyết định của người dùng (qua laptop):** "Bật sẵn (Recommended)": bài tuần hoàn chạy liên
  tục; khi bật giảm chuyển động thì bài mở ở trạng thái dừng.

## Rà soát (bài nào tự chạy khi mở)

| Nhóm                                                                      | Trước C3                                               | Sau C3                                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Vật lí (mọi bài)                                                          | mở ở trạng thái dừng (`sim.open` đặt `playing: false`) | không đổi                                                                                                      |
| Sinh học 3D tự phát (Hardy–Weinberg, phiêu bạt, logistic, Lotka–Volterra) | `usePlayback` đã không tự phát khi giảm chuyển động    | không đổi; thêm test                                                                                           |
| Sinh học 3D khác, cơ chế phản ứng                                         | mở ở trạng thái dừng                                   | không đổi                                                                                                      |
| Hóa học: Maxwell–Boltzmann, thuyết va chạm, cân bằng hóa học              | **tự chạy khi mở, kể cả khi giảm chuyển động**         | giảm chuyển động: mở ở trạng thái dừng, cả khi mở lại sau khi đã chạy; đổi thông số lúc đang dừng thì vẫn dừng |

Không giảm chuyển động: không đổi gì (các bài hạt vẫn tự chạy khi mở, đổi thông số thì chạy lại).

## Đã làm

- `gasStore.ts`, `GasStage.tsx`: `running` lúc đầu và khi mở bài = `!prefersReducedMotion()`.
- `eqStore.ts`: `running` lúc đầu = `!prefersReducedMotion()`; `resetEq` khi giảm chuyển động giữ
  lựa chọn của người học (đang chạy thì chạy tiếp, đang dừng thì vẫn dừng).
- `EquilibriumViews.tsx`: mở lại bài khi giảm chuyển động thì dừng.
- `src/ui/three/testing.ts` `withReducedMotion`: trả lại `matchMedia` thật sự. Trong vitest,
  `window.matchMedia` là accessor, nên đặt lại descriptor vẫn giữ bản giả cho test sau.
- `EquilibriumViews.test.tsx`: bản giả `requestAnimationFrame` nay bỏ khung đã huỷ, như trình duyệt.

## Tests

- `GasStage.test.tsx` (mới): mở bài thì chạy như cũ; giảm chuyển động thì dừng dù trước đó đang
  chạy. Với mã cũ: 1 FAIL; sau khi sửa: PASS.
- `EquilibriumViews.test.tsx`: giảm chuyển động → mở ở trạng thái dừng, khung hình không làm thời
  gian tăng, đổi T vẫn dừng, bấm **Chạy** thì chạy, đổi T lúc đang chạy thì chạy tiếp; không giảm
  chuyển động thì đổi thông số vẫn chạy lại như cũ. Với mã cũ: 1 FAIL; sau khi sửa: PASS.
- `playback.test.ts` (mới): `autoplay` phát khi mở; giảm chuyển động thì dừng, bấm vẫn phát. PASS.
- E2E `reduced-motion.spec.ts` (mới, `reducedMotion: 'reduce'`): sóng dừng, Maxwell–Boltzmann, cân
  bằng hóa học mở với nút **Chạy**, thời gian đứng yên 1 s, bấm **Chạy** thì thời gian tăng; không
  giảm chuyển động thì Maxwell–Boltzmann vẫn tự chạy. Với mã cũ: 2 FAIL (hai bài Hóa); sau khi sửa:
  4 PASS.
- Ảnh trước/sau: `docs/images/205/c3-reduced-motion.jpg` (1366×768, 100 %/140 %, sáng/tối).

## Next steps and limits

- Thấy khi chụp ảnh (có sẵn ở `main`, ngoài phạm vi C3): ở cỡ chữ 140 %, nhãn D0 "Tạm dừng" của
  bài Maxwell–Boltzmann xuống hai dòng. Đã báo laptop.
- Tiếp theo: C2 (độ trôi năng lượng RK4 trên Thẻ Khoa học), C5 (Sinh học).
