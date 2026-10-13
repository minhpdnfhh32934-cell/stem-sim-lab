# Đưa SimLab lên Microsoft Store

Bộ cài trên GitHub chưa được ký số nên Windows SmartScreen hiện "Windows protected your PC". Bản
trên Microsoft Store thì Microsoft ký sau khi duyệt, người dùng cài bằng một nút **Nhận**, không có
cảnh báo, và Store tự cập nhật.

Quyết định của người dùng (13/10/2026):

- Bản cài từ Store **chỉ cập nhật qua Store**. Ứng dụng tự nhận ra mình chạy từ gói MSIX
  (`src-tauri/src/channel.rs`) và tắt tự tải phần web; menu ☰ → Kiểm tra cập nhật chỉ mở Store.
  Bản cài từ GitHub vẫn tự cập nhật như cũ.
- Chính sách quyền riêng tư đặt trên GitHub Pages:
  `https://minhpdnfhh32934-cell.github.io/stem-sim-lab/privacy.html` (tệp `site/privacy.html`).

## Cách hoạt động

| Phần                   | Ở đâu                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Gói MSIX               | `scripts/store/make-msix.mjs` bọc `stem-sim-lab.exe` + logo + manifest      |
| Danh tính gói          | `store/identity.json` (chép từ Partner Center, không phải bí mật)           |
| Dựng gói khi phát hành | workflow **Release**, bước "Store package (MSIX)" → artifact `simlab-store` |
| Tự nộp các bản sau     | job `store` trong workflow Release (khi bật, xem bước 7)                    |
| Trang quyền riêng tư   | `site/` → workflow **Pages**                                                |
| Nội dung trang Store   | `store/listing/` (mô tả, tính năng, ảnh chụp 1366×768)                      |

Gói MSIX **không ký**: Microsoft ký sau khi duyệt. Gói cần Windows 10 1809 trở lên và WebView2
(có sẵn trên Windows 11 và hầu hết máy Windows 10).

## Việc chỉ bạn làm được (theo thứ tự)

### 1. Bật GitHub Pages (một lần)

GitHub → repo → **Settings → Pages** → mục **Source** chọn **GitHub Actions**. Sau khi nhánh có
`site/` được gộp vào `main`, workflow **Pages** tự đăng trang. Mở thử
`https://minhpdnfhh32934-cell.github.io/stem-sim-lab/privacy.html`.

Đọc lại trang quyền riêng tư: đó là mô tả theo mã hiện tại, không phải ý kiến pháp lý. Bạn là
người công bố, nên cần tự xác nhận nội dung đúng (xem `docs/LEGAL_COMPLIANCE.md`).

### 2. Tạo tài khoản nhà phát triển (miễn phí cho cá nhân)

1. Mở <https://storedeveloper.microsoft.com> (lối vào duy nhất của cách đăng ký miễn phí; vào
   thẳng Partner Center sẽ ra cách cũ). Bấm **Get started for free**.
2. Chọn **Individual developer** (cá nhân: dự án học tập, phi thương mại). Không đổi sang công ty
   được về sau.
3. Đăng nhập bằng tài khoản Microsoft cá nhân.
4. Xác minh danh tính: chụp **giấy tờ tùy thân gốc** (CCCD/hộ chiếu) và **ảnh selfie** bằng điện
   thoại, chỗ đủ sáng.
5. Kiểm tra thông tin tự điền, chọn **Publisher display name** (tên nhà phát triển hiện trên Store,
   khác tên app), xong bấm **Go to Partner Center dashboard** và chọn đúng tài khoản vừa dùng.
   Chưa thấy ô **Apps & Games** thì đợi khoảng 5 phút rồi tải lại trang.

### 3. Giữ tên app và chép danh tính gói

1. Partner Center → **Apps and games → New product → MSIX or PWA app**.
2. Nhập tên **SimLab** → **Check availability** → **Reserve product name**. Nếu đã có người dùng
   tên này, thử "SimLab — Mô phỏng STEM" hoặc tên khác (tên trong app vẫn là SimLab).
3. Vào app vừa tạo → **Product management → Product identity**. Chép 4 giá trị vào
   `store/identity.json` (hoặc gửi cho Claude để chép):

   | Trong Partner Center                    | Trong `store/identity.json` |
   | --------------------------------------- | --------------------------- |
   | Package/Identity/Name                   | `identityName`              |
   | Package/Identity/Publisher              | `publisher` (bắt đầu `CN=`) |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName`      |
   | Store ID (ví dụ `9NXXXXXXXXXX`)         | `productId`                 |

   Mấy giá trị này hiện công khai trên Store, không phải mật khẩu.

### 4. Dựng gói MSIX

Sau khi `store/identity.json` được điền và gộp vào `main`: GitHub → **Actions → Release (Windows
installer) → Run workflow**. Khi xong, trong trang của lượt chạy có artifact **simlab-store** chứa
`SimLab_<phiên bản>.0_x64.msix`. Tải về, giải nén.

(Dựng trên máy: `npx tauri build --no-bundle` rồi `node scripts/store/make-msix.mjs`.)

### 5. Nộp lần đầu (làm tay trong Partner Center)

Vào app → **Start your submission**, điền từng mục:

- **Pricing and availability:** Free (miễn phí); thị trường: tất cả, hoặc chỉ Việt Nam.
- **Properties:** Category **Education**; Privacy policy URL: link ở bước 1; Website và Support
  contact: `https://github.com/minhpdnfhh32934-cell/stem-sim-lab/issues`.
- **Age ratings:** trả lời bảng câu hỏi (IARC) trung thực. Gợi ý thông tin để trả lời: app có
  trò chuyện với AI (nội dung do AI tạo, có lọc nội dung không phù hợp và nút báo cáo); không có
  trò chuyện giữa người dùng với nhau; không mua bán trong app; phần AI yêu cầu 18+.
- **Packages:** kéo tệp `.msix` vào.
- **Store listings:** thêm ngôn ngữ **Vietnamese** và **English**; dán nội dung từ
  `store/listing/listing.vi.md` / `listing.en.md`; tải ảnh trong `store/listing/screenshots/`.
- **Submission options → Restricted capabilities:** gói khai báo `runFullTrust`. Dán lý do:
  "SimLab is a desktop (Win32) app built with Tauri and packaged as MSIX; runFullTrust is required
  to run its desktop executable."

Bấm **Submit to the Store**. Microsoft duyệt từ vài giờ đến khoảng 3 ngày làm việc; bị từ chối thì
email ghi lý do — gửi cho Claude để sửa.

### 6. Sau khi app lên Store

Thử cài từ Store trên một máy, mở menu ☰ → **Kiểm tra cập nhật**: phải thấy "Bản này được cài từ
Microsoft Store…". Dữ liệu của bản Store nằm riêng với bản cài từ GitHub; khóa AI dùng chung (kho
khóa của Windows).

### 7. Tự nộp các bản sau (tùy chọn)

Từ lần thứ hai, workflow Release có thể tự nộp gói lên Store:

1. Partner Center → **Account settings → User management → Microsoft Entra applications** → tạo
   một ứng dụng, vai trò **Developer**. Ghi lại Tenant ID, Client ID, tạo một Client secret.
   Seller ID ở **Account settings → Legal info**.
2. GitHub → repo → **Settings → Secrets and variables → Actions**:
   - Secrets: `PARTNER_CENTER_TENANT_ID`, `PARTNER_CENTER_SELLER_ID`, `PARTNER_CENTER_CLIENT_ID`,
     `PARTNER_CENTER_CLIENT_SECRET`.
   - Variables: `STORE_SUBMIT` = `true`.
3. Từ đó, mỗi lần chạy Release (publish = true): GitHub Releases như cũ **và** một lần nộp mới lên
   Store. Người dùng Store nhận bản mới sau khi Microsoft duyệt.

Muốn tắt: đổi `STORE_SUBMIT` thành `false`.

## Ghi chú kỹ thuật

- Phiên bản gói = phiên bản lõi (`tauri.conf.json`) + `.0` (Store yêu cầu số thứ tư là 0). Mỗi lần
  nộp phải có số lớn hơn lần trước, nên mỗi bản Store cần tăng phiên bản lõi.
- Gói MSIX ghi dữ liệu vào thư mục riêng của gói (Windows tự chuyển hướng `%APPDATA%`), vì thế
  bản Store không thấy dữ liệu của bản cài từ GitHub.
- Quyền khai báo: Internet, camera ("Chụp đề bài"), `runFullTrust`. Không dùng micro.
- Thử gói trên máy (không lên Store được): `node scripts/store/make-msix.mjs --test` tạo gói với
  danh tính thử. Cài thử cần bật Developer Mode của Windows hoặc tin một chứng chỉ tự ký — đều là
  cài đặt bảo mật của máy, người dùng tự quyết.
- Bộ kiểm tra của Microsoft (Windows App Certification Kit, `appcert.exe`) cần quyền quản trị; Store
  cũng tự chạy kiểm tra khi duyệt.
