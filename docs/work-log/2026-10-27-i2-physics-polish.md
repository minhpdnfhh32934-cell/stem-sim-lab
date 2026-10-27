# i2-physics — Gợi ý 🟡 Vật lí của #70 (Sóng dừng, Chuyển động tròn đều, Điện trường)

- **Goal:** sửa các gợi ý 🟡 Vật lí gom trong issue #70 (bình luận "Gợi ý 🟡 còn lại…" và
  "Bổ sung từ duyệt cuối #89"; bản duyệt gốc ở PR #87, #89, #90). Chỉ sửa lỗi và đánh bóng, không
  đổi số liệu khoa học (hạn ngừng thêm tính năng 31/10).
- **Date/time:** 2026-10-27 16:29 SEAST (+0700)
- **Status:** PASS
- **Branch / base:** `feat/70-physics-polish` / `main` (32a9378)

## Acceptance criteria (oracle ngoài mã đang sửa)

1. Sóng dừng: nút "Dùng fₙ" chỉ đặt f trong [min, max] của chính `ParamDef` f (1–200 Hz); gợi ý
   ngoài khoảng → một câu vi/en, và khi không còn nút nào thì câu không mời bấm nút. Oracle:
   fₙ = n·v/(2L) tính tay trong test (L = 0,4 m, v = 100 m/s → 125, 250 Hz; L = 0,1 m → 500 Hz).
2. Tròn đều (a): "rev/s", "rev/min" hiện "vòng/s", "vòng/phút" khi giao diện tiếng Việt; kí hiệu
   SI và mọi chỗ gọi không có `locale` (prompt AI, KaTeX `\text{}`) giữ nguyên.
3. Tròn đều (b): đổi "Đề bài cho biết" trong phòng thí nghiệm giữ nguyên chuyển động. Oracle:
   r = 2 m, v = 3 m/s → ω = 1,5 rad/s, a_ht = v²/r = 4,5 m/s² ở cả bốn chế độ.
4. Tròn đều (c): T ngắn → tốc độ phát < 1, ít nhất 0,4 s màn hình mỗi vòng (ý của bản duyệt #87);
   T dài vẫn khoảng 4 s mỗi vòng.
5. Điện trường: lực dưới 1 µN hiện bằng N dạng lũy thừa 10 ("8,011·10⁻¹⁶ N") ở đáp số và bước lời
   giải như nhau; lời giải thích chép đáp số qua `unknownNumbers`.
6. Thẻ Khoa học #87: "φ, φ₀ tính bằng rad", "mũi tên chỉ hướng; độ dài không theo độ lớn",
   "sai lệch tương đối dưới 10⁻⁹"; dòng DATA_REVIEW UCM-6 (pending).
7. Mỗi test mới hỏng khi trả lại mã cũ.

## Files

- `src/physics/wave/scenes.ts` (+ test): `F_MIN`/`F_MAX` dùng chung cho thanh trượt f và `fixes`;
  `noResonance` nói câu "… nằm ngoài thanh trượt f (1–200 Hz) nên không có nút để đặt".
- `src/core/units.ts` (+ test): `unitLabel(symbol, locale?)`, bảng `VI_LABELS` chỉ có rev/s, rev/min.
- Gọi theo ngôn ngữ: `src/physics/common/tex.ts` (`fmtQty`), `src/app/sim/ParamsPanel.tsx`,
  `src/app/ai/ProblemDialog.tsx` (WrittenNote, ReviewRow), `src/ai/draft.ts` (thông báo notInText).
- `src/physics/circular/scenes.ts` (+ test): `autoDefaults` cho các đại lượng không phải đại lượng
  "đề cho" (còn mặc định) theo chuyển động; `suggestedSpeed`; câu chữ Thẻ.
- `src/physics/field/scenes.ts` (+ test): `forceUnit` → N dưới 1 µN; `src/physics/common/tex.ts`
  `fmtQty` viết |giá trị| < 10⁻³ (số mũ ≤ −4) dạng "a·10⁻ⁿ" như `texNum`.
- `docs/DATA_REVIEW.md` (UCM-6), `docs/PROGRESS.md` (một dòng).

## Key decisions

- Tròn đều (b): làm trong `autoDefaults` (không thêm API mới cho runtime). Chỉ ghi vào đại lượng
  còn nguồn `default`, đúng luật `applyAutoDefaults` (không bao giờ ghi đè số của đề/học sinh).
  Giới hạn: một đại lượng học sinh đã tự gõ ở chế độ trước giữ số của học sinh.
- Tròn đều (c): `suggestedSpeed` chỉ chạy khi mở bài (runtime `open`), không chạy lại khi kéo thanh
  trượt; không đổi runtime chung trước demo.
- KaTeX: `texQty` vẫn viết kí hiệu (luật "không chữ Việt trong `\text{}`"); không bài nào viết
  rev/min trong bước lời giải.
- `fmtQty` đổi cho mọi bài, nhưng chỉ với |giá trị| < 10⁻³ (số mũ ≤ −4) trong đơn vị hiển thị (ngưỡng của `texNum`).

## Commands run (real results, summary lines only)

- `npm run typecheck` (`tsc -b --noEmit`): lần đầu FAIL — `circular.test.ts` TS18048
  (`c.confidenceNote` có thể undefined; `npx tsc --noEmit -p .` không bắt được); sửa `?.` → PASS.
- `npm run lint`: PASS. `npm run format:check`: PASS.
- `npm test`: 320 tệp qua, 2 hỏng / 4395 test qua. Hai test hỏng không thuộc phần sửa:
  `tests/app.test.tsx` "Science Studio shows inside the lab…" (không tìm thấy tiêu đề sau 5,3 s) và
  `dogma3d/scene.perf.test.ts` (ngân sách thời gian CPU). Chạy riêng cùng `src/physics/circular`:
  3 tệp, 41 test qua → **chập chờn do máy tải** (bộ test đầy đủ chạy song song).
- E2E dưới khoá `.agent-logs/e2e.lock` (cổng 1420 trống trước khi chạy, khoá xoá khi xong):
  `npx playwright test tests/e2e/physics.spec.ts tests/e2e/layout.spec.ts tests/e2e/ai-flow.spec.ts
--project=chromium` → **39 passed (1,7 phút)** (physics 17, layout 1, ai-flow 21).

## Tests

| Test (mới)                                             | Tệp                         | Trên mã cũ                                                | Trên mã mới |
| ------------------------------------------------------ | --------------------------- | --------------------------------------------------------- | ----------- |
| "Dùng fₙ" never sets f outside its slider              | `wave/scenes.test.ts`       | FAIL (`[125, 250]`)                                       | PASS        |
| worded units follow the language                       | `core/units.test.ts`        | FAIL                                                      | PASS        |
| choosing another "Đề bài cho biết" keeps the motion    | `circular/circular.test.ts` | FAIL (v = 4 thay vì 3 ở chế độ T)                         | PASS        |
| fast turns play slower                                 | `circular/circular.test.ts` | FAIL                                                      | PASS        |
| turns per second / minute in Vietnamese (`fmtQty`)     | `circular/circular.test.ts` | FAIL                                                      | PASS        |
| card: φ in rad, arrows show direction only             | `circular/circular.test.ts` | FAIL                                                      | PASS        |
| a force below 1 µN in N as a power of ten, steps alike | `field/field.test.ts`       | FAIL (`'uN'`; với `fmtQty` cũ: `0,0000000000000008011 N`) | PASS        |

Lần đầu test "keeps the motion" dùng v = 4 m/s, r = 2 m: ω = 2 rad/s trùng giá trị mặc định nên
vẫn qua trên mã cũ; đổi sang v = 3 m/s (ω = 1,5 rad/s) thì hỏng đúng trên mã cũ.

## Next steps and limits

- Tròn đều (b): đại lượng học sinh đã tự gõ ở một chế độ trước (nguồn `user`) không bị ghi đè khi
  quay lại chế độ đó; muốn xử lí cần một móc trong `runtime.setParam` (đổi runtime chung — để sau).
  Giá trị theo chuyển động có thể nằm ngoài thanh trượt của đại lượng mới (ví dụ ω = 200 rad/s >
  30); ô số vẫn hiện đúng, chạm thanh trượt thì bị kẹp như mọi ô khác.
- Tròn đều (c): `suggestedSpeed` chỉ áp dụng khi mở bài; kéo thanh trượt tới ω lớn trong phòng thí
  nghiệm không tự đổi tốc độ phát (người học chọn 0,1×–0,25× ở thanh thời gian). Tốc độ chậm nhất
  là 0,1×, nên số gõ tay với ω > ~1900 rad/s vẫn có thể hiện sai tần số trên hình.
- Chưa làm (ngoài phạm vi danh sách giao): thông báo `badUnit` giải thích nhóm đơn vị, bí danh
  "vòng/giây", test DOPRI5 đo chu kì thật (#87 🟡 3), các gợi ý khác của #89 (cảnh báo dấu, đọc
  "7.10⁰").
- Chưa kiểm bằng mắt trong app thật (chỉ unit test + E2E mở từng bài).

## Vòng 2 — sửa theo bản duyệt #93 (2026-10-27 17:00 +0700)

- 🔴 Sóng dừng: `onSlider` dùng biên sai số làm tròn 1e-9 (như `isWhole`); nút kẹp f về [1, 200].
  Test L = 0,57 m, v = 22,8 m/s, f = 190 Hz: f₁₀ = 200,00000000000003 Hz giữ nút, đặt f = 200, n = 10.
- 🟡 `explain.ts`: dòng kết quả gửi AI viết như màn hình (`fmtQty('vi', …)`), không còn "9.437e-7".
  Test chép nguyên văn: trên mã cũ FAIL (`[9437]` là số lạ), mã mới PASS.
- 🟡 Ngưỡng lũy thừa đúng là |x| < 10⁻³ (số mũ ≤ −4): sửa chú thích, test, work-log.
- 🟡 Thẻ tiếng Anh: "the v and a_c (F_c) arrows" (khớp nhãn hình "ac, Fc"); câu "for them" khi hai cộng hưởng.
- Kiểm tra: typecheck, lint, format PASS; `npm test` 4399 qua, 1 hỏng `tests/app.test.tsx` (Science
  Studio, chập chờn do tải — chạy riêng PASS). E2E vòng 2: SKIPPED (hết lượt dùng; vòng 1 đã 39 passed).
