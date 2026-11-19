# settings-ai-in-simlab — Trang Cài đặt "Gemma cục bộ" đổi tên thành "AI trong SimLab"

- **Goal:** từ #190 (PR #328, đã gộp 19/11/2026), thẻ Qwen nằm trên trang Cài đặt "Gemma cục bộ".
  Khi thử trong app, máy bàn thấy tên trang chỉ nói tới Gemma, trong khi mọi câu lỗi của Qwen lại
  bảo người học vào trang này. Tên mới "AI trong SimLab" khớp với tên "Qwen trong SimLab" ở ô chọn
  AI.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/settings-ai-in-simlab`, tách từ `main` sau #328.

## Đã làm

- `vi.ts` và `en.ts`:
  - `settings.nav.local` đổi thành "AI trong SimLab" / "AI in SimLab";
  - lời gợi ý của trang nhắc cả Gemma và Qwen;
  - mọi câu "Cài đặt → Gemma cục bộ" trong lỗi của Qwen và trên trang AI trên máy khác đổi theo.
- Tên của engine Gemma ("Gemma cục bộ" trong ô chọn AI và các câu nói về Gemma) **giữ nguyên**, vì
  đó vẫn là Gemma.
- Test được sửa theo tên mới: `SettingsDialog.test.tsx`, `tests/e2e/qwen-builtin.spec.ts`. Ghi chú
  trong mã cũng đổi theo.
- Tài liệu: `USER_GUIDE.md` có ghi tên cũ của trang, `AI_TUTOR.md`, `THIRD_PARTY.md`.
- Không đổi khóa i18n, id trang (`local`) hay bất kỳ lưu trữ nào.

## Commands run (real results, summary lines only)

- `npx vitest run src/app/settings src/teacher src/app/i18n src/app/command`: 97 tệp, 2 376 đạt.
- `npx tsc -b --noEmit`, `eslint .`, prettier: đạt.
- E2E chromium `qwen-builtin.spec.ts`, `local-ai.spec.ts`, `teacher.spec.ts`: 14/14 đạt.
