# 119 — Một quy tắc "khớp" cho bảng Lời giải và test

- **Goal:** chữ "khớp" trong Lời giải có một nghĩa: kiểm chéo độc lập nằm trong đúng dung sai mà test
  dùng. Không nới `CHECK_TOL`.
- **Date/time:** 2026-11-11, sáng, +07:00 (máy bàn)
- **Branch / base:** `fix/119-one-match-rule` từ `origin/main` `aadc36a`

## Quy tắc

- `src/physics/tolerance.ts` `compareCheck(value, check, tol = CHECK_TOL)`: khớp khi
  |check − value| ≤ max(tol·|value|, `CHECK_FLOOR`), với `CHECK_TOL` = 1e-8 và `CHECK_FLOOR` = 1e-12 SI.
  NaN không bao giờ khớp. Khi sàn tuyệt đối quyết định (đáp số gần 0), độ lệch hiện tuyệt đối kèm đơn vị.
- Chặt hơn cả hai quy tắc cũ: test cũ cho 1e-8·max(1, |v|) (tuyệt đối 1e-8 khi |v| < 1), bảng cũ cho 1 %.
- `Answer.checkTol`: chỉ chu kì / tần số phách dùng (`BEAT_CHECK_TOL` 3e-3 = mức test sẵn có của #105
  chứng minh trên thanh trượt f₂; Thẻ khoa học ghi lí do).

## Quét (300 bộ thông số mỗi bài, seed 119)

Trước khi sửa, ba chỗ không đạt 1e-8:

- Phách (đo trên điểm lấy mẫu, ≤ 8·10⁻⁴): khai `checkTol`.
- Kepler `sliceArea` (≤ 3·10⁻⁶, 273/300): đa giác nội tiếp lệch theo 1/n². Sửa: Richardson
  (4·A(n) − A(n/2))/3. Test Kepler siết từ 1e-5 xuống 1e-9.
- Dao động cưỡng bức `A` (39/300, tệ nhất 10 %; một ca dựng tay lệch 1257 % với mã cũ): `settleTime`
  dùng γ cả khi cản quá lớn (mode chậm tắt theo ω₀²/(γ + √(γ² − ω₀²))), và khi Ω ≪ ω₀ hoặc x₀ ≫ A phần
  riêng còn thấy được trong x² + (v/Ω)². Sửa: thời gian tắt theo mode chậm, tích phân từng đoạn tới khi
  số đo đổi ≤ 1e-10. Không ca nào mất kiểm chéo (0 null trên quét).

Sau khi sửa: mọi bài đạt quy tắc chặt; test `tolerance.test.ts` giữ lượt quét này.

## Lộ ra khi chạy E2E

- Câu `engineNote` dài hơn làm bảng Lời giải của bài "Chuyển động thẳng biến đổi đều" vượt chiều cao sổ
  ghi bên Bàn thí nghiệm. Test UI-09 (`tests/e2e/bench/layout.spec.ts`) khi đó đòi dấu "còn nữa bên
  dưới", nhưng `Notebook.tsx` chưa bao giờ gắn `useScrollCue` (chỉ `BottomPanel` cũ có). Sửa: gắn
  `useScrollCue` + `.scroll-cue` cho khung cuộn của sổ ghi, như khung dưới cũ.

## Test

- `tolerance.test.ts` (quy tắc + quét mọi bài), `SolutionPanel.test.tsx` (giữ các ca #110/#112; thêm
  đáp số 0 với kiểm chéo 1e-15 → "khớp, sai lệch 1·10⁻¹⁵ m/s"; lệch 1e-6 → "chưa khớp"),
  `resonance.test.ts` (hai ca trên; cả hai hỏng với mã cũ), `kepler.test.ts` (siết).
