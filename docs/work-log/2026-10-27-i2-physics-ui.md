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
  trong `\text{}` vẽ bằng font giao diện (`Equation.tsx`), không cảnh báo. CLAUDE.md ghi rõ luật.
