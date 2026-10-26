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

## Trạng thái (26/10/2026)

- Tài khoản nhà phát triển cá nhân: **FPTTECH**. App: **SimLab**, Store ID `9P1FDCQBSDHT`,
  trang Store: <https://apps.microsoft.com/detail/9P1FDCQBSDHT>.
- Bản nộp 1 (gói `SimLab_0.5.1.0_x64.msix`): gửi duyệt ngày 13/10/2026, là bản đầu tiên lên Store.
- Bản nộp 2 (gói `SimLab_0.7.1.0_x64.msix`, gồm cả 0.6.0 và 0.7.0): **đã lên Store** (kiểm tra trang
  Store ngày 26/10/2026: mục "Có gì mới trong phiên bản này" ghi "Bản 0.7.1…"). Chưa ghi lại ngày
  phát hành chính xác.
- Bản nộp 3 (cùng gói 0.7.1.0, chỉ thay ảnh chụp trên trang Store bằng 8 ảnh mới trong
  `store/listing/screenshots/`, cho cả tiếng Việt và tiếng Anh): **gửi duyệt ngày 26/10/2026**, chọn
  **giữ lại**: duyệt xong, người dùng bấm **Publish now** thì ảnh mới mới hiện trên Store.
- Ảnh chụp 0.7.1 (8 ảnh PNG 1366×768, thứ tự = tên tệp): ảnh 1, 3–8 chụp từ giao diện web 0.7.1 bằng
  Playwright, đã bỏ chữ " (chế độ trình duyệt)" ở thanh trạng thái cho giống app cài đặt; ảnh 2 là
  một khung hình quay từ app cài đặt, câu trả lời Gemini thật, con trỏ chuột được vá bằng chính nút
  đó chụp từ app. Ảnh 2 còn dòng "(Theo ghi chú từ: …)" mà PR #55 đã bỏ: chụp lại khi bản có sửa
  lỗi này lên Store.
- Tự nộp từ GitHub Actions: **không dùng** (quyết định 13/10/2026, xem bước 7).

## Cách hoạt động

| Phần                   | Ở đâu                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| Gói MSIX               | `scripts/store/make-msix.mjs` bọc `stem-sim-lab.exe` + logo + manifest      |
| Danh tính gói          | `store/identity.json` (chép từ Partner Center, không phải bí mật)           |
| Dựng gói khi phát hành | workflow **Release**, bước "Store package (MSIX)" → artifact `simlab-store` |
| Nộp các bản sau        | **nộp tay** trong Partner Center (bước 7); workflow không có job tự nộp     |
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

### 7. Nộp bản cập nhật (làm tay, khoảng 3 phút)

**Quyết định của người dùng (13/10/2026): không dùng tự nộp từ GitHub Actions.** Tự nộp cần một
tenant Microsoft Entra; tạo tenant đi qua form đăng ký tổ chức, bắt buộc mã số thuế doanh nghiệp
(TIN) và bước thiết lập thanh toán, trong khi tài khoản nhà phát triển là **cá nhân**. Microsoft
cũng dặn không nhập giấy tờ cá nhân vào ô mã đăng ký. Đổi lại chỉ đỡ vài phút mỗi bản, nên nộp tay.

Mỗi lần ra bản mới cho Store:

1. Tăng phiên bản lõi (`tauri.conf.json` + `Cargo.toml` + `package.json`, ví dụ 0.5.1 → 0.5.2):
   Store chỉ nhận gói có số lớn hơn lần trước.
2. Chạy workflow **Release** (hoặc dựng trên máy). Tải artifact **simlab-store**, giải nén lấy
   `SimLab_<phiên bản>.0_x64.msix`.
3. Partner Center → SimLab → **Update** (tạo bản nộp mới từ bản đã phát hành).
4. **Packages**: xóa gói cũ, kéo gói mới vào, đợi "Validated", bấm **Save**.
5. (Tùy chọn) **Store listings** → mỗi ngôn ngữ → **What's new in this version**: ghi điểm mới.
6. **Submit for certification**. Mô tả, ảnh, xếp loại, giá giữ nguyên từ lần trước.

Người dùng đã cài từ Store tự nhận bản mới sau khi Microsoft duyệt (và sau khi bấm Publish now nếu
bản nộp chọn giữ lại).

Nếu sau này có công ty (có mã số thuế), có thể làm tự nộp: tenant Entra, ứng dụng vai trò Manager,
4 secret `PARTNER_CENTER_*` và `msstore publish` (tài liệu: "Publish app updates to Microsoft Store
with GitHub Actions" trên Microsoft Learn). App phải đã lên Store và miễn phí. Khi đó, đặt các
secret này trong một environment có người duyệt (như `release`), không ở mức repo
(`docs/RELEASE.md`, mục "An toàn khi phát hành").

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
