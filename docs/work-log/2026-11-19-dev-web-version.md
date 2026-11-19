# dev-web-version — `npm run tauri dev` không còn khóa bằng hộp "cập nhật bắt buộc"

- **Goal:** sửa lỗi máy bàn gặp ngày 19/11/2026 khi thử #190. Bản chạy bằng `npm run tauri dev` tự
  báo phiên bản web là 0.0.0, nên hiện hộp cập nhật bắt buộc lên 0.11.0 và không đóng được hộp này.
- **Date/time:** 2026-11-19 (+0700).
- **Status:** PASS
- **Branch / base:** `fix/dev-web-version`, tách từ `main` (sau #330).

## Nguyên nhân

`tauri dev` lấy trang từ máy chủ Vite nên không có tệp `web-version.txt` (tệp này chỉ có khi dựng
bản thật). `OverrideAssets::new` trong `src-tauri/src/webupdate.rs` không tìm thấy tệp đó và ghi
phiên bản là `0.0.0`. Bản phát hành có mức bắt buộc tối thiểu (`minRequired`), nên mọi bản phát
hành đều bị coi là bắt buộc.

## Đã làm

- `src/app/update/updater.ts`: khi đang chạy phiên bản `0.0.0` (bản chạy thử, không có phần web
  đã dựng):
  - không kiểm cập nhật lúc mở app;
  - bấm "Kiểm tra cập nhật" vẫn chạy, nhưng hộp không bao giờ ở dạng bắt buộc, nên bấm "Để sau" là
    đóng được.
- Không sửa Rust và không đổi số phiên bản. Bản cài thật luôn có `web-version.txt` nên không bị ảnh
  hưởng.

## Commands run (real results, summary lines only)

- `npx vitest run src/app/update`: 14/14 đạt (2 test mới). Bỏ phần sửa thì đúng 2 test mới hỏng.
- `npx tsc -b --noEmit`, `npx eslint src/app/update`: đạt.

## Next steps and limits

- Chưa chạy `npm run tauri dev` trên máy này để xem trực tiếp. Bộ test giả lập đúng câu trả lời
  `running: "0.0.0"` mà máy bàn đã thấy.
