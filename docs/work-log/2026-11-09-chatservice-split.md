# chatservice-split — tách `chatService.ts` theo trách nhiệm (bước 0–6, không đổi hành vi)

- **Goal:** `src/teacher/chat/chatService.ts` (1696 dòng, 17 trách nhiệm) được tách thành các module nhỏ,
  không đổi hành vi, prompt giống từng byte. Dừng trước bước 7 (chuyển nội dung prompt).
- **Date/time:** 2026-11-09 08:48 +0700
- **Status:** PASS (bước 0–6); bước 7 BLOCKED (cần người dùng quyết định)
- **Branch / base:** `refactor/chatservice-split` / `main` (cd6cdd6)

## Files

| File               | Nội dung                                                               | Dòng |
| ------------------ | ---------------------------------------------------------------------- | ---: |
| `chatService.ts`   | văn bản prompt, `contextPrompt`, `askTeacher`, re-export tên công khai |  782 |
| `teacherErrors.ts` | `TeacherError`, `AnswerStopped`, `untilStopped`, `stopIfAsked`, …      |   79 |
| `turnKind.ts`      | phân loại lượt hỏi (chép nguyên văn, không import gì)                  |  269 |
| `references.ts`    | khối trích dẫn có rào                                                  |   42 |
| `engines.ts`       | `cloudChat`, `localGemma`, `localRuntimeChat`, `reachRuntime`          |  323 |
| `summary.ts`       | gộp các lượt cũ thành bản tóm tắt                                      |  147 |
| `inputGuards.ts`   | kiểm tra câu hỏi, chữ khoanh trên bảng, màn hình chia sẻ               |   65 |

Mới: `promptGolden.test.ts` + `__golden__/` (3 file), `inputGuards.test.ts`. `givenNumbers` sang
`provenance.ts`. Sửa tên hàm đã chuyển trong `docs/AI_TUTOR.md`, `docs/TEACHING_EVAL.md`, và chú
thích ở `board/selection.ts`, `provenance.test.ts`.

## Key decisions

- Golden commit **trước** khi chuyển code (809abe8). Ma trận: vi/en × full/compact/tight ×
  question/premise/learnerReply × không trích dẫn/thư viện/tài liệu nạp + Wikipedia giả, cộng bảng,
  khoanh bảng, màn hình, nút nhanh; và các request cuối của `askTeacher` (nháp cloud, Think, TeachScript,
  Gemma, ghi chú chuyển vào lượt hỏi, rà soát bản nháp Gemma).
- Hai khối `catch` giống hệt của runtime trên máy gộp thành `localError` (cùng thẻ `[teacher-local]`,
  cùng tham số, cùng `TeacherError`).
- Ánh xạ lý do → sự cố dùng chung `logRefusal`; mỗi kiểm tra giữ câu thông báo và kiểu lỗi riêng
  (`Error` hay `TeacherError`). Đây là đoạn duy nhất viết lại nên có test bảng riêng.
- `ChatPanel` và 4 test `vi.mock` vẫn dùng đường `./chatService`; lớp lỗi chỉ định nghĩa một lần.
- Không đụng: `untilStopped` trong `voice/naturalVoice.ts`, `fenceBoardText` trong `board/selection.ts`.

## Tests (chạy thật, chỉ dòng tóm tắt)

- Sau mỗi bước 1–6: `npx vitest run src/teacher/chat src/biology/division/mitosis3d/askTeacher.test.tsx
tests/teaching-rubric.test.ts` PASS (37 file, 1152 test; bước 6 có test mới: 38 file, 1156 test),
  `npm run typecheck` PASS, `npm run lint` PASS. Golden không đổi ở mọi bước.
- `npm run check` PASS: 340 file qua, 1 file bỏ qua (`postfx.gpu.test.ts`, có từ trước); 4478 test qua, 1 bỏ qua.
- E2E `--project=chromium`: `teacher`, `board`, `board-picture`, `local-ai`, `lesson-flow` PASS (35 test, 2,9 phút),
  dùng khóa chung `.agent-logs/e2e.lock`.
- `__golden__/`: 0 dòng thay đổi từ 809abe8 đến HEAD (`git log -p`).
- SKIPPED: benchmark GPU (`scripts/teaching/eval-gemma.mjs`), vì prompt không đổi byte nào.

## Errors and fixes

- Lint golden test: `useExcerpts` bị hiểu là React hook → đổi tên `setExcerpts`; ép kiểu trong
  `vi.hoisted` thừa → khai báo thường như `chatBoardAsk.test.ts`.

## Next steps and limits

- **Bước 7 (chuyển văn bản prompt và `contextPrompt`) chưa làm, chờ người dùng quyết định.** Nó phải
  sửa cùng commit: `scripts/teaching/eval-gemma.mjs` L200–213/302, `scripts/teaching/rubric.mjs`
  L617–677, `tests/teaching-rubric.test.ts` L1595–1621 (các chỗ này đọc thẳng `chatService.ts`, băm nó
  và nhận diện biến thể qua dòng import `./missingData`).
- Mã băm `chatServiceSha256` của bản này khác các lần đo cũ, nên `compare.mjs` sẽ báo "khác bản build"
  khi so với kết quả cũ, dù prompt giống hệt.
- PR gộp sau các PR 0.8.1. Nếu PR nào đổi prompt thì golden phải sinh lại trên `main` mới, trước khi
  rebase các bước tách; khác biệt đó cần benchmark như quy định trong CLAUDE.md.
