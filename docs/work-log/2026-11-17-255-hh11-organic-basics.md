# 255-hh11-organic-basics — Đợt 2e: Hóa học 11 Chương 3, đại cương về hóa học hữu cơ

- **Goal:** đợt 2e của kế hoạch lớp 11 (#255). HH11 Bài 10, 11, 12, 13 chưa có chủ đề.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh11-organic-basics`, tách từ `feat/255-hh11-nitrogen-sulfur` (đợt 2d).

## Files

- **Dữ liệu mới:** `scripts/data/gen_organic_basics_kntt.py` → `data/organic_basics_kntt.json`. Mọi số
  đều lấy từ SGK:
  - Bảng 10.1 nhóm chức, Bảng 10.2 số sóng IR;
  - nguyên tử khối dùng để lập tỉ lệ (tr. 72);
  - camphor (tr. 73, hoạt động) và eugenol (tr. 73, câu hỏi 3);
  - nhiệt độ sôi (tr. 75), các ví dụ đồng phân (tr. 76–77).
- **Chủ đề mới "Nhóm chức, công thức phân tử, đồng phân"** (`src/chemistry/organic/`), ba phần, xếp
  HH11 Bài 10, 12, 13:
  - **Nhóm chức:** chọn nhóm chức, xem vùng số sóng trên trục 4 000 → 500 cm⁻¹ như phổ in trong sách.
  - **Lập công thức:** nhập %C, %H, %O (một nguyên tố là "còn lại") và M; các bước giống sách:
    x : y : z, chia số nhỏ nhất, nhân để thành số nguyên, công thức đơn giản nhất, n, công thức phân tử.
  - **Đồng phân:** các nhóm đồng phân của sách (C₃H₆O, C₅H₁₂, C₃H₈O), hình do RDKit vẽ, bảng nhiệt độ
    sôi.
- **Bài học có hướng dẫn "Tách biệt và tinh chế hợp chất hữu cơ"** (Bài 11), bài đầu tiên của môn Hóa
  học:
  - dự đoán độ cồn khi chưng cất rượu;
  - ghép phương pháp với nguyên tắc;
  - xếp bốn bước kết tinh;
  - ghép các ví dụ trong sách với phương pháp.
- **Chương mới "Đại cương về hóa học hữu cơ"**, tên bài vi/en, hình kệ bài, E2E `organic-hh11.spec.ts`,
  danh sách bài trong `chemistry.spec.ts`.
- **DATA_REVIEW:** HH11-ORG-1, HH11-ORG-2, HH11-GL-1 (pending).

## Key decisions

- **Không làm tròn ép:**
  - Tỉ lệ coi là nguyên khi lệch số nguyên không quá 0,06 (phần trăm trong đề đã làm tròn).
  - M phải bằng n·M(CpHqOr) trong khoảng 0,5; nếu không, app báo cần kiểm tra lại, không tự sửa.
- **Kiểm chứng:**
  - Tính ngược phần trăm khối lượng từ công thức tìm được.
  - Mỗi nhóm đồng phân của sách có cùng công thức phân tử, đếm nguyên tử từ cấu tạo.
- **Hình RDKit hiện như ảnh** (`img` với dữ liệu SVG), giống bài Phân tử 3D, không chèn HTML.
- **Test bài có hướng dẫn** trước đây viết cứng "8 bài Sinh học". Nay đếm theo từng môn: 8 Sinh, 1 Hóa.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/organic src/studio`: 9/9 và 188/188 đạt.
- Toàn bộ unit, typecheck, lint, E2E: xem PR.
- **Xem trên giao diện** (1366×768):
  - Phần Lập công thức với eugenol cho C₅H₆O, n = 2, C₁₀H₁₂O₂.
  - Ô "còn lại" ban đầu hiện "NaN"; đã sửa để hiện phần còn lại của 100 %.
  - RDKit không tải được trong worktree (lỗi đã biết về kiểu tệp wasm), nên hình đồng phân hiện chữ
    SMILES thay thế; đã sửa màu chữ thay thế cho đọc được ở giao diện tối.
  - Bài có hướng dẫn mở đúng bước Dự đoán.

## Next steps and limits

- Phổ khối lượng chỉ dùng giá trị m/z của [M⁺]; chưa vẽ phổ.
- Chưa có phản ứng của từng loại hợp chất (các bài 15–24, đợt 2f).
