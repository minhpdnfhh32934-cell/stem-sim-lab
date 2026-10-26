# (g1) — dữ liệu xếp lớp KNTT + `docs/CURRICULUM_KNTT.md` (issue #71, kế hoạch #37 mục 10)

- **Goal:** một nguồn duy nhất (script) chứa mục lục chính thức 9 cuốn SGK KNTT và bảng chủ đề → lớp/bài,
  sinh `data/curriculum_kntt.json` và `docs/CURRICULUM_KNTT.md`; `src/app/curriculum.ts` (Zod + `gradeView`);
  thay `CURRICULUM_MAPPING`; DATA_REVIEW `KNTT-*` + mục 12; CLAUDE.md ghi quyết định 22/10.
- **Date/time:** 2026-10-26, 14:30–16:52 +07:00
- **Status:** PASS
- **Branch / base:** `feat/71-curriculum-data` từ `main` `d6f9fec`

## Acceptance criteria (oracle không phải code đang sửa)

1. Mục lục 9 cuốn chép nguyên văn từ ảnh trang chính thức (taphuan.nxbgd.vn). Oracle: tổng số bài mỗi cuốn
   khớp lần đếm độc lập trong kế hoạch #37 mục 0 (34/26/25, 23/25/30, 26/29/35) và lời nói đầu SH12 ("35
   bài, 8 chương"); các dòng dùng để xếp lớp được người thứ hai (Máy A) đọc lại trên ảnh.
2. Số bài lí thuyết theo quy tắc #37 mục 4.3 = 26/20/21, 16/19/22, 17/20/28, cộng 189 (oracle: kế hoạch).
3. Mọi chủ đề của catalog hoặc đã xếp, hoặc "chưa xếp" có lí do (oracle: `CATALOG` của app); chỉ mã chủ đề có
   thật; bài có trong mục lục; mọi dòng `pending`.
4. Chạy script hai lần không đổi tệp sinh ra.

## Files

- `scripts/data/gen_curriculum_kntt.py` (mới): mục lục nguyên văn (tên chương in hoa giữ ở `printed`, `label`
  viết thường), quy tắc loại bài, 23 dòng xếp, 13 dòng chưa xếp, bài Phần A; sinh JSON + Markdown.
- `data/curriculum_kntt.json`, `docs/CURRICULUM_KNTT.md` (sinh; `.prettierignore` thêm tệp Markdown sinh ra).
- `src/app/curriculum.ts` + `curriculum.test.ts` (mới); `src/app/levels.ts` (bỏ `CURRICULUM_MAPPING`);
  `src/app/learner/learner.test.tsx` (test "rỗng" đổi theo quyết định 3: dữ liệu sinh bằng script, pending).
- `docs/DATA_REVIEW.md` (mục 12, `KNTT-1` … `KNTT-11`, tiêu đề phụ "0.8.0 — mục có mã"), `CLAUDE.md` (Levels),
  `docs/LEGAL_COMPLIANCE.md` (mục 2g: xác nhận của người dùng câu 3, những điểm cần xác nhận).

## Key decisions

- Chép mục lục: workflow 9 agent (mỗi cuốn một agent, tự đọc lại lần hai) → mọi cuốn liên tục 1…N, tổng khớp
  kế hoạch; Máy A tự xem ảnh mục lục VL10, VL11, HH10 (2 trang), HH11, SH10, SH12: các dòng dùng để xếp khớp.
- Xếp theo bảng đề xuất #37 mục 10; dòng có "?" để "Chưa xếp lớp" (câu 5). Rà soát khoa học (agent
  science-reviewer): bỏ VL10 Bài 16 khỏi "Các định luật Newton" (cảnh một vật); lí do nói rõ khi chủ đề chỉ ứng
  một phần bài (khuếch tán, dao động tắt dần, con lắc đơn góc nhỏ, Mendel); thêm bài có thể liên quan
  (Maxwell–Boltzmann → VL12 Bài 8, 12; độ phân cực → HH10 Bài 11; phiêu bạt → SH12 Bài 18; mặt phẳng nghiêng →
  VL10 Bài 13); điểm chưa nhất quán gom vào `KNTT-10` cho giáo viên.
- Chưa có giao diện (việc (g2)); tài liệu nói rõ "Chưa xếp lớp" sẽ chỉ hiện ở "Tất cả" khi có thanh chia lớp.

## Commands run (real results, summary lines only)

- `python -I scripts/data/gen_curriculum_kntt.py` → "wrote 23 placements, 13 unplaced; books (total/theory):
  VL10 34/26, VL11 26/20, VL12 25/21, HH10 23/16, HH11 25/19, HH12 30/22, SH10 26/17, SH11 29/20, SH12 35/28";
  chạy hai lần: cùng mã băm cả hai tệp.
- `npx eslint src tests scripts *.ts *.js` → exit 0; `npm run typecheck` → exit 0; `npm test` → 308 file
  passed, 1 skipped; 4215 tests passed, 1 skipped (trước sửa sau rà soát); sau sửa: `curriculum` + `learner`
  17/17.

## Tests

- Unit: PASS. E2E đầy đủ `npx playwright test` (3 nhóm): PASS, 109 passed (7,2 phút). Không đổi giao diện.

## Next steps and limits

- (g2) #71 giao diện "Lớp 10 · 11 · 12 · Tất cả" dùng `gradeView` / `lessonRange`.
- Bảng đủ 253 bài trong `docs/CURRICULUM_KNTT.md`: 0.8.1 (#54 mục 7) — dữ liệu đã có trong script.
- Bài (a) gộp trước (g1) thì (g1) thêm dòng `uniformCircularMotion` trước khi gộp (luật "dòng xếp lớp", #37 mục 7).
