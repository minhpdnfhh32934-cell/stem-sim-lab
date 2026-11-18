# 255-sh11-reproduction — Đợt 2l: Sinh học 11 Chương 4–5; lớp 11 đủ bài

- **Goal:** đợt 2l, đợt cuối của kế hoạch lớp 11 (#255): Bài 24, 25, 27 (Chương 4) và Bài 28
  (Chương 5). Sau đợt này **Sinh học 11 có đủ 20/20 bài lí thuyết**, và cả lớp 11 đủ: Vật lí 20/20,
  Hóa học 19/19, Sinh học 20/20.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-sh11-reproduction`, tách từ `feat/255-sh11-growth` (đợt 2k).

## Files

- **Bốn bài học có hướng dẫn** (`src/studio/guided/lessons/`), lời văn của SimLab, không chứa chữ số:
  - `sh11b24Reproduction.ts` (Bài 24): dự đoán cây mọc từ lá thuốc bỏng; phân loại đặc điểm vô tính,
    hữu tính (Bảng 24.1); phân loại hình thức sinh sản ở động vật; xếp quá trình sinh sản ở người;
  - `sh11b25PlantReproduction.ts` (Bài 25): dự đoán cây từ cành chiết; xếp các bước in vitro; ghép
    phương pháp nhân giống; ghép bộ phận của hoa;
  - `sh11b27AnimalReproduction.ts` (Bài 27): dự đoán vì sao chỉ một tinh trùng thụ tinh; xếp các bước
    sinh sản ở người; phân loại cách đẻ; ghép hormone;
  - `sh11b28Integration.ts` (Bài 28): dự đoán hô hấp khi tuần hoàn kém; ghép các cặp quá trình ở thực
    vật và động vật.
- **Hai chương mới** "Sinh sản ở sinh vật" và "Cơ thể là một thể thống nhất", tên vi/en, hình kệ bài,
  xếp vào SH11 Bài 24, 25, 27, 28.
- **DATA_REVIEW:** SH11-GL-17 đến SH11-GL-20 (pending). E2E `sh11-guided.spec.ts` thêm bốn bài.

## Key decisions

- Bài 29 (ngành nghề) là bài loại "career", không phải bài lí thuyết, nên không có chủ đề.
- Câu dự đoán dùng ví dụ của chính sách (lá thuốc bỏng, cành bưởi chiết, phản ứng vỏ, tuần hoàn và hô
  hấp).

## Commands run (real results, summary lines only)

- `npx vitest run`: 5611 đạt, 3 bỏ qua (có sẵn).
- `npm run typecheck`: đạt. `npm run lint`: chỉ báo hai tệp cấu hình cục bộ của worktree.
- Đếm bài lớp 11 trong `data/curriculum_kntt.json`: VL11 20/20, HH11 19/19, SH11 20/20.
- E2E `sh11-guided`: 20/20 đạt; `learner`, `layout`: đạt trừ "touch screens" (lỗi chỉ có trong worktree). Lần chạy đầu, máy chủ dev phục vụ bản tên chủ đề cũ; đã khởi động lại và chạy lại.

## Next steps and limits

- Các bài Sinh học 11 có số liệu in trong sách (Bảng 8.1, chu kì tim, Bảng 13.2, đồ thị điện thế hoạt
  động) có thể thành mô hình tính toán ở bản sau.
- Ghi chú phát hành 0.10.0 khi tất cả PR lớp 11 đã vào `main`.
