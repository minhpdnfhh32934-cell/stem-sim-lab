# 255-hh12-nitrogen-polymer — Đợt 4b: Hóa học 12 Chương 3–4, amine, amino acid, protein, polymer

- **Goal:** đợt 4b của Hóa học 12 (#255). Chương 3–4 có 5 bài lí thuyết chưa có chủ đề: HH12 Bài
  8, 9, 10, 12, 13.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh12-nitrogen-polymer`, tách từ `feat/255-hh12-ester-carbohydrate`
  (đợt 4a).

## Files

- **Dữ liệu mới:** `scripts/data/gen_nitrogen_organic_kntt.py` → `data/nitrogen_organic_kntt.json`.
  Gồm:
  - Bảng 8.1 (nhiệt độ nóng chảy, nhiệt độ sôi của bảy amine);
  - Bảng 9.1 (cấu tạo và tên của năm amino acid);
  - glycine ở pH khoảng 6 (tr. 43);
  - các peptide sách nêu: Val-Gly-Ala, Gly-Ala-Val, Gly-Tyr-Val-Ala.
- **Chủ đề mới "Amine"** (`src/chemistry/amine/`, HH12 Bài 8), hai phần:
  - **Tên gọi, đồng phân:** chọn số nguyên tử C (CH₅N … C₄H₁₁N); liệt kê mọi amine no, đơn chức,
    mạch hở (1, 2, 4, 8 chất), mỗi chất có hình cấu tạo, bậc, tên gốc – chức, tên thay thế, M.
  - **Tính chất:** biểu đồ nhiệt độ sôi theo Bảng 8.1, bốn phương trình trong sách, các hiện tượng
    (quỳ tím, Cu(OH)₂, nitrous acid, nước bromine).
- **Chủ đề mới "Amino acid và peptide"** (HH12 Bài 9), hai phần:
  - **Amino acid:** Bảng 9.1, hình cấu tạo; dải điện di của glycine đổi chiều theo pH.
  - **Peptide:** ghép mạch từ năm amino acid (và Tyr như ví dụ của sách); tên viết tắt, loại, số liên
    kết peptide, phản ứng màu biuret, công thức phân tử, M; các peptide nhỏ hơn khi thủy phân không
    hoàn toàn.
- **Ba bài học có hướng dẫn:** Bài 10 (protein và enzyme), Bài 12 (đại cương về polymer), Bài 13
  (vật liệu polymer).
- **Chương mới** "Hợp chất chứa nitrogen" và "Polymer"; tên bài vi/en, hình kệ bài, E2E
  `amine-hh12.spec.ts`, danh sách bài trong `chemistry.spec.ts`; `project.spec.ts` có 34 chủ đề Hóa
  học.
- **DATA_REVIEW:** HH12-NIT-1, HH12-NIT-2, HH12-GL-5…7 (pending).

## Key decisions

- **Tyr:** sách nêu Gly-Tyr-Val-Ala nhưng không in cấu tạo của tyrosine. App vẫn cho ghép Tyr để
  đếm liên kết peptide và tìm các đoạn khi thủy phân, nhưng không vẽ và không tính công thức, M.
- **Chọn cách làm từng bài:** Bài 8, 9 có quy tắc tính được (đồng phân, tên, số liên kết peptide,
  công thức) nên làm mô-đun; Bài 10, 12, 13 chủ yếu là mô tả nên làm bài học có hướng dẫn.
- **Glycine:** app chỉ nói chiều di chuyển (cực âm, đứng yên, cực dương) quanh pH 6 như sách, không
  tính điểm đẳng điện.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/amine`: 8/8 đạt.
- `npx vitest run`: 477 tệp đạt, 2 bỏ qua (có sẵn); 5686 bài kiểm tra đạt.
- `npx tsc -b --noEmit`: đạt.
- `npm run lint`, `npm run format:check`: đạt với các tệp của dự án; chỉ báo hai tệp cấu hình riêng
  của worktree (không commit).
- **E2E (chromium):** chemistry, project, amine-hh12, ester-hh12, organic-hh11, studio, learner: 26
  đạt, 1 lỗi. Lỗi là learner "touch screens", lỗi đã biết, chỉ xảy ra trong worktree.
- **E2E `amine-hh12.spec.ts`:** 2/2 đạt (4 và 8 đồng phân, propylamine / propan-1-amine, Bảng 8.1;
  glycine ở pH 2 về cực âm, Val-Gly-Ala C₁₀H₁₉N₃O₄, biuret).
- **Xem trên giao diện (1366×768):** sửa hai chỗ sau khi xem ảnh: nhãn nhiệt độ sôi âm của
  methylamine đè lên tên chất; công thức cấu tạo amino acid chưa có chỉ số dưới.

## Next steps and limits

- Đợt 4c: Hóa học 12 Bài 15, 16 (pin điện, điện phân).
- Chưa có bài tính lượng chất cho protein, polymer vì sách chủ yếu mô tả.
