# model-quality-342 — lỗi còn lại sau lượt rà AI Teacher với mô hình thật (#342)

- **Goal:** người dùng 19/11/2026: "Cấp quyền tự động chạy tới khi xong thì báo cáo, tự gộp PR không
  cần hỏi". Sửa các lỗi của #342 không cần đổi lời nhắc hay cách sinh chữ của mô hình.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/342-model-quality`, tách từ `main` (sau #340).

## Dữ liệu

Máy bàn (RTX 4080, `npm run tauri dev`, main df106a22) gửi nguyên văn câu trả lời thật: 5 câu E2B mở
đầu "GHI CHÚ:", 3 lần Viết tiếp của Gemma 1B, 1 lần E2B viết tiếp lặp lại, câu trả lời Qwen có chip
"1", dòng cảnh báo KaTeX, các mốc tiến độ tải E2B. Bản đầy đủ ở
`D:\Projects\simlab-work\issue-342-2026-11-19\` trên máy bàn.

## Đã sửa

- V1: "GHI CHÚ:<câu đầu của ghi chú thư viện>" (công thức viết bằng LaTeX) rồi dòng trống: phần mở đầu
  đó được bỏ (`answerClean.ts`, `noteOpening`: so sau khi đọc LaTeX như thư viện viết; ít nhất 20 kí
  tự, nguyên câu).
- Viết tiếp: bỏ đoạn lặp lại phần cuối của phần trước (ít nhất 12 kí tự); bỏ lời bình về việc viết
  tiếp của 1B ("Đúng vậy, tôi đã dừng lại ở chỗ bị dừng.", "Tuyệt vời! Tiếp tục viết tiếp…", "Tôi xin
  lỗi vì sự chậm trễ. Chúng ta sẽ tiếp tục:", "(Tiếp tục...)" và "..."); chỉ khi có bằng chứng rõ, câu
  có số hay công thức thì giữ (`memory.ts` `joinContinuation`).
- Chip "Số do AI tự đưa ra": `\frac{1}{2}` và ½ là hệ số công thức (`provenance.ts`).
- Tiêu đề "# # Rơi Tự Do": bỏ dấu "#" lặp (`MessageBody.tsx`, `fromMarkdown.ts`).
- KaTeX: chữ Việt trong `\text{…}` không còn cảnh báo (`KATEX_STRICT` dùng chung cho chat và bảng).
- Tiến độ tải: tệp đã xong giữ kích thước trong tổng (`downloadProgress.ts`); không ghi "Chưa tải mô
  hình này" khi đang tải (`GemmaSettings.tsx`).

## Chưa sửa (còn ở #342)

- V3 (tóm tắt trí nhớ của Qwen), V4 (bộ nhớ card khi hỏi ảnh bằng E2B), 1B viết lại từ đầu thay vì
  viết tiếp (K1, K2: chất lượng mô hình), Bảng giảng rút gọn ý (BRD-04), giọng MMS chờ câu đầu, gốc
  lỗi N1. Đổi lời nhắc phải đo bằng `scripts/teaching/eval-gemma.mjs` trên card rời.

## Commands run (real results, summary lines only)

- `npx vitest run src/teacher src/science-card`: 95 tệp, 2 385 bài đạt.
- `npx tsc -b --noEmit`, ESLint các thư mục đã đổi: đạt.
- `npx playwright test` teacher, board, post198-teacher, local-ai, qwen-builtin, board-picture
  (chromium): 53 đạt.

## Lượt 2: máy bàn thử lại #343 (19/11/2026, tối)

Máy bàn chạy main e2388b67 bằng `npm run tauri dev`, RTX 4080, chỉ dùng model đã có (không tải gì).
Bằng chứng ở `D:\Projects\simlab-work\issue-342-2026-11-19\retest-343\` trên máy bàn.

Kết quả thử lại: V1 LỖI (2/6 câu E2B còn mở bằng "GHI CHÚ:"; 1 câu "GHI CHÚ lạc đề, bỏ qua." rồi
không trả lời), Viết tiếp LỖI (1B: 6/6 lần mở bằng câu dẫn mới; E2B: 3/3 lần viết lại nguyên mục
cuối, có sửa lỗi gõ nên không trùng từng chữ), tiến độ nạp từ OPFS LỖI nhẹ (phần trăm 99 % → 0 %
trong 0,5 giây đầu), KaTeX ĐẠT.

Đã sửa (PR tiếp theo của #342):

- Câu chép ghi chú: nhận cả các câu ở giữa ghi chú (E2B chép câu 3–4 của ghi chú năng lượng) và
  `mv^2` cho `mv²` (`answerClean.ts` `noteOpening`, `compareForm`).
- Câu nói về ghi chú ("GHI CHÚ lạc đề, bỏ qua.", "Không có thông tin cụ thể trong GHI CHÚ…"): bỏ
  khi câu gọi tên GHI CHÚ viết hoa, nói nó không dùng được, không có số hay công thức
  (`removeNoteRemark`). Câu trả lời còn lại vẫn là của mô hình (có lần không trả lời: lỗi chất lượng).
- Viết tiếp: dòng chép ghi chú ở đầu phần viết tiếp được bỏ cả khi không có nhãn (1B,
  `continues`); câu dẫn "Tôi xin tiếp tục:", "Chúng ta cần tiếp tục phần…", "Để tiếp tục, …",
  "Chuyển động ngang tiếp tục:" được bỏ ("Ta tiếp tục thay số:" giữ); E2B viết lại các dòng cuối
  (giống ≥ 85 %, cùng các số, ≥ 40 kí tự) thì bản viết lại thay các dòng đó (`memory.ts`
  `rewriteStart`).
- Chữ số Bengal "২" trong câu trả lời của Gemma thành "2" (`gemmaTransport.ts` `plainDigits`).
- Tiến độ: kích thước biết trước của model là tổng nhỏ nhất (`downloadTotals(expected)`).

Không đổi lời nhắc hay cách giải mã. Chưa sửa: câu trả lời "Tôi cần bạn cung cấp câu hỏi cụ thể"
(mô hình hiểu lời nhắc "GHI CHÚ lạc đề thì bỏ qua" là lệnh), 1B tự bịa nguồn và quay lại "Ví dụ 2"
(chất lượng mô hình): cần đổi lời nhắc và đo bằng `eval-gemma.mjs` trên card rời.

Lệnh đã chạy (kết quả thật):

- `npx vitest run`: 510 tệp, 5 837 bài đạt, 3 bỏ qua có sẵn.
- `npx eslint .`, `npx tsc --noEmit -p .`, `npx prettier --check` các tệp đã đổi: đạt.
- `npx playwright test` teacher, post198-teacher, board, local-ai, qwen-builtin (chromium): 51 đạt.

## Lượt 3: máy bàn thử lại #344 (20/11/2026)

Bằng chứng ở `D:\Projects\simlab-work\issue-342-2026-11-19\retest-344\` trên máy bàn (main 13570d4b,
RTX 4080, chỉ model có sẵn).

Kết quả thử lại: V1 ĐẠT (không còn "GHI CHÚ", không chữ số Bengal), tiến độ ĐẠT (phần trăm không lùi
lần nào), KaTeX ĐẠT. Viết tiếp còn LỖI ở ba chỗ:

- 1B mở bằng "Tuyệt vời! Chúng ta cần tiếp tục phân tích về…": "phân tích" chưa có trong danh sách.
- 1B chép nguyên văn khối "Định nghĩa" ở giữa phần trước (khoảng 370 kí tự).
- E2B viết lại mục 20 bằng lời khác ("Để kéo vật đó" → "để đạt được", bỏ "**"): giống dưới 85 %, nên
  dòng dở cũ vẫn còn.

Đã sửa (`memory.ts`):

- Sau một lời khen ("Tuyệt vời!"), câu "chúng ta … tiếp tục …" luôn là câu dẫn; danh sách thêm
  "phân tích", "mở rộng", "tìm hiểu", "thảo luận".
- Phần viết tiếp mở bằng các dòng chép nguyên văn, cùng thứ tự, từ phần trước (tổng ≥ 80 kí tự):
  bỏ các dòng đó (`withoutCopiedBlock`); nếu chỉ có phần chép thì giữ nguyên.
- Dòng bị cắt là mục có số ("20.") và dòng đầu phần viết tiếp cùng số, 30 kí tự đầu giống ≥ 85 %:
  bản viết lại thay dòng cũ (`sameStart`). Mục 21 sau mục 20 không bị gộp.

Còn lại là chất lượng mô hình, không phải bộ lọc: E2B trả lời lạc đề (câu 2 nói về định luật II thay
vì ném ngang), câu 4 không có công thức, 1B viết lại gần nguyên ví dụ 1 ở giữa phần viết tiếp, mục bị
bỏ trống ("4. … :" rồi sang ý khác). Cần đổi lời nhắc và đo bằng `eval-gemma.mjs` trên card rời.

Lệnh đã chạy (kết quả thật):

- `npx vitest run`: 510 tệp, 5 841 bài đạt, 3 bỏ qua có sẵn.
- `npx eslint .`, `npx tsc --noEmit -p .`, `npx prettier --check`: đạt.
- `npx playwright test` teacher, post198-teacher, board (chromium): 47 đạt.

## Lượt 4: máy bàn thử lại #345 (20/11/2026)

Bằng chứng ở `D:\Projects\simlab-work\issue-342-2026-11-19\retest-345\` trên máy bàn (main 2c5ec4fe).

Kết quả thử lại "Viết tiếp" ("Ngắn"): câu dẫn ĐẠT (0/5 lần), khối chép lại ĐẠT, KaTeX ĐẠT. Còn LỖI nhẹ:
E2B lần 2 dừng ở "2. **Định luật II Newton ($\Sigma F = ma$):**" + "* **Ví dụ:**" rồi viết lại đúng tiêu đề
đó với "**Ví dụ 11:**", nên tiêu đề hiện hai lần. Dòng bị cắt không phải mục có số, và phần chép chỉ
khoảng 45 kí tự (dưới mức 80 của khối chép, mức 40 kí tự gồm cả nhãn thì chưa tới vì không tính dấu).

Đã sửa (`memory.ts` `rewriteStart`, `sameStart`):

- Dòng bị cắt là một nhãn trống ngắn kết thúc bằng ":" ("Ví dụ:") thì khớp với dòng mở bằng cùng
  nhãn có thêm số ("Ví dụ 11:").
- Phần viết lại ngắn hơn 40 kí tự chỉ được nhận khi có từ hai dòng trở lên và mọi dòng (trừ dòng bị
  cắt) giống từng chữ; "Định luật I" → "Định luật II" không bị gộp.

Không sửa: nhãn "**GHI CHÚ:**" ở giữa phần viết tiếp của 1B, theo sau là lời của chính mô hình: quy
tắc của #128 giữ nhãn có nội dung riêng ("Ghi chú:" cũng là tiêu đề của giáo viên). 1B đánh số lại
từ 1 và bỏ dở câu cuối: chất lượng mô hình.

Lệnh đã chạy (kết quả thật):

- `npx vitest run src/teacher/chat/memory.test.ts`: 36 đạt.
- `npx vitest run` toàn bộ: 5 841 đạt, 1 hỏng là `src/physics/interference/engine.test.ts` "beats"
  (18 s, quá giờ khi cả bộ chạy song song); chạy riêng: 9/9 đạt, cả khi bỏ thay đổi này.
- `npx eslint .`, `npx tsc --noEmit -p .`, `npx prettier --check`: đạt.
- `npx playwright test` teacher, post198-teacher, board (chromium): 47 đạt.

## Lượt 5: máy bàn thử lại #346 (20/11/2026)

Bằng chứng ở `D:\Projects\simlab-work\issue-342-2026-11-19\retest-346\` trên máy bàn (main f5c43c1c,
E2B câu e1, "Ngắn", 2 lần chạy × 3 lần bấm).

Kết quả: trường hợp của #346 không xuất hiện lại; lần chạy 2 ĐẠT; KaTeX ĐẠT. Lần chạy 1 còn:

- Mục 10–14 trùng nguyên văn mục 3, 4, 6, 7, 8 (khoảng 885 kí tự, bỏ qua mục 5): số mục khác nên
  quy tắc chép từng chữ của #345 không bắt được, và các mục không liền nhau.
- " **Nội dung tiếp theo:**\n\n...thì vật sẽ duy trì trạng thái đó." chen giữa câu.

Đã sửa (`memory.ts`):

- Khối chép lại so không kể số mục ở đầu dòng, các dòng chép chỉ cần cùng thứ tự (không cần liền
  nhau); phần viết tiếp chỉ toàn là phần chép thì không thêm gì (không mất chữ nào).
- "Nội dung tiếp theo:", "Phần tiếp theo:", "Ý tiếp theo:" (có hay không có "**") là câu dẫn; dấu
  "**" đóng nhãn đi cùng.

Không sửa: "9." bỏ trống, "Định luật này Định luật III Newton…" (mô hình bắt đầu lại câu, lặp 2 chữ):
chất lượng mô hình.

Lệnh đã chạy (kết quả thật):

- `npx vitest run`: 510 tệp, 5 846 bài đạt, 3 bỏ qua có sẵn.
- `npx eslint .`, `npx tsc --noEmit -p .`, `npx prettier --check`: đạt.
- `npx playwright test` teacher, post198-teacher, board (chromium): 47 đạt.
