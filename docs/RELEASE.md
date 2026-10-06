# Phát hành bản mới và cập nhật trong app

## Hai phần của ứng dụng

| Phần                                | Gồm                                               | Số phiên bản                                          | Người dùng nhận bản mới bằng                                   |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| **Phần web** (gần như mọi thay đổi) | giao diện, mô phỏng, dữ liệu khoa học, tài liệu   | `package.json` → `version`                            | menu ☰ → **Kiểm tra cập nhật** → **Cập nhật ngay** (vài giây) |
| **Phần lõi** (hiếm khi đổi)         | mã Rust trong `src-tauri/`: AI, lưu tệp, lịch sử… | `src-tauri/tauri.conf.json` và `src-tauri/Cargo.toml` | tải bộ cài `…x64-setup.exe` mới một lần                        |

## Hai bản cài (3b.6)

| Bản                     | Bộ cài                                | Dành cho                                      | Kênh cập nhật           | Dữ liệu và khóa AI                 |
| ----------------------- | ------------------------------------- | --------------------------------------------- | ----------------------- | ---------------------------------- |
| **Bản chính**           | `STEM Sim Lab_<v>_x64-setup.exe`      | sinh viên 18+ (Gemini mặc định, Claude tùy ý) | `web-update.json`       | `%APPDATA%\vn.stemsimlab.desktop\` |
| **Bản thử nghiệm THPT** | `STEM Sim Lab THPT_<v>_x64-setup.exe` | buổi thử nghiệm có giám sát với học sinh THPT | `web-update-pilot.json` | `%APPDATA%\vn.stemsimlab.pilot\`   |

- Hai bản có tên và mã định danh khác nhau, nên **cài song song được** trên cùng một máy và không
  dùng chung dữ liệu, khóa AI hay mã PIN.
- Bản THPT được dựng bằng `npm run build:pilot` (kiểm tra không có mã Gemini) và Rust
  `--no-default-features --features edition-pilot` (`src-tauri/tauri.pilot.conf.json`).
- Mỗi bản chỉ nhận phần web **của chính nó**: tệp `web-update-pilot.json` có thêm dòng
  `edition:pilot` trong nội dung được ký, và app kiểm tra cả trường `edition` lẫn tệp
  `web-edition.txt` trong zip. Bản chính không thể nhận phần web của bản THPT và ngược lại.

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
3. Khoảng 15–35 phút sau có bản Release `v<phiên bản>` gồm: bộ cài `.exe`, `.msi` của **cả hai
   bản**, `web-bundle.zip` + `web-update.json` (bản chính) và `web-bundle-pilot.zip` +
   `web-update-pilot.json` (bản THPT).
4. Mọi máy đã cài app sẽ tự thấy "Có bản cập nhật" ở thanh trạng thái (app kiểm tra khi mở, nếu có
   mạng).

Điều kiện một lần: kho GitHub để **Public** (app tải bản cập nhật không cần đăng nhập), và secret
`WEB_UPDATE_SIGNING_KEY` đã được thêm (Settings → Secrets and variables → Actions).

## Hộp thoại cập nhật và cập nhật bắt buộc (từ 0.3.0)

- Mở app (có mạng) → khoảng 8 giây sau app tự kiểm tra. Có bản mới thì **tự hiện hộp thoại** với
  **Cập nhật ngay** / **Để sau** (cần bộ cài mới thì nút **Mở trang tải bộ cài** / **Để sau**).
  Chọn "Để sau" thì lần mở app sau hỏi lại; thanh trạng thái vẫn nhắc "Có bản cập nhật".
- **Bắt buộc cập nhật:** khi chạy Release, tích ô **"Bắt buộc cập nhật"**. Bản đó ghi
  `minRequired = <phiên bản này>` vào `web-update.json`. Máy đang chạy bản cũ hơn sẽ thấy hộp thoại
  **không có ✕, không có "Để sau", Esc không đóng** — phải cập nhật mới dùng tiếp (nếu tải lỗi có
  nút **Thử lại**). Máy không có mạng vẫn dùng bình thường (không kiểm tra được thì không ép).
- Các bản sau **không tích** vẫn **giữ** mức bắt buộc cũ (workflow đọc `minRequired` của bản phát
  hành mới nhất), nên không ai "nhảy qua" được một bản bắt buộc.
- `minRequired` nằm trong **chữ ký thứ hai** (`signatureV2`, `signed_message_v2` trong
  `webupdate.rs` = `scripts/release/manifest-message.mjs`); không ai sửa được mức bắt buộc mà không
  có khóa bí mật. Chữ ký cũ (`signature`) vẫn giữ để app trước 0.3.0 đọc được.
- Không tích "Bắt buộc" ở bản 0.3.0 đầu tiên: app 0.2.0 không hiểu tính năng này (họ chỉ được báo
  cần bộ cài mới, qua menu ☰ → Kiểm tra cập nhật).

## An toàn

- `web-update.json` được ký Ed25519 bằng khóa bí mật trong secret `WEB_UPDATE_SIGNING_KEY`
  (`scripts/release/web-bundle.mjs`). Khóa công khai nằm trong `src-tauri/src/webupdate.rs`.
- Chữ ký bao gồm phiên bản, `minNative`, SHA-256 và kích thước của `web-bundle.zip`, và địa chỉ
  tải (phải thuộc Releases của dự án). App kiểm tra chữ ký, SHA-256, kích thước, đường dẫn trong
  zip (không có `..`), và giới hạn dung lượng trước khi dùng.
- Phần web tải về nằm ở `%APPDATA%\vn.stemsimlab.desktop\web\<phiên bản>\` (bản THPT:
  `vn.stemsimlab.pilot`). Nút **Quay về bản gốc** xóa nó. Cài bộ cài mới hơn thì phần tải về cũ tự
  bị bỏ.
- **Mất khóa bí mật:** tạo cặp khóa mới, thay khóa công khai trong `webupdate.rs`, phát hành bộ
  cài mới (người dùng cài lại một lần). **Lộ khóa bí mật:** làm như trên ngay lập tức.

Tạo cặp khóa mới:

```bash
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519');
require('fs').writeFileSync('web-update-signing-key.pem',k.privateKey.export({type:'pkcs8',format:'pem'}));
console.log(k.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64'))"
```
