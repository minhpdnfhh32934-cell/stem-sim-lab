# Phát hành bản mới và cập nhật trong app

## Hai phần của ứng dụng

| Phần                                | Gồm                                               | Số phiên bản                                          | Người dùng nhận bản mới bằng                                   |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| **Phần web** (gần như mọi thay đổi) | giao diện, mô phỏng, dữ liệu khoa học, tài liệu   | `package.json` → `version`                            | menu ☰ → **Kiểm tra cập nhật** → **Cập nhật ngay** (vài giây) |
| **Phần lõi** (hiếm khi đổi)         | mã Rust trong `src-tauri/`: AI, lưu tệp, lịch sử… | `src-tauri/tauri.conf.json` và `src-tauri/Cargo.toml` | tải bộ cài `…x64-setup.exe` mới một lần                        |

Cập nhật phần web **không cài tệp .exe nào**, nên Windows Smart App Control / SmartScreen không
chặn. Bộ cài (.exe/.msi) chưa được ký số, nên Smart App Control có thể chặn — xem USER_GUIDE, mục
"Windows chặn bộ cài".

## Quy tắc số phiên bản

- Chỉ sửa giao diện/mô phỏng/dữ liệu: tăng `version` trong `package.json` (ví dụ 0.2.0 → 0.2.1).
- Có sửa mã Rust: tăng **cả** `package.json` **và** phiên bản lõi (tauri.conf.json + Cargo.toml),
  cùng một số (ví dụ 0.3.0). Bản web này ghi `minNative = 0.3.0`, nên app có lõi cũ sẽ được báo
  "cần tải bộ cài mới" thay vì nhận một phần web không chạy được.
- Không bao giờ giảm số phiên bản: app không bao giờ hạ cấp.

## Phát hành (GitHub)

1. Đẩy mã lên nhánh `main` (CI phải xanh).
2. GitHub → **Actions → Release (Windows installer) → Run workflow**. Để `publish` = true, ghi chú
   thay đổi bằng tiếng Việt (hiện trong hộp thoại cập nhật của app).
3. Khoảng 10–25 phút sau có bản Release `v<phiên bản>` gồm: bộ cài `.exe`, `.msi`,
   `web-bundle.zip` và `web-update.json`.
4. Mọi máy đã cài app sẽ tự thấy "Có bản cập nhật" ở thanh trạng thái (app kiểm tra khi mở, nếu có
   mạng).

Điều kiện một lần: kho GitHub để **Public** (app tải bản cập nhật không cần đăng nhập), và secret
`WEB_UPDATE_SIGNING_KEY` đã được thêm (Settings → Secrets and variables → Actions).

## An toàn

- `web-update.json` được ký Ed25519 bằng khóa bí mật trong secret `WEB_UPDATE_SIGNING_KEY`
  (`scripts/release/web-bundle.mjs`). Khóa công khai nằm trong `src-tauri/src/webupdate.rs`.
- Chữ ký bao gồm phiên bản, `minNative`, SHA-256 và kích thước của `web-bundle.zip`, và địa chỉ
  tải (phải thuộc Releases của dự án). App kiểm tra chữ ký, SHA-256, kích thước, đường dẫn trong
  zip (không có `..`), và giới hạn dung lượng trước khi dùng.
- Phần web tải về nằm ở `%APPDATA%\vn.stemsimlab.desktop\web\<phiên bản>\`. Nút **Quay về bản
  gốc** xóa nó. Cài bộ cài mới hơn thì phần tải về cũ tự bị bỏ.
- **Mất khóa bí mật:** tạo cặp khóa mới, thay khóa công khai trong `webupdate.rs`, phát hành bộ
  cài mới (người dùng cài lại một lần). **Lộ khóa bí mật:** làm như trên ngay lập tức.

Tạo cặp khóa mới:

```bash
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519');
require('fs').writeFileSync('web-update-signing-key.pem',k.privateKey.export({type:'pkcs8',format:'pem'}));
console.log(k.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64'))"
```
