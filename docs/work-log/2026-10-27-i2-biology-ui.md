# #70 nhóm B — rà soát giao diện Sinh học (UI-45 … UI-51, UI-26 phần Sinh, số Mendel)

- **Goal:** sửa các mục owner “B” trong danh sách đã xác nhận
  (`D:/Projects/stem-sim-lab/.agent-logs/ui-audit/confirmed.md`), ảnh ở `D:/Projects/ui-audit/2026-10-27`.
- **Date/time:** 2026-10-27 (thời gian thật của máy)
- **Status:** DONE trừ UI-49 (chưa làm, xem “Next steps and limits”)
- **Branch / base:** `fix/70-biology-ui` từ `main` `32a9378`, đã merge `origin/main` `f5f0a35` (#93)

## Acceptance criteria (oracle không phải code đang sửa)

1. UI-45: không còn “Cromatit/cromatit”, “Ribôxôm”, “minh hoạ” trong mã nguồn `src/biology` (test quét tệp).
2. UI-46: không đường chỉ tên nào cắt qua bào quan tròn của bộ phận khác (test ghi lại lệnh vẽ ở 900×600 và
   640×460; hỏng trên mã cũ: 4 chỗ cắt).
3. UI-47: tiêu đề bài trong khung bên phải không bị chữ hoa (test `Section`; E2E `text-transform: none`).
4. UI-48: ô “Trình tự ADN” rộng ≥ 95 % khung (E2E), chữ đơn cách, màu theo token.
5. UI-50: thanh trượt đọc “nhãn: giá trị”; Phiêu bạt dùng `Range` chung; ký hiệu Hy Lạp sau tên (test).
6. UI-51: chip ghi “Vmax”, “Km” như thanh trượt và lời gợi ý.
7. Số Mendel: “1.000”, “10.000” (test); dòng ngẫu phối Hardy–Weinberg qua `formatNumber`.
8. UI-26 phần Sinh: “bậc tự do”, “giá trị p”, “mL/phút”, “đại lượng bảo toàn V”, tên phương pháp giải thích.

## Files

- `src/biology/terms.test.ts` (mới), `division/*`, `central/dogma3d/*`, `cell/card.ts` (UI-45).
- `src/biology/cell/draw.ts` (dời hai lysosome của tế bào động vật), `draw.test.ts` (UI-46).
- `src/ui/Section.tsx` (`keepCase`), `src/ui/ui.css`, `src/ui/Section.test.tsx`, `src/app/layout/Inspector.tsx`
  (UI-47; điều phối cho phép sửa ngoài `src/biology` đúng chỗ này).
- `src/biology/central/DogmaViews.tsx`, `src/biology/bio.css` (UI-48).
- `src/biology/ui.tsx`, `genetics/GeneticsViews.tsx`, `ecology/EcologyViews.tsx`, `ui.test.tsx` (UI-50, số Mendel).
- `src/biology/enzyme/chips.tsx` (UI-51).
- `genetics/hw3d/facts.ts`, `ecology/chips.tsx`, `ecology/lvCard.ts`, `transport/TransportViews.tsx` (UI-26).
- Tài liệu: DATA_REVIEW `BIOUI-1`, `BIOUI-2`; SCIENCE_ACCURACY, USER_GUIDE (câu chú thích bài Tế bào); PROGRESS.

## Key decisions

- “ribosome” theo cách viết SGK đã dùng ở bài Tế bào (thay “ribôxôm” ở bài ADN → mARN → Protein).
- `src/teacher/chat/chatService.ts` giữ cả “minh họa|minh hoạ”: đó là mẫu nhận lệnh người học gõ, không phải
  chữ hiển thị.
- Vmax/Km viết thường (không chỉ số dưới) ở mọi chữ thường; công thức KaTeX trong Thẻ Khoa học giữ nguyên.
- “Thời gian mô phỏng t” (đơn vị của t như trục đồ thị “Thời gian t”); không bịa đơn vị thời gian.

## Commands run (real results)

- `npm ci`: lần đầu hỏng (hai lệnh chạy chồng nhau, ENOTEMPTY), chạy lại: exit 0.
- `npm run typecheck`: PASS. `npx eslint .`: 1 lỗi ở bước E2E mới (`?? 0` thừa) → sửa → PASS.
- `npx prettier --check` các tệp của nhánh: PASS.
- `npx vitest run` (toàn bộ, sau merge `f5f0a35`): 324 tệp, 4408 test PASS, 1 bỏ qua (sẵn có).
- E2E Sinh học/3D (`chromium-3d --no-deps`): kết quả ghi ở mô tả PR.

## Next steps and limits

- **UI-49 (chú thích 3D chỉ sai chỗ hoặc đè nhau, 5 bài: Mendel, Hardy–Weinberg, Phiêu bạt, Khuếch tán,
  Đột biến điểm) chưa làm.** Cần xem hình 3D thật ở 1366×768 sau mỗi lần chỉnh điểm neo; khung trình duyệt
  trong app quá hẹp để kiểm chứng (chế độ giả lập thu nhỏ hình). Đã thử nâng điểm neo “Giao tử ♂” của Mendel
  lên trên các thẻ giao tử (`L.gameteY + L.gameteR + 0.95`, `mendel3d/scene.ts` `labelAnchors`) nhưng không
  kiểm chứng được nên đã bỏ. Gợi ý: chụp ảnh bằng Playwright (`chromium-3d`, SwiftShader) cho từng bài, chỉnh
  `labelAnchors` / `regions` của `layoutLabels` (`src/ui/three/labels.ts`) để đường chỉ không chạy qua chủ thể khác.
