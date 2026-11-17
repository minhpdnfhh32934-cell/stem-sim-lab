# 255-hh12-electrochemistry — Đợt 4c: Hóa học 12 Chương 5, pin điện và điện phân

- **Goal:** đợt 4c của Hóa học 12 (#255). Chương 5 có 2 bài lí thuyết chưa có chủ đề: HH12 Bài 15, 16.
- **Date/time:** 2026-11-17 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/255-hh12-electrochemistry`, tách từ `feat/255-hh12-nitrogen-polymer`
  (đợt 4b).

## Files

- **Dữ liệu mới:** `scripts/data/gen_electrochem_kntt.py` → `data/electrochem_kntt.json`. Gồm:
  - Bảng 15.1: 24 bán phản ứng, thế điện cực chuẩn, số chữ số thập phân như sách in;
  - hai pin sách tính: Zn – Cu 1,102 V (tr. 74), Cu – Ag 0,459 V (tr. 75);
  - các kim loại tác dụng với nước (Bài 24 tr. 110, Bảng 25.3 tr. 119).
- **Chủ đề mới "Thế điện cực và nguồn điện hóa học"** (`src/chemistry/electrochem/`, HH12 Bài 15),
  hai phần:
  - **Dãy điện hóa:** chọn hai cặp oxi hóa – khử; thấy vị trí trên trục E°, hình chữ α, chất khử
    mạnh hơn, chất oxi hóa mạnh hơn và phương trình phản ứng (tự cân bằng số electron). Có nút cho
    phản ứng (2) và câu 5a, 5b, 5c; với kim loại, app nói có tác dụng với acid hay không (câu 4).
  - **Pin Galvani:** chọn hai điện cực kim loại; thấy hình pin (hai cốc, cầu muối, vôn kế), anode,
    cathode, chiều electron, quá trình ở mỗi điện cực, phản ứng trong pin và E°pin.
- **Bài học có hướng dẫn:** Bài 16 (điện phân).
- **Chương mới** "Pin điện và điện phân"; tên bài vi/en, hình kệ bài, E2E `electrochem-hh12.spec.ts`,
  danh sách bài trong `chemistry.spec.ts`; `project.spec.ts` có 35 chủ đề Hóa học.
- **DATA_REVIEW:** HH12-ELC-1, HH12-ELC-2, HH12-GL-8 (pending).

## Key decisions

- **Cặp 2H₂O/H₂:** sách ghi giá trị −0,414 V đo tại pH = 7, khác điều kiện chuẩn của các cặp còn
  lại. App vẫn in nó trong bảng (kèm ghi chú) nhưng không cho đem so sánh.
- **Điện cực của pin:** Li, Na, K, Ca, Ba không có trong danh sách, vì sách (Bài 24, 25) nói các kim
  loại này tác dụng với nước ở nhiệt độ thường. Mg có trong danh sách: sách nói Mg phản ứng chậm với
  nước ở nhiệt độ thường.
- **Bài 16 làm bài học có hướng dẫn, không làm mô-đun:** sách không có công thức tính lượng chất khi
  điện phân. Sách cũng lưu ý thứ tự điện phân còn phụ thuộc vật liệu và bề mặt điện cực (ví dụ kẽm
  vẫn được điện phân từ dung dịch ZnSO₄), nên app không tự suy luật cho mọi dung dịch.

## Commands run (real results, summary lines only)

- `npx vitest run src/chemistry/electrochem`: 8/8 đạt (Bảng 15.1; phản ứng (2) và câu 3, 4, 5;
  Fe + 2Fe³⁺ → 3Fe²⁺; 2H₂ + O₂ → 2H₂O; pin Zn – Cu 1,102 V, Cu – Ag 0,459 V).
- `npx vitest run`: 478 tệp đạt, 2 bỏ qua (có sẵn); 5695 bài kiểm tra đạt.
- `npx tsc -b --noEmit`: đạt.
- `npm run lint`, `npm run format:check`: đạt với các tệp của dự án; chỉ báo hai tệp cấu hình riêng
  của worktree (không commit).
- **E2E (chromium):** chemistry, project, electrochem-hh12, amine-hh12, studio, learner: 25 đạt,
  1 lỗi. Lỗi là learner "touch screens", lỗi đã biết, chỉ xảy ra trong worktree.
- **E2E `electrochem-hh12.spec.ts`:** 1/1 đạt (Cu + 2Ag⁺ → Cu²⁺ + 2Ag; câu 5c; pin Zn – Cu
  1,102 V; pin Cu – Ag 0,459 V; Bảng 15.1 đủ 24 dòng).
- **Xem trên giao diện (1366×768):** sửa hai chỗ sau khi xem ảnh: tên cặp đè lên số trên trục; phần
  kết quả nằm dưới mép khung.

## Next steps and limits

- Đợt 4d: Hóa học 12 Bài 19–22 (kim loại: tính chất, tách kim loại, hợp kim, ăn mòn).
- Thế điện cực chỉ ở điều kiện chuẩn; app không tính theo nồng độ khác 1 M.
