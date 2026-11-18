# 255-hh12-ester-carbohydrate — Đợt 4a: Hóa học 12 Chương 1–2, ester, lipid, carbohydrate

- **Goal:** đợt 4a, đợt đầu của Hóa học 12 (#255). Chương 1–2 có 5 bài lí thuyết chưa có chủ đề:
  HH12 Bài 1, 2, 4, 5, 6.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh12-ester-carbohydrate`, tách từ `feat/255-vl12-nuclear` (đợt 3d).

## Files

- **Dữ liệu mới:** `scripts/data/gen_esters_kntt.py` → `data/esters_kntt.json`. Gồm:
  - bốn acid béo (tr. 10);
  - Hình 1.2;
  - bảng nhiệt độ sôi tr. 7;
  - câu 7 tr. 9.
- **Chủ đề mới "Ester và chất béo"** (`src/chemistry/ester/`, HH12 Bài 1), ba phần:
  - **Tên gọi, đồng phân:**
    - chọn gốc acid và gốc alcohol; xem công thức, tên (gốc R′ + gốc acid), M và hình cấu tạo do
      RDKit vẽ;
    - liệt kê mọi ester no, đơn chức, mạch hở của CnH2nO2 với n = 2…5 (1, 2, 4, 9 chất).
  - **Phản ứng của ester:** thủy phân trong acid và base, ester hóa, hiệu suất câu 7 tr. 9 (khoảng
    63,1 %).
  - **Chất béo:**
    - Hình 1.2;
    - chọn ba acid béo, xem công thức, M, số liên kết C=C;
    - NaOH, glycerol, xà phòng khi xà phòng hóa; H₂ để hydrogen hóa;
    - hình cấu tạo có liên kết đôi cis đúng như sách.
- **Bốn bài học có hướng dẫn:** Bài 2 (xà phòng và chất giặt rửa), Bài 4 (glucose, fructose), Bài 5
  (saccharose, maltose), Bài 6 (tinh bột, cellulose).
- **Tách phần dùng chung:**
  - `src/chemistry/molecule/SmilesPicture.tsx`: hình cấu tạo từ SMILES, dùng cho bài Hóa 11 và bài
    ester.
  - `ModuleControls` chuyển từ `src/physics/common/` sang `src/ui/`, vì môn Hóa cũng dùng.
- **Chương mới** "Ester – Lipid" và "Carbohydrate"; tên bài vi/en, hình kệ bài, E2E
  `ester-hh12.spec.ts`, danh sách bài trong `chemistry.spec.ts`; `project.spec.ts` có 32 chủ đề Hóa
  học.
- **DATA_REVIEW:** HH12-EST-1, HH12-EST-2, HH12-GL-1…4 (pending).

## Key decisions

- **Nguyên tử khối:** sách Hóa học 12 không in bảng nguyên tử khối; sách 11 chỉ cho C, H, O. Vì vậy
  khối lượng mol dùng nguyên tử khối chuẩn trong `data/elements.json` cho mọi nguyên tố (cần Na cho xà
  phòng). Thẻ Khoa học ghi rõ.
- **Chọn cách làm từng bài:** carbohydrate (Bài 4–6) chủ yếu là mô tả, thuốc thử và hiện tượng, nên
  làm bài học có hướng dẫn. Ester (Bài 1) có tính toán (đồng phân, hiệu suất, xà phòng hóa) nên làm
  mô-đun.
- **Cách viết gốc acid:** viết hướng về chỗ nối (CH₃CH₂CH₂COO…, (CH₃)₂CHCOO…).
- **RDKit trong worktree:**
  - Lỗi "unknown SMILES" khi chạy E2E trong worktree có nguyên nhân: Vite phục vụ tệp `.wasm` qua
    đường `/@fs/` bằng trang HTML.
  - Cấu hình cục bộ `resolve.preserveSymlinks` (không commit) sửa được; hình kệ bài ester được tạo
    lại có hình cấu tạo thật.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/ester`: 8/8 đạt.
- `npx vitest run src/studio src/chemistry src/app/learner src/app/curriculum.test.ts src/ui`: đạt.
- `npx vitest run`: 478 tệp; lần đầu 1 lỗi ở `typeScale.test.ts` (cỡ chữ 0,8rem dưới mức tối thiểu
  12px của chữ SMILES thay thế). Đã đổi sang token `--text-xs`; chạy lại `src/app/theme` thì 56/56
  đạt.
- `npm run typecheck`: đạt.
- `npm run lint`, `npm run format:check`: đạt với các tệp của dự án. Chỉ báo hai tệp cấu hình riêng
  của worktree; hai tệp này không commit.
- **E2E (chromium):** chemistry, project, organic-hh11, ester-hh12, studio, learner, thermal-vl12,
  gas-vl12, magnetism-vl12, nuclear-vl12: 30 đạt, 1 lỗi. Lỗi là learner "touch screens", lỗi đã biết,
  chỉ xảy ra trong worktree. Các bài cần RDKit nay đạt cả trong worktree.
- **E2E `ester-hh12.spec.ts`:** 1/1 đạt (ethyl acetate, 4 và 9 đồng phân, 63,0x %, C₅₇H₁₁₀O₆, C₅₇H₉₈O₆).
- **Xem trên giao diện (1366×768):** ba phần đọc được, hình trilinolein có liên kết đôi cis.

## Next steps and limits

- Đợt 4b: Hóa học 12 Chương 3–4 (amine, amino acid, protein, polymer).
- Chưa có tính toán cho carbohydrate (lên men, thủy phân tinh bột) vì sách không có ví dụ bằng số ở
  Bài 4–6.
