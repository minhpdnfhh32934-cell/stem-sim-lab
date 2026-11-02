# 112 — Kiểm chéo DOPRI5 lệch ở 4 bài Vật lí

- **Goal:** tìm bên sai (công thức đóng hay DOPRI5) ở newtonLaws, inclinedPlane, hookeSpring,
  springPendulum; sửa tận gốc ở mã chung; test ở đúng các đầu vào của #112 + quét thanh trượt.
- **Date/time:** 2026-11-02, chiều, +07:00
- **Status:** PASS (chờ CI của PR)
- **Branch / base:** `fix/112-physics-checks` từ `origin/main` `cd6cdd6`

## Bằng chứng (lời giải số thứ ba)

- Mặt phẳng (mu 1,4; v0 16; length 12): DOPRI5 có giới hạn bước 0,01 s cho 1,1576768835 s = công thức
  đóng; DOPRI5 mặc định cho 1,6437 s (thời điểm dừng). Nghiệm là đa thức nên ước lượng sai số ≈ 0, một
  bước dài vượt qua điểm cuối rồi quay lại: hai đầu bước cùng dấu, sự kiện "tới cuối" bị bỏ qua.
- Lò xo (b 9,9 và b 6,3): DOPRI5 với atol 1e-60 cho 2,22701598593 s và 4,5139735792 s = công thức
  đóng; với atol 1e-14 (cũ) cho 1,841 s và 2,892 s: lần qua 0 thứ hai nhỏ hơn atol (biên độ giảm
  e^(−γT/2) ≈ e⁻³⁵ mỗi nửa chu kì).
- Khi thử atol rất nhỏ, DOPRI5 kẹt ở t = 0: bình phương tỉ số sai số tràn số (Infinity) nên bước đầu
  bằng 0.

## Sửa

- `src/core/ode/dopri5.ts`: dò dấu bên trong bước (8 điểm trên nội suy Hermite bậc ba của bước, xác
  nhận bằng bước lại chính xác; có lần cắt thì rút ngắn bước tới đó và làm lại); chặn bình phương tỉ
  số sai số ở 1e300.
- `src/physics/spring/scenes.ts` `numericPeriod`: chạy tới 1,25 T, atol theo bao C·e^(−γ·1,25T);
  trả null khi bao nhỏ hơn 1e-280 (vượt độ chính xác số thực; trên lưới thanh trượt 0,01 không gặp).
- Test: `ode.test.ts` (sự kiện bị cắt hai lần trong một bước), `incline.test.ts`, `spring.test.ts`
  (đầu vào của #112 + quét 600/400 điểm, dung sai 1e-8 không đổi), `src/physics/testing.ts`.
  Cả 9 test mới hỏng trên main, đạt sau khi sửa. Đáp số công thức không đổi → không tạo lại bộ đề
  chuẩn; thử thách và "Dự đoán trước" dùng `solve()` nên không đổi.

## Commands run (real results)

- `npm run lint`, `npm run typecheck`, `npm run format:check`: đạt.
- `npm test`: 338 tệp đạt, 1 bỏ qua; 4480 test đạt, 1 bỏ qua (có sẵn).
- `npx vitest run src/core src/physics src/learn src/app/sim tests/golden src/workers`: 377 đạt.
- E2E `tests/e2e/physics.spec.ts` (khoá chung): 17/17 đạt.
- Thời gian phép kiểm lò xo sát cản tới hạn: ≤ 42 ms (b = 6,32; 6,3238; 9,999).

## Sau duyệt khoa học (agent science-reviewer)

- Hai chẩn đoán được xác nhận đúng. Đã sửa: dò thêm tại điểm đổi chiều của nội suy Hermite (lần vượt
  rất hẹp, ví dụ chạm đỉnh 10 µm, nằm giữa hai mẫu đều); Thẻ Khoa học lò xo nói rõ khi chu kì không
  kiểm chứng được (PHC-1); test cho b 9,9986 (cần chặn tràn số), x0 = 0, k 97 / m 1,03 / b 19,99
  (không kiểm được), và lượt quét phải có hơn ¼ bộ số mang kiểm chứng.
- Kiểm: bỏ phần dò điểm đổi chiều thì 2 test mới hỏng; bỏ phần chặn tràn số thì test b 9,9986 hỏng.
- `npm test`: 4485 đạt, 1 bỏ qua; lint, typecheck, format đạt.
- Chưa làm (ngoài phạm vi): nhãn "khớp" của SolutionPanel và câu "mọi con số … được kiểm chứng" (do #110).

## Duyệt PR #118 vòng 1 (2 🔴, 4 🟡)

- 🔴1 chạm 1 ulp tính là cắt: lần cắt tìm thấy bên trong bước chỉ được nhận khi |g| > rtol·max(|a|,|b|)
  + atol. Test newtonLaws g 10 μ 0,2 F 0 v0 4 length 4 và inclinedPlane θ = 0 cùng số (bỏ ngưỡng thì 2/2 hỏng).
- 🔴2 + 🟡3 phép kiểm lò xo: thay cách theo dõi x (cần atol cực nhỏ, 30–1000 ms) bằng tích phân số dạng biên độ–pha
  (đổi biến chính xác x = r cos θ, x′ = −ω₀ r sin θ ⇒ θ′ = ω₀ − γ sin 2θ; x = 0 khi cos θ = 0). Không dùng ω_d,
  không tắt dần, ≤ 4 ms, không còn ca "không kiểm được": bỏ nhánh thẻ và PHC-1. Ca k 15 m 5 b 17,32 (T ≈ 474 s)
  và k 97 m 1,03 b 19,99 nay kiểm được và khớp. Phép chặn tràn số có test riêng trong ode.test.ts.
- 🟡3 dò bên trong bước chỉ chạy cho sự kiện khai báo `reads` (các sự kiện Vật lí kiểu điểm đều khai báo);
  sự kiện sóng dừng, thẩm thấu giữ như main. Bộ đệm cấp một lần. Sóng: 17,7 / 3,4 / 3,3 ms (main 39,5 / 16,4 / 7,6).
- 🟡4 `solution.engineNote` vi + en. 🟡5 issue tiếp nối #119.
- `npm test`: 4490 đạt, 1 bỏ qua; lint, typecheck đạt; format đạt trừ tệp lạ chưa theo dõi AGENTS.md (không đụng).
