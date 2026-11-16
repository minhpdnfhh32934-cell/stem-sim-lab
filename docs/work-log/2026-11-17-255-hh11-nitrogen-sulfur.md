# 255-hh11-nitrogen-sulfur — Đợt 2d: Hóa học 11 Chương 2, nitrogen – sulfur

- **Goal:** đợt 2d của kế hoạch lớp 11 (#255). HH11 Bài 4 (Nitrogen), 5 (Ammonia • Muối ammonium), 6 (Một
  số hợp chất của nitrogen với oxygen), 7 (Sulfur và sulfur dioxide), 8 (Sulfuric acid và muối sulfate)
  chưa có chủ đề.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh11-nitrogen-sulfur`, tách từ `feat/255-hh11-acid-base` (đợt 2c).

## Files

- **Dữ liệu mới:** `scripts/data/gen_nitrogen_sulfur_kntt.py` → `data/nitrogen_sulfur_kntt.json`, đọc từ
  SGK tr. 29–54:
  - 8 thẻ chất (N₂, NH₃, ion NH₄⁺, NOₓ, HNO₃, S, SO₂, H₂SO₄); mỗi ý là lời viết lại ngắn của câu trong sách,
    số giữ nguyên, có trang;
  - hai trục số oxi hóa (N −3 … +5 theo tr. 30, S −2 … +6 theo tr. 43) với danh sách chất của hoạt động
    trong sách;
  - 16 phản ứng của sách, có điều kiện và ΔᵣH° in trong sách.
- **Chủ đề mới "Nitrogen và sulfur"** (`src/chemistry/nitrogenSulfur/`), xếp HH11 Bài 4–8:
  - trục số oxi hóa: SimLab tự tính số oxi hóa từ công thức, không lưu sẵn;
  - vai trò khử, oxi hóa đọc từ vị trí trên trục;
  - học sinh tự đặt thêm chất lên trục; chất không xác định được thì có lời giải thích;
  - thẻ chất có trang sách;
  - bảng phản ứng ghi chất khử, chất oxi hóa và số oxi hóa thay đổi, đúng các câu hỏi trong sách (tr. 31,
    35, 45, 46).
- **Dùng chung:** lời giải thích "vì sao không xác định" chuyển sang `src/chemistry/redox/refusal.ts`, dùng
  cho cả bài Phản ứng oxi hóa – khử.
- **Chương mới "Nitrogen – sulfur"**, tên bài vi/en, hình kệ bài, E2E `nitrogen-sulfur-hh11.spec.ts`,
  danh sách bài trong `chemistry.spec.ts`.
- **DATA_REVIEW:** HH11-NS-1, HH11-NS-2 (pending).

## Key decisions

- **Không lưu số oxi hóa:** sách bắt học sinh tự xếp chất lên trục, nên app tính bằng quy tắc của HH10
  Bài 15. Thử trên dữ liệu: 17/17 chất của sách đặt đúng chỗ, 16 phản ứng phân tích đúng.
- **NH₄NO₃** (N ở −3 và +5) được ghi là chưa xác định, không đoán.
- **Một chủ đề cho cả chương:** mỗi tên bài 4–8 nêu đúng các chất mà bài có thẻ chất, nên được xếp theo
  quy tắc ngày 22/10.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/nitrogenSulfur src/chemistry/redox`: 41/41 đạt.
- Toàn bộ unit, typecheck, lint, prettier, E2E (`chemistry`, `nitrogen-sulfur-hh11`, `aqueous-hh11`): xem
  PR.
- **Xem trên giao diện (hình kệ bài):** hai đầu trục ban đầu đè lên số; đã hạ thấp chữ hai đầu.

## Next steps and limits

- Chưa có quy trình tiếp xúc sản xuất sulfuric acid và tính oxi hóa của H₂SO₄ đặc (tr. 51–53).
