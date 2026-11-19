# teacher-real-model-bugs — lỗi máy bàn tìm thấy khi chạy AI Teacher với mô hình thật

- **Goal:** sửa các lỗi trong báo cáo rà AI Teacher của máy bàn ngày 19/11/2026 (RTX 4080,
  `npm run tauri dev`, Qwen trong SimLab, Gemma 1B và E2B, giọng Windows và MMS). Báo cáo đầy đủ
  nằm trên máy bàn: `D:\Projects\simlab-work\ai-teacher-sweep-2026-11-19\BAO-CAO.md`.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/teacher-real-model-bugs`, tách từ `main` (sau #335).

## Đã sửa

- **N2 (nặng):** sau khi bấm Dừng, câu hỏi kế tiếp được Gemma 1B và E2B trả lời theo câu vừa
  dừng. Câu hỏi chưa có trả lời (đã dừng hoặc lỗi) vẫn được gửi kèm lịch sử. Nay
  `withoutUnanswered` (`memory.ts`) bỏ chúng khỏi phần gửi đi; trong khung chat vẫn giữ.
- **N1 (nặng, chỉ phần lời báo):** sau một lỗi card (lần này là lỗi ánh xạ bộ nhớ của WebGPU trên
  RTX 4080, không có sự kiện driver), lời báo nói card "đã bị treo" và khuyên "chọn card rời"
  trong khi máy đang dùng card rời. Nay lời báo nói card báo lỗi (hết bộ nhớ hoặc bị treo), Gemma
  vẫn tạm dừng như cũ (audit GPU-01, không đổi), và chỉ tới Cài đặt → GPU cho Gemma, nơi bật lại
  được, hoặc câu trả lời "Ngắn", mô hình nhỏ hơn, API. Phần phát hiện lỗi (`isGpuFailure`) không
  đổi: nới nó là quyết định an toàn của người dùng.
- **V2 (vừa):** chữ đậm có công thức bên trong (`**$\Sigma F$ (Tổng hợp lực):**`) hiện nguyên dấu
  `**`. Nay chữ đậm quanh công thức được tách trước công thức.
- **Nhẹ:** "Viết tiếp" nay hiện chữ dần (trước đó 15–21 giây chỉ thấy "đang suy nghĩ"); các câu về
  Gemma chỉ đúng trang Cài đặt → AI trong SimLab (trước là AI Teacher); mọi lỗi của Gemma có nút
  "Cài đặt", lỗi hỏi lại được thì có thêm nút "Hỏi lại"; hỏi câu mới trong lúc còn nút "Hoàn tác"
  thì nút biến mất thay vì bấm không có tác dụng.

## Chưa sửa (ghi lại, cần người dùng hoặc đo trên GPU)

- V1: E2B chép nhãn "GHI CHÚ:" của lời nhắc vào câu trả lời. V3: tóm tắt trí nhớ của Qwen sau ~11
  lượt chỉ còn chủ đề cuối và bịa "Điều còn vướng". Hai lỗi này cần đổi lời nhắc của mô hình chạy
  trên máy, mà quy tắc của dự án bắt đo lại bằng `scripts/teaching/eval-gemma.mjs` trên card rời
  trước khi phát hành.
- V4: E2B hỏi bằng ảnh dùng 15,9/16 GB bộ nhớ card (rủi ro cho card nhỏ hơn).
- Tiến độ tải E2B nhảy số; Bảng giảng rút gọn ý giữa cụm từ (BRD-04); 1B viết tiếp mở đầu bằng
  "Đúng vậy, tôi đã dừng lại…"; MMS chờ 2,8 giây ở câu đầu; tiêu đề "# Rơi Tự Do"; chip số đánh dấu
  "1" lấy từ ½; cảnh báo KaTeX với chữ "ổ".
- N1 mới gặp một lần, chưa tái hiện; nguyên nhân gốc (lỗi bộ nhớ khi hội thoại dài với 1B, đầu vào
  3 072 token) chưa điều tra.

## Commands run (real results, summary lines only)

- `npx vitest run`: 5 810 đạt, 1 đỏ: `src/physics/interference/engine.test.ts` (bài "beats" chạy
  18 giây khi cả bộ chạy song song); chạy riêng tệp đó: 9/9 đạt. Không liên quan tới thay đổi này.
- `npx tsc -b --noEmit`: đạt. `npm run lint`: đạt (trừ tệp cấu hình cục bộ không commit).
- `npx playwright test` teacher, board, board-picture, post198-teacher, local-ai, qwen-builtin,
  ai-flow (chromium): 73 đạt.
