# 255-hh11-hydrocarbons — Đợt 2f: Hóa học 11 Chương 4, hydrocarbon

- **Goal:** đợt 2f của kế hoạch lớp 11 (#255). HH11 Bài 15, 16, 17 chưa có chủ đề.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh11-hydrocarbons`, tách từ `feat/255-hh11-organic-basics` (đợt 2e).

## Files

- **Dữ liệu mới:** `scripts/data/gen_hydrocarbons_kntt.py` → `data/hydrocarbons_kntt.json`. Mọi số
  đều lấy từ SGK:
  - công thức chung và n nhỏ nhất của bốn dãy (tr. 82, 92, 102);
  - Bảng 15.2, 16.2, 17.1: nhiệt độ nóng chảy, nhiệt độ sôi, khối lượng riêng ở 20 °C của 29 chất;
  - hình dạng phân tử (góc liên kết, độ dài liên kết như sách in);
  - 18 phản ứng in trong sách, kèm điều kiện; ΔᵣH° của methane (−890 kJ) và propane (−2 216 kJ).
- **Chủ đề mới "Alkane, alkene, alkyne, arene"** (`src/chemistry/hydrocarbons/`), xếp HH11 Bài 15,
  16, 17:
  - chọn dãy đồng đẳng và số nguyên tử C (n từ n nhỏ nhất đến 10);
  - bảng bên phải: công thức phân tử, phân tử khối (C 12, H 1), số H, phương trình đốt cháy hoàn
    toàn;
  - đồ thị nhiệt độ sôi và nóng chảy theo số C; chất mạch không nhánh nối thành đường, đồng phân và
    chất có nhánh là chấm rỗng;
  - phía dưới: bảng tính chất vật lí và bảng phản ứng của sách cho dãy đang chọn.
- **Chương mới "Hydrocarbon"**, tên bài vi/en, hình kệ bài, E2E `hydrocarbons-hh11.spec.ts`, danh
  sách bài trong `chemistry.spec.ts`.
- **DATA_REVIEW:** HH11-HC-1, HH11-HC-2 (pending).

## Key decisions

- **Phương trình đốt cháy** viết từ công thức chung CnHm + (n + m/4) O₂ → n CO₂ + (m/2) H₂O, nhân 2
  khi hệ số O₂ không nguyên (ví dụ 2C₂H₆ + 7O₂, 2C₆H₆ + 15O₂), như phân số của sách. Test kiểm lại
  mọi dãy, mọi n từ n nhỏ nhất đến 10 bằng bộ cân bằng chính xác của app.
- **Styrene và naphthalene** có trong Bảng 17.1 nhưng không thuộc dãy CnH2n−6: dữ liệu ghi
  `in_series = false`, đồ thị vẽ chấm rỗng, không tính công thức từ dãy cho chúng.
- **Số liệu giữ đúng như sách in**, kể cả chỗ lạ (ethyne: nhiệt độ nóng chảy −81 °C cao hơn nhiệt độ
  sôi −83 °C); ghi chú trong DATA_REVIEW để giáo viên xem.
- Các phản ứng thế, cộng, trùng hợp… chỉ là phương trình của sách; app không mô phỏng cơ chế.

## Commands run (real results, summary lines only)

- `npx vitest run`: 5585 đạt, 3 bỏ qua (có sẵn).
- `npm run typecheck`: đạt. `npm run lint` và `npx prettier --check .`: chỉ báo hai tệp cấu hình cục
  bộ của worktree (`vite.local.config.ts`, `playwright.local.config.ts`), không commit.
- E2E (`hydrocarbons-hh11`, `chemistry`, `layout`): 22 đạt, 1 hỏng là "unknown SMILES" — lỗi đã biết
  chỉ có trong worktree (RDKit wasm không tải), đạt trên CI.
- **Xem trên giao diện** (1366×768): propane cho C₃H₈ + 5O₂ → 3CO₂ + 4H₂O, phân tử khối 44; benzene
  cho 2C₆H₆ + 15O₂ → 12CO₂ + 6H₂O, phân tử khối 78; bảng có benzene sôi ở 80,1 °C; không cuộn ngang.

## Next steps and limits

- Chưa có dẫn xuất halogen, alcohol, phenol, hợp chất carbonyl, carboxylic acid (Bài 19–24, đợt 2g).
- Đồ thị chỉ lấy số liệu của sách đến C10; không ngoại suy.
