# 192 — Hoá học: HCN, mũi tên ⇌, câu nguồn mendeleev

- **Goal:** ba lỗi chữ nhỏ còn từ #70 (bình luận 27/10), trước khi phát hành 0.8.1.
- **Date/time:** 2026-11-11, sáng, +07:00 (máy bàn)
- **Branch / base:** `fix/192-chemistry-text` từ `origin/main` `aadc36a`

## Sửa

1. **HCN hiện "CHN"** trên dòng "Công thức phân tử" (tiêu đề đúng là HCN): `textbookFormula` lấy thứ tự
   Hill cho mọi chất có cacbon. Thêm trường `molecular_formula` (+ `molecular_formula_source`) trong
   `scripts/data/gen_molecules.py` cho ngoại lệ có nguồn: HCN (PubChem CID 768, mục Molecular Formula,
   "HCN" theo ILO-WHO ICSC 0492; mục Molecular Formula của PubChem cũng có "CHN" từ nguồn khác).
   Sinh lại `data/molecules.json`: chỉ thêm 2 dòng (RDKit 2026.03.6 như bản cũ). Rà 85 phân tử: chỉ HCN
   là chất có cacbon mà công thức phân tử quen viết khác Hill; 37 chất khác có tiêu đề là công thức cấu
   tạo thu gọn (C2H5OH, HCHO, …) và dòng phân tử theo Hill là đúng; chất vô cơ đã theo `display_formula`.
2. **`formatEquationText`** giữ loại mũi tên: ⇌, <=>, <-> → ⇌; ->, →, ⟶, =>, = → → (cùng tập mũi tên
   `balance.ts` đọc).
3. **Câu nguồn mendeleev** lấy số phiên bản từ `ELEMENTS_SOURCE.citation` (do `gen_elements.py` ghi),
   test so với `data/elements.json`.

## Test

`formula.test.ts` (7 phương trình, cả 4 dạng của issue; HCN cùng nguyên tử, có nguồn, pending),
`molecules.test.ts` (dòng phân tử HCN), `ElementDetails.test.tsx` (phiên bản khớp dữ liệu).
DATA_REVIEW `CHEMUI-7`, `CHEMUI-8` (pending).
