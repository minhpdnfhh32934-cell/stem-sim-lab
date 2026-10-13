# Cài máy B — Builder bằng tay, từ đầu đến cuối

Hướng dẫn này **không cần Claude** chạy hộ, nên không tốn lượt dùng. Làm xong, máy B được nối với
máy A qua GitHub. Máy A (Lead) đã cài xong từ trước, và đã có issue kiểm tra kết nối
[#2](https://github.com/minhpdnfhh32934-cell/stem-sim-lab/issues/2).

**Cần chuẩn bị:**

- **Tài khoản Claude 2** (gói Pro/Max), khác tài khoản của máy A.
- **Tài khoản GitHub 2**, khác `minhpdnfhh32934-cell`, đã được mời làm Collaborator của repo và đã
  bấm **Accept** lời mời.

## Quy tắc khi dán lệnh (đọc trước, tránh lỗi đã gặp ở máy A)

1. Dùng **PowerShell**, không dùng `cmd`. Mở bằng cách bấm phím Windows, gõ `PowerShell`, rồi
   Enter. Đầu dòng phải là `PS C:\Users\...>`. Nếu đang ở `cmd`, gõ `powershell` rồi Enter để chuyển.
2. Mỗi khung lệnh dán **một lần**. Chép bằng **nút Copy** ở góc khung. Đừng bôi đen để chép, vì
   dòng dài dễ bị cắt đôi.
3. Chờ lệnh trước chạy xong (thấy lại `PS ...>`) rồi mới dán lệnh sau.
4. Mỗi bước có phần **Kiểm tra**. Phải đúng như mô tả thì mới làm bước tiếp theo.

## Bước 1 — Công cụ

Chạy lần lượt 3 lệnh:

```powershell
git --version
```

```powershell
gh --version
```

```powershell
node --version
```

Lệnh nào báo _not recognized_ thì cài công cụ đó (gõ `Y` nếu được hỏi đồng ý điều khoản):

| Thiếu  | Lệnh cài                                   |
| ------ | ------------------------------------------ |
| `git`  | `winget install --id Git.Git -e`           |
| `gh`   | `winget install --id GitHub.cli -e`        |
| `node` | `winget install --id OpenJS.NodeJS.LTS -e` |

Cài xong thì **đóng PowerShell, mở lại**, rồi chạy lại 3 lệnh kiểm tra ở trên.

**Kiểm tra:** cả 3 lệnh đều in ra số phiên bản, và `node` phải từ `v22.12` trở lên.

## Bước 2 — Claude Code

```powershell
irm https://claude.ai/install.ps1 | iex
```

Đóng PowerShell, mở lại, rồi chạy:

```powershell
claude --version
```

Nếu lệnh báo _not recognized_ (trình cài có ghi `.local\bin is not in your PATH`), dán lần lượt
4 dòng sau, rồi chạy lại `claude --version`:

```powershell
$bin = "$env:USERPROFILE\.local\bin"
```

```powershell
$old = [Environment]::GetEnvironmentVariable("Path", "User")
```

```powershell
[Environment]::SetEnvironmentVariable("Path", "$old;$bin", "User")
```

```powershell
$env:Path += ";$bin"
```

**Kiểm tra:** `claude --version` in ra dạng `2.x.x (Claude Code)`.

## Bước 3 — Đăng nhập Claude bằng tài khoản Claude 2

```powershell
claude
```

- Chọn **Claude account with subscription**. **Không** chọn _Anthropic Console account_, vì loại
  đó tính tiền theo từng lượt API.
- Trình duyệt mở ra: đăng nhập **tài khoản Claude 2**, rồi bấm **Authorize**.

**Kiểm tra:** dòng thứ hai trong màn hình chào của Claude phải ghi **Claude Pro** (hoặc Claude
Max), **không** ghi `API Usage Billing`. Gõ `/status` để xem email có đúng tài khoản 2 không.

Nếu vẫn ghi `API Usage Billing`: gõ `/logout`, mở lại `claude` và chọn lại cho đúng. Xong thì gõ
`/exit` để thoát Claude.

## Bước 4 — Đăng nhập GitHub bằng tài khoản GitHub 2

```powershell
gh auth login --hostname github.com --git-protocol https --web
```

1. Khi được hỏi _Authenticate Git with your GitHub credentials?_, gõ `Y` rồi Enter.
2. PowerShell hiện dòng `! One-time code (XXXX-XXXX) copied to clipboard`. **Mã nằm ở đây,
   GitHub không gửi mã qua email.**
3. Nhấn Enter để mở trình duyệt. Nếu trang ghi _Signed in as minhpdnfhh32934-cell_, đó là **sai
   tài khoản**. Bấm vào ảnh đại diện → **Sign out**, rồi đăng nhập **tài khoản GitHub 2**.
4. Dán mã (Ctrl+V), bấm **Continue**, rồi bấm **Authorize github**.

**Kiểm tra:**

```powershell
gh api user --jq .login
```

Lệnh phải in ra tên **tài khoản GitHub 2**, **không phải** `minhpdnfhh32934-cell`.

```powershell
$repo = "minhpdnfhh32934-cell/stem-sim-lab"
```

```powershell
gh repo view $repo --json viewerPermission
```

Kết quả phải có `"WRITE"`, `"MAINTAIN"` hoặc `"ADMIN"`. Nếu báo lỗi _Could not resolve_ hoặc
không có quyền: tài khoản 2 chưa bấm **Accept** lời mời Collaborator. Mở
<https://github.com/minhpdnfhh32934-cell/stem-sim-lab/invitations> bằng tài khoản 2 để chấp nhận.

## Bước 5 — Tên và email cho git

```powershell
$login = gh api user --jq .login
```

```powershell
$id = gh api user --jq .id
```

```powershell
git config --global user.name $login
```

```powershell
git config --global user.email "$id+$login@users.noreply.github.com"
```

**Kiểm tra:**

```powershell
git config --global user.email
```

Phải in ra địa chỉ có đuôi `@users.noreply.github.com`, với tên tài khoản GitHub 2 trong đó.

## Bước 6 — Tải repo và thư viện

Nếu đã đóng PowerShell sau Bước 4, gõ lại dòng `$repo = ...` ở Bước 4 trước.

```powershell
gh repo clone $repo "$HOME\stem-sim-lab"
```

```powershell
cd $HOME\stem-sim-lab
```

```powershell
npm install
```

**Kiểm tra:**

```powershell
Test-Path .\scripts\agents\watch.ps1
```

Phải in ra `True`.

- Thấy cảnh báo _1 high severity vulnerability_: bình thường. **Đừng** chạy `npm audit fix`.
- Nếu `gh repo clone` báo _already exists_: chạy `git -C "$HOME\stem-sim-lab" pull`, rồi làm tiếp
  `cd` như trên.

## Bước 7 — (Nên làm) Chạy kiểm tra dự án

```powershell
npm run check
```

Lệnh này mất **3–5 phút** và có lúc không in ra gì. **Đừng bấm Ctrl+C.**

**Kiểm tra:** ở cuối có `Tests ... passed` và không có chữ `failed` màu đỏ. Nếu có lỗi đỏ, chụp màn
hình lại rồi vẫn làm tiếp các bước sau, vì việc kết nối hai máy không phụ thuộc vào bước này.

## Bước 8 — Nối với máy A ("pong")

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

Gõ `Y` nếu được hỏi. Lệnh này chỉ áp dụng cho cửa sổ PowerShell này.

```powershell
.\scripts\agents\watch.ps1 -Role builder -Once
```

**Kiểm tra:** màn hình hiện:

```
[builder] watching as @<tài khoản GitHub 2>, every 5 min
[builder] answered ping on issue #2
```

Sau đó kiểm tra lại trên GitHub:

```powershell
gh issue view 2 --comments
```

Phải có **cả hai** bình luận: `pong:lead from @minhpdnfhh32934-cell` và
`pong:builder from @<tài khoản GitHub 2>`. Có đủ cả hai là **hai máy đã kết nối** 🎉. Đóng
issue kiểm tra:

```powershell
gh issue close 2
```

Nếu màn hình ghi `skip cycle: the working tree has uncommitted changes`: chạy `git status` để xem
file nào bị thay đổi, chụp màn hình lại để hỏi.

## Bước 9 — (Khi đã sẵn sàng) Cho watcher tự chạy

Watcher gọi Claude mỗi khi có việc, nên **tốn lượt dùng Claude** của tài khoản 2. Lúc đầu có thể
bỏ qua bước này và chạy tay `.\scripts\agents\watch.ps1 -Role builder -Once` khi cần.

**Cách 1 — chạy trong một cửa sổ riêng** (đóng cửa sổ thì watcher dừng):

```powershell
cd $HOME\stem-sim-lab
```

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

```powershell
.\scripts\agents\watch.ps1 -Role builder
```

**Cách 2 — tự chạy mỗi khi đăng nhập Windows:** mở thư mục Startup.

```powershell
explorer shell:startup
```

Tạo file `StemSim-builder.cmd` trong thư mục vừa mở (chuột phải → New → Text Document, đổi tên cả
đuôi `.txt` thành `.cmd`). Mở file bằng Notepad và dán đúng một dòng:

```
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\stem-sim-lab\scripts\agents\watch.ps1" -Role builder
```

Lưu lại. Muốn tắt watcher thì xóa file này.

**Kiểm tra:** nhấp đúp vào file `.cmd`. Khoảng 10 giây sau, file
`$HOME\stem-sim-lab\.agent-logs\builder-watch.log` có dòng `watching as @...`.

## Xong — dùng hằng ngày

- **Tự động:** máy B nhận các issue có nhãn `approved` (do bạn gắn), viết code và mở PR. Nó cũng
  tự sửa các PR có nhãn `changes-requested`.
- **Làm tay:** `cd $HOME\stem-sim-lab`, rồi `claude`, rồi gõ `/sl-implement <số issue>`.
- **Trước khi làm tay**, luôn cập nhật code mới nhất:

  ```powershell
  git switch main
  ```

  ```powershell
  git pull
  ```

Xem thêm quy trình đầy đủ trong `docs/TWO_MACHINE_WORKFLOW.md`, mục 8 và 8b.
