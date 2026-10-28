# collision-friction-b — "Bỏ qua ma sát" không còn thành độ lệch tâm b = 0

- **Goal:** sửa lỗi cũ (#70, "Có từ trước 0.8.0"): ở bài va chạm, câu "bỏ qua ma sát" cho phép AI
  đặt độ lệch tâm b = 0 với trích dẫn "nói bằng lời", dù đề không nói va chạm thẳng tâm
  (MASTER_PROMPT §2.2). Người dùng đồng ý ngày 28/10.
- **Date/time:** 2026-10-28 15:14 +0700
- **Status:** IN_PROGRESS
- **Branch / base:** `fix/collision-friction-b` / `main` (0daaa31)

## Nguyên nhân và cách sửa

- `src/ai/draft.ts`, bảng `IMPLIED`: một quy tắc chung cho `mu|muS|muK|c|b` = 0 khi đề có "không ma
  sát", "bỏ qua ma sát", "nhẵn", "bỏ qua lực cản", "không lực cản". `b` ở lò xo là hệ số cản
  (kg/s), `c` ở con lắc đơn là hệ số cản theo góc (1/s), nhưng `b` ở va chạm là độ lệch tâm
  (không thứ nguyên, phần của r₁ + r₂).
- Sửa không liệt kê từng bài: tách quy tắc; `mu|muS|muK` giữ nguyên; `c|b` chỉ áp khi thứ nguyên
  của tham số là cản (`DIM.damping`) hoặc tốc độ (`DIM.frequency`). `impliedByWords` nhận thêm
  thứ nguyên của tham số (`buildDraft` truyền `def.dim`). Đã grep: chỉ `draft.ts` dùng `IMPLIED`;
  tham số tên `b`: va chạm (không thứ nguyên), lò xo (kg/s); tên `c`: con lắc đơn (Hz).

## Tests

- `draft.test.ts`: đề va chạm xiên có "bỏ qua ma sát" → b không lấy từ lời (nguồn mặc định,
  `notInText`); trên `main`: FAIL (nguồn 'problem'). Đề lò xo / con lắc có "bỏ qua lực cản" → b = 0,
  c = 0 vẫn nhận như trước (qua ở cả `main` và nhánh).
- Golden: thêm `vc-04` (va chạm xiên, hoàn toàn đàn hồi, "Bỏ qua ma sát"; đáp số động lượng và động
  năng, không phụ thuộc b) qua `scripts/golden/make_physics_golden.py` → `physics.json` (46 đề).
