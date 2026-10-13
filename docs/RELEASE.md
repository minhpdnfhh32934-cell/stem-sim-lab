# Phát hành bản mới và cập nhật trong app

## Hai phần của ứng dụng

| Phần                                | Gồm                                               | Số phiên bản                                          | Người dùng nhận bản mới bằng                                   |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| **Phần web** (gần như mọi thay đổi) | giao diện, mô phỏng, dữ liệu khoa học, tài liệu   | `package.json` → `version`                            | menu ☰ → **Kiểm tra cập nhật** → **Cập nhật ngay** (vài giây) |
| **Phần lõi** (hiếm khi đổi)         | mã Rust trong `src-tauri/`: AI, lưu tệp, lịch sử… | `src-tauri/tauri.conf.json` và `src-tauri/Cargo.toml` | tải bộ cài `…x64-setup.exe` mới một lần                        |

## Một bản cài

| Bộ cài                     | Dành cho                                                | Kênh cập nhật     | Dữ liệu và khóa AI                 |
| -------------------------- | ------------------------------------------------------- | ----------------- | ---------------------------------- |
| `SimLab_<v>_x64-setup.exe` | người dùng 18+ (Gemini mặc định, Claude, Groq dự phòng) | `web-update.json` | `%APPDATA%\vn.stemsimlab.desktop\` |

- **Bản thử nghiệm THPT đã bỏ (12/10/2026)**, theo quyết định của người dùng: không còn
  `build:pilot`, `tauri.pilot.conf.json`, tính năng Cargo `edition-pilot` hay kênh
  `web-update-pilot.json`. Máy đã cài bản THPT (0.4.1 trở về trước) không nhận cập nhật nữa.
- Mã định danh `vn.stemsimlab.desktop` và tên mục khóa trong Windows Credential Manager
  ("STEM Sim Lab") giữ nguyên khi đổi tên app thành SimLab, để dữ liệu và khóa AI không mất.
- Tệp `web-update.json` ghi `edition: main` trong nội dung được ký, và app kiểm tra cả trường
  `edition` lẫn tệp `web-edition.txt` trong zip.

Cập nhật phần web **không cài tệp .exe nào**, nên Windows Smart App Control / SmartScreen không
chặn. Bộ cài (.exe/.msi) chưa được ký số, nên Smart App Control có thể chặn — xem USER_GUIDE, mục
"Windows chặn bộ cài".

## Quy tắc số phiên bản

- Chỉ sửa giao diện/mô phỏng/dữ liệu: tăng `version` trong `package.json` (ví dụ 0.2.0 → 0.2.1).
- Có sửa mã Rust: tăng **cả** `package.json` **và** phiên bản lõi (tauri.conf.json + Cargo.toml),
  cùng một số (ví dụ 0.3.0). Bản web này ghi `minNative = 0.3.0`, nên app có lõi cũ sẽ được báo
  "cần tải bộ cài mới" thay vì nhận một phần web không chạy được.
- Không bao giờ giảm số phiên bản: app không bao giờ hạ cấp.

## Kênh Microsoft Store

Từ 0.5.1, cùng một tệp chạy còn được đóng gói MSIX cho Microsoft Store (`docs/STORE.md`). Bản cài
từ Store tự biết mình đến từ Store và **không** dùng cập nhật trong app; Store cập nhật nó sau khi
Microsoft duyệt. Mỗi lần nộp Store cần phiên bản lõi mới (số thứ tư luôn là 0, ví dụ `0.5.2.0`), nên
bản chỉ đổi phần web vẫn đến tay người dùng GitHub ngay, còn người dùng Store nhận ở lần nộp sau.
Workflow Release tạo gói (artifact `simlab-store`) khi `store/identity.json` đã điền, và tự nộp khi
biến `STORE_SUBMIT` = `true`.

## Phát hành (GitHub)

1. Đẩy mã lên nhánh `main` (CI phải xanh).
2. GitHub → **Actions → Release (Windows installer) → Run workflow**. Để `publish` = true, ghi chú
   thay đổi bằng tiếng Việt (hiện trong hộp thoại cập nhật của app).
3. Khoảng 15–35 phút sau có bản Release `v<phiên bản>` gồm: bộ cài `.exe`, `.msi`,
   `web-bundle.zip` và `web-update.json`.
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
- Phần web tải về nằm ở `%APPDATA%\vn.stemsimlab.desktop\web\<phiên bản>\`. Nút **Quay về bản gốc** xóa nó. Cài bộ cài mới hơn thì phần tải về cũ tự
  bị bỏ.
- **Mất khóa bí mật:** tạo cặp khóa mới, thay khóa công khai trong `webupdate.rs`, phát hành bộ
  cài mới (người dùng cài lại một lần). **Lộ khóa bí mật:** làm như trên ngay lập tức.

Tạo cặp khóa mới:

```bash
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519');
require('fs').writeFileSync('web-update-signing-key.pem',k.privateKey.export({type:'pkcs8',format:'pem'}));
console.log(k.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64'))"
```
