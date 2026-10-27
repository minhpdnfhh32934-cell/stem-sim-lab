# i2-physics-ui — Nhóm P "Vật lí" của rà soát giao diện #70

- **Goal:** sửa các mục owner "P" trong `.agent-logs/ui-audit/confirmed.md` (UI-03, 04, 05, 06, 11,
  12, 13, 14, 15, 16, 23, 52, 54) và các mục nhóm S báo trong phần Vật lí (chữ "đ" trong KaTeX,
  `texNum` thiếu dấu phân cách nghìn, tiêu đề "8000 V/m"). Không đổi số liệu khoa học.
- **Date/time:** 2026-10-27 20:41 +0700
- **Status:** IN_PROGRESS
- **Branch / base:** `fix/70-physics-ui` / `main` (f5f0a35)

## Phần A — câu chữ (commit c1c72b1)

| Mục                    | Sửa                                                                                                           | Test (hỏng trên mã cũ)                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| UI-06                  | Thẻ "Chuyển động thẳng đều": "vận tốc không đổi (gia tốc bằng 0)"; DATA_REVIEW UIP-1                          | `linear.test.ts`                       |
| UI-11                  | Câu "Dự đoán trước" hỏi đúng điều nút trả lời (tăng / giảm / không đổi; "thay đổi thế nào")                   | `poe.test.ts`                          |
| UI-12                  | "t = 5 s", "v = √(F/μ)" dùng U+00A0                                                                           | `challenges.test.ts`                   |
| UI-52                  | Câu dự đoán và thử thách Điện trường nói "Tụ điện phẳng (SimLab chuyển sang…)"; "8.000 V/m"; UIP-2            | `poe.test.ts`, `challenges.test.ts`    |
| UI-14                  | Mọi đồ thị thời gian: "… theo thời gian" / "… vs time"                                                        | `registry.test.ts`                     |
| UI-16                  | Nhãn không lặp ký hiệu: "Khối lượng vật 1", "Điện tích thứ 1 (có dấu)", "Điện tích thử (đặt tại M)"           | `registry.test.ts`                     |
| UI-54 + cảnh báo KaTeX | Chỉ số tiếng Việt của ký hiệu SGK đặt trong `\text{}`: W_đ, F_đh, F_kéo, α_bđ, ω_bđ, α_nhỏ, h_đỉnh            | `registry.test.ts` (16 chỗ trên mã cũ) |
| UI-18 (phần Vật lí)    | `texNum` nhóm hàng nghìn ("35{.}950"); `allowedNumbers` đọc số trong bước giải bỏ ngoặc TeX ("9{,}81" = 9,81) | `tex.test.ts`, `explain.test.ts`       |

- E2E `ai-flow.spec.ts` tìm ô "Điện tích thứ 2 (có dấu)" (nhãn mới).
- "2 · 9.81 · 45" trong ảnh 0095: `texNum('vi', 9.81)` ghi `9{,}81` (test); dấu phẩy ở cỡ chữ nhỏ
  trong căn trông như dấu chấm. Không đổi mã.
- KaTeX: lí do chọn `\text{}` thay vì đổi ký hiệu không dấu — giữ đúng ký hiệu SGK (W_đ); chữ
  trong `\text{}` vẽ bằng font giao diện (`Equation.tsx`). Sửa ở vòng 2: "đ" không bị cảnh báo,
  nhưng "ỏ", "ỉ", "µ", "²" thì có, kể cả trong `\text{}`. CLAUDE.md ghi rõ luật.

### UI-13 (commit 4384b38)

- `SeriesDef.when` (src/physics/types.ts); `visibleSeries` + `columnsFor(scene, label, params)` trong
  `src/app/sim/data.ts`; `GraphPanel.tsx` lọc đường và tạo lại biểu đồ khi bộ đường đổi; 2 lời gọi
  trong `DataPanel.tsx`. Điều phối đồng ý sửa mấy dòng này trong src/app. Test `data.test.ts`
  (hỏng trên mã cũ: còn xB, vB, aB khi "1 vật").

### Kiểm tra phần A

- `npm run typecheck` PASS; `npm run lint` lần đầu FAIL (3 lỗi trong test mới: cộng chuỗi với số,
  điều kiện luôn sai) → sửa → PASS; `npm run format:check` PASS sau khi chạy Prettier cho work-log.
- `npm test`: 6 test hỏng khi chạy cả bộ (quá 15 s hoặc vượt ngân sách CPU: `numbers.test.ts`,
  `enzyme3d/scene.test.ts`, `Mendel3DView`, `tests/app.test.tsx`, `dogma3d`/`mutation3d`
  `scene.perf.test.ts`); chạy riêng 9 tệp, 85 test PASS → **chập chờn do máy tải**.
- E2E (khoá chung; lúc đầu phiên `bio-ui49` giữ khoá, đợi tới khi trả): physics + layout + ai-flow,
  project `chromium` → **39 passed (1,6 phút)**.

## Vòng 2 — sửa theo bản duyệt #97 (commit 07f7629)

- 🔴 `allowedNumbers` lỏng hơn main (đọc TeX như chữ tự do: "9{,}81" thành cả 981). Nay đọc bằng
  `texNumbers` (nghịch đảo đúng của `texNum`, một nghĩa mỗi số); tiếng Anh không nhóm hàng nghìn
  để "1{,}234" chỉ có một nghĩa. Test: 4000 giá trị đọc ngược đúng ở vi/en; các ca lọt của bản
  duyệt bị đánh dấu ở vi và en (trên mã #97 cũ: hỏng, "g = 981" lọt); lưới mọi bài × vi/en ×
  (×1, ×10, ×100, ×1000, ÷10, ÷100, ÷1000) — không số nào main từ chối mà mã mới nhận, trừ số bước
  giải thật sự in ra (oracle là `texNum`). Trên `explain.ts` cũ lưới bắt "98,1" (newtonLaws).
- KaTeX: test render thật mọi công thức (mọi bài, mọi lựa chọn, vi/en), hỏng khi có cảnh báo.
  Tìm thêm `\text{m/s²}`, `\text{µN}` (có từ trước): `texQty` viết ² và µ ngoài `\text{}`.
  `α_nhỏ` → `α_gđ`, `h_đỉnh 2` → `h₂` (UIP-3).
- 🟡: câu "Chạy để kiểm tra" / "Bắt đầu thử thách" (UIP-2); dòng phương pháp Thẻ thẳng đều; test
  GraphPanel (uPlot giả; trên GraphPanel của main: hỏng); chữ tiếng Anh UI-11, tên nút, "8.000 V/m".
- Kiểm tra: typecheck, lint, format PASS; `npm test` 4417 PASS (lần này không có test chập chờn);
  E2E physics + layout + ai-flow dưới khoá chung: 39 passed (1,5 phút).

## Vòng 3 — bản duyệt #97 vòng 2 (commit c1782af, sau merge origin/main db2abbb)

- 🟡1: `unknownNumbers` đọc trước TeX chép từ bước và số thập phân ≥ 4 chữ số sau dấu (`explanationTokens`); test dán nguyên TeX mọi bước mọi bài (vi/en) → [] (trên mã vòng 2 hỏng: "9{,}81" → [81]).
- 🟡2: thử thách Điện trường "khi bạn bắt đầu thử thách". 🟡4: oracle lưới so khớp trọn token (`texTokens`). 🟡3 (data.test.ts add/add với #98) để lúc gộp.
- Kiểm tra: typecheck, lint, format PASS; `npm test` 4432 PASS, 1 chập chờn (app.test Science Studio); E2E physics + ai-flow dưới khoá chung 38 passed.

## Phần B — hình trên sân khấu (nhánh `fix/70-physics-stage`, PR riêng, phụ thuộc #97)

- UI-03 (viền nền, chỉ số dưới, tên mũi tên sau đầu mũi tên, v_A/v_B, a cạnh v), UI-04, UI-05 (M sau mũi tên E), UI-15, UI-23 (`SeriesDef.dash`, Eₓ và y₂ nét đứt). Test `render/draw.test.ts` (8) và `GraphPanel.test.tsx`: hỏng trên mã cũ.
- Kiểm tra: typecheck, lint, format PASS; `npm test` 4425 PASS, 1 hỏng chập chờn (app.test Science Studio, chạy riêng PASS); E2E physics + layout + ai-flow (khoá chung) 39 passed; xem tận mắt trong app (dev server, chế độ tối): Newton, Bảo toàn cơ năng, Điện trường.
- Chưa làm: số trục bị đường sức cắt (lưới vẽ trong src/app), dời vị trí riêng từng bài (va chạm, con lắc đơn, Newton, mặt nghiêng), biểu đồ Hoá học của UI-23.
