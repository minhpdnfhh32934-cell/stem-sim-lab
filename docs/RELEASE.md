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
- Ba chỗ ghi phiên bản lõi luôn **bằng nhau**: `tauri.conf.json`, `Cargo.toml` và mục
  `stem-sim-lab` trong `Cargo.lock` (app tự báo phiên bản lõi theo `Cargo.toml`, còn `minNative` và
  gói Store lấy theo `tauri.conf.json`). Phiên bản lõi **không bao giờ mới hơn** phiên bản web. Test
  `tests/versions.test.ts` giữ hai quy tắc này.

## Kênh Microsoft Store

Từ 0.5.1, cùng một tệp chạy còn được đóng gói MSIX cho Microsoft Store (`docs/STORE.md`). Bản cài
từ Store tự biết mình đến từ Store và **không** dùng cập nhật trong app; Store cập nhật nó sau khi
Microsoft duyệt. Mỗi lần nộp Store cần phiên bản lõi mới (số thứ tư luôn là 0, ví dụ `0.5.2.0`), nên
bản chỉ đổi phần web vẫn đến tay người dùng GitHub ngay, còn người dùng Store nhận ở lần nộp sau.
Workflow Release tạo gói (artifact `simlab-store`); bản Store được **nộp tay** trong Partner Center
(`docs/STORE.md`, mục "Nộp bản cập nhật").

## Phát hành (GitHub)

**Chỉ mã đã có trên `main`** mới được phát hành (từ 13/10/2026, audit SEC-01): workflow dừng nếu
chạy từ nhánh khác với `publish = true`, hoặc khi tag trỏ vào commit chưa có trên `main`. Bước ký và
bước phát hành chạy trong environment **`release`** (cài đặt: mục "An toàn khi phát hành" bên dưới).
Chạy thử bản dựng từ nhánh khác vẫn được với `publish = false`. Mỗi lúc chỉ có **một** lượt Release
chạy: lượt sau chờ lượt trước xong, không lượt nào bị hủy giữa chừng.

1. **Gộp (merge) pull request** vào `main` trên GitHub. Không đẩy thẳng lên `main` (nhánh này được
   bảo vệ). Các kiểm tra CI và Security của pull request phải xanh.
2. GitHub → **Actions → Release (Windows installer) → Run workflow**, chọn nhánh `main`. Để
   `publish` = true, ghi chú thay đổi bằng tiếng Việt (hiện trong hộp thoại cập nhật của app).
3. Khi environment `release` có người duyệt, GitHub hỏi duyệt hai lần (job ký `web` và job
   `publish`). Chỉ bấm **Approve** khi trang lượt chạy ghi nhánh `main` và đúng commit vừa gộp.
4. Khoảng 15–35 phút sau có bản Release `v<phiên bản>` gồm: bộ cài `.exe`, `.msi`,
   `SHA256SUMS.txt`, `web-bundle.zip` và `web-update.json`.
5. Mọi máy đã cài app sẽ tự thấy "Có bản cập nhật" ở thanh trạng thái (app kiểm tra khi mở, nếu có
   mạng).

Điều kiện một lần:

- Kho GitHub để **Public** (app tải bản cập nhật không cần đăng nhập).
- Environment **`release`** phải được **tạo tay trước lượt chạy đầu tiên** (Settings →
  Environments → New environment). Nếu chưa có, lượt chạy đầu tiên tự tạo nó **không có bảo vệ
  nào**.
- Secret `WEB_UPDATE_SIGNING_KEY` nằm **chỉ** trong environment `release` (Environment secrets),
  **không bao giờ** ở mức repo: trong Settings → Secrets and variables → Actions → Repository
  secrets không được có nó. Secret mức repo thì workflow trên **mọi** nhánh đều đọc được.

### Ghi chú phát hành và "Có gì mới" (từ 0.6.0)

Lịch sử phiên bản có **một nguồn duy nhất**: `release-notes/versions.json` (cách ghi và quy trình
đầy đủ: `release-notes/README.md`). Hộp "SimLab đã được cập nhật" trong app (mục "Có gì mới" trong
menu ☰), trang Cài đặt → "Lịch sử phiên bản", `docs/VERSION_HISTORY.md`, `docs/CHANGELOG.md` và
`release-notes/google-docs.html` đều lấy từ tệp này (`npm run release-notes`).

- **Trước bước 1:** đọc lại ghi chú của phiên bản sắp phát hành, đặt `notesReady: true` (chỉ khi đó
  hộp "SimLab đã được cập nhật" mới hiện chúng), chạy `npm run release-notes`, commit trong pull
  request.
- **Sau bước 4:** ghi `status: "released"`, ngày `published_at`, tag và link Release vào
  `versions.json`, chạy lại `npm run release-notes`. Một bản không tự ghi được ngày phát hành của
  chính nó, nên trong app bản đó ghi "Ngày phát hành: chưa xác minh" tới lần cập nhật sau.
- Ô "ghi chú thay đổi" ở bước 2 (hộp thoại "có phiên bản mới") nên tóm tắt cùng nội dung.

## Hộp thoại cập nhật và cập nhật bắt buộc (từ 0.3.0)

- Mở app (có mạng) → khoảng 8 giây sau app tự kiểm tra. Có bản mới thì **tự hiện hộp thoại** với
  **Cập nhật ngay** / **Để sau** (cần bộ cài mới thì nút **Mở trang tải bộ cài** / **Để sau**).
  Chọn "Để sau" thì lần mở app sau hỏi lại; thanh trạng thái vẫn nhắc "Có bản cập nhật".
- **Bắt buộc cập nhật:** khi chạy Release, tích ô **"Bắt buộc cập nhật"**. Bản đó ghi
  `minRequired = <phiên bản này>` vào `web-update.json`. Máy đang chạy bản cũ hơn sẽ thấy hộp thoại
  **không có ✕, không có "Để sau", Esc không đóng** — phải cập nhật mới dùng tiếp (nếu tải lỗi có
  nút **Thử lại**). Máy không có mạng vẫn dùng bình thường (không kiểm tra được thì không ép).
- Các bản sau **không tích** vẫn **giữ** mức bắt buộc cũ (workflow đọc `minRequired` của bản phát
  hành mới nhất), nên không ai "nhảy qua" được một bản bắt buộc. Mức cũ chỉ được mang sang khi
  `web-update.json` của bản đó **đúng chữ ký** (kiểm tra bằng khóa công khai trong `webupdate.rs`,
  cùng cách app kiểm tra). Nếu ai đó sửa tay tệp đó, mức bắt buộc bị bỏ qua và lượt chạy hiện
  **cảnh báo vàng**: hãy mở bản phát hành đó trên GitHub xem ai đã sửa gì.
- `minRequired` nằm trong **chữ ký thứ hai** (`signatureV2`, `signed_message_v2` trong
  `webupdate.rs` = `scripts/release/manifest-message.mjs`); không ai sửa được mức bắt buộc mà không
  có khóa bí mật. Chữ ký cũ (`signature`) vẫn giữ để app trước 0.3.0 đọc được.
- **Không tích "Bắt buộc" ở bản nào nâng phiên bản lõi** (`minNative`, tức bản có sửa mã Rust, ví
  dụ 0.3.0 hay 0.6.0). Máy cũ không nhận được phần web của bản đó mà phải tải bộ cài mới; nếu bản đó
  bắt buộc, app bị **khóa** cho tới khi người dùng tự tải và cài lại tệp `.exe` (chưa ký số). App
  0.2.0 còn không hiểu tính năng này. Với các bản đó luôn để **"Bắt buộc cập nhật" = không tích**.

## An toàn

- `web-update.json` được ký Ed25519 bằng khóa bí mật trong secret `WEB_UPDATE_SIGNING_KEY`
  (`scripts/release/web-bundle.mjs`). Khóa công khai nằm trong `src-tauri/src/webupdate.rs`.
- Chữ ký bao gồm phiên bản, `minNative`, SHA-256 và kích thước của `web-bundle.zip`, và địa chỉ
  tải (phải thuộc Releases của dự án). App kiểm tra chữ ký, SHA-256, kích thước, đường dẫn trong
  zip (không có `..`), và giới hạn dung lượng trước khi dùng.
- Phần web tải về nằm ở `%APPDATA%\vn.stemsimlab.desktop\web\<phiên bản>\`. Nút **Quay về bản gốc** xóa nó. Cài bộ cài mới hơn thì phần tải về cũ tự
  bị bỏ.
- **Đổi khóa làm mọi app đã cài bị "bỏ lại":** app chỉ tin khóa công khai đã dựng sẵn trong nó,
  nên sau khi đổi khóa, mọi máy đang chạy bản cũ báo lỗi chữ ký thay vì "cần bộ cài mới" và không
  bao giờ tự cập nhật được nữa; người dùng phải tự tải bộ cài mới từ trang Releases. Vì vậy **không**
  đổi khóa "cho chắc" khi không có dấu hiệu bị lộ.
- **Mất khóa bí mật:** tạo cặp khóa mới, thay khóa công khai trong `webupdate.rs`, phát hành bộ
  cài mới (người dùng cài lại một lần). **Lộ khóa bí mật:** làm như trên ngay lập tức. Sau khi đổi
  khóa:
  - lượt Release đầu tiên hiện cảnh báo và **không** mang mức bắt buộc cũ sang (chữ ký cũ không
    khớp khóa mới). Bản đó có sửa mã Rust nên nâng phiên bản lõi: không tích "Bắt buộc" (xem trên);
    máy cũ đằng nào cũng phải cài bộ cài mới;
  - thay manifest mẫu v0.5.2 trong `tests/workflows.test.ts` bằng một manifest ký bằng khóa mới.

Tạo cặp khóa mới:

```bash
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519');
require('fs').writeFileSync('web-update-signing-key.pem',k.privateKey.export({type:'pkcs8',format:'pem'}));
console.log(k.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64'))"
```

## An toàn khi phát hành (cài đặt của chủ repo)

Workflow tự chặn được nhiều thứ, nhưng ai có quyền Write cũng sửa được chính tệp workflow trên nhánh
của mình. Các cài đặt dưới đây nằm ngoài mã, nên chỉ chủ repo bật được. Thứ tự làm và lý do:
`docs/AUDIT_2026-10-13.md`, mục "Việc chủ repo cần làm".

- **Environment `release`** (Settings → Environments): tạo **trước** lượt chạy đầu tiên.
  - _Required reviewers_ = bạn.
  - Bỏ tích _Allow administrators to bypass_.
  - _Deployment branches and tags_ = _Selected_: nhánh `main` và tag `v*`.
  - Để **tắt** _Prevent self-review_: bạn vừa bấm chạy vừa duyệt, bật lên thì không ai duyệt được.
- **Secret ký chỉ ở environment** (mục "Điều kiện một lần" ở trên). GitHub không cho đọc lại một
  secret: cần tệp `.pem` gốc để thêm vào environment, rồi mới xóa bản ở mức repo.
- **Ruleset cho tag** (Settings → Rules → Rulesets → New tag ruleset): mọi tag (ít nhất `v*`); chặn
  tạo, sửa, xóa và force push; chỉ _Repository admin_ được bỏ qua.
- **Kiểm tra bắt buộc trên `main`** (_Require status checks to pass_, nguồn _GitHub Actions_), đúng
  các tên sau:
  - `Frontend (lint · typecheck · test · build)`
  - `End-to-end (Playwright, mocked Gemini)`
  - `Rust (fmt · clippy · test) — ubuntu-24.04`
  - `Rust (fmt · clippy · test) — windows-latest`
  - `npm audit`
  - `cargo audit`
  - `Secrets in history (gitleaks)`
  - `Dependency review`

  Khi bạn gộp bằng quyền admin (vượt luật của `main`), các kiểm tra này chỉ còn là lời nhắc. Muốn
  chúng chặn thật thì phải đổi luật duyệt của `main` (xem mục trong audit).

- **Immutable releases** (Settings → General → Releases): bật trước bản 0.6.0. Bản phát hành tạo
  sau đó không bị thay tệp hay dời tag nữa; các bản cũ hơn vẫn sửa được.
- **CODEOWNERS:** tệp `.github/CODEOWNERS` giao cho bạn các đường dẫn nguy hiểm: workflow, script
  ký, `webupdate.rs`, `tauri.conf.json`, `capabilities/`, Cargo và npm, các script chạy lúc cài và
  dựng, cấu hình Claude Code (`.claude/`) và `scripts/agents/`. Tệp này **chỉ có tác dụng** khi luật
  của `main` bật **Require review from Code Owners**; nếu không, GitHub chỉ gợi ý bạn làm người
  duyệt. Pull request do chính bạn mở thì bạn không tự duyệt được, nên vẫn gộp bằng quyền admin như
  hiện nay.
- **Pull request từ fork** (Settings → Actions → General → _Fork pull request workflows_): chọn
  _Require approval for all external contributors_.

### Kiểm tra bộ cài đã tải (`SHA256SUMS.txt`)

Mỗi bản phát hành có `SHA256SUMS.txt` ghi mã SHA-256 của `.exe` và `.msi`. Trên Windows, mở
PowerShell trong thư mục chứa tệp vừa tải:

```powershell
Get-FileHash .\SimLab_0.6.0_x64-setup.exe
```

So cột `Hash` với dòng cùng tên trong `SHA256SUMS.txt` (chữ hoa hay thường đều được). Khác nhau thì
**không cài**. Tệp này nằm cùng trang với bộ cài, nên chỉ chống được việc ai đó tráo bộ cài về sau
khi đã bật Immutable releases.
