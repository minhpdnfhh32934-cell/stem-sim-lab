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
