# 195-shortcut-sheet — Ctrl+/ mở danh sách phím tắt (#195 bước 1)

- **Goal:** #195 bước 1 (kế hoạch 18/11/2026, người dùng giao quyền quyết định): bấm Ctrl+/ mở
  Cài đặt → Phím tắt.
- **Date/time:** 2026-11-18 (+0700).
- **Status:** PASS
- **Branch / base:** `feat/195-shortcut-sheet`, tách từ `main`.

## Đã làm

- `src/app/shortcuts/shortcuts.ts`: lệnh mới `shortcutSheet`, phím Ctrl+/. Không chạy khi đang gõ
  trong ô nhập (như các phím khác), để Ctrl+/ trong ô vẫn là của ô.
- `useGlobalShortcuts.ts`: `shortcutSheet` → `openSettingsAt('shortcuts')` (trang có sẵn).
- Trang Phím tắt (`GeneralSettings.tsx`) có dòng "Mở danh sách phím tắt này".
- i18n vi/en, `docs/USER_GUIDE.md` (bảng Phím tắt).

## Commands run (real results, summary lines only)

- `npx vitest run src/app/shortcuts src/app/settings src/app/i18n`: 6 tệp, 39 test đạt.
- `npx tsc -b --noEmit`: đạt. `npx eslint` và `npx prettier --check` trên các tệp đổi: đạt.
- E2E `tests/e2e/shortcuts.spec.ts` (chromium, 1366×768): 1 đạt. Ctrl+/ trong ô đề bài không mở
  Cài đặt; ngoài ô thì mở đúng trang, dòng Ctrl+/ hiện `Ctrl + /`, Esc đóng.

## Next steps and limits

- Bước 2 của #195: trang "Hiển thị và trợ năng".
