# Tự cài đặt máy B — Builder (viết code)

## Phần dành cho người dùng (Claude: bỏ qua phần này, làm theo phần "Hướng dẫn cho Claude Code")

Máy B chỉ cần **có Claude Code**. Claude sẽ tự kiểm tra và cài mọi thứ còn lại.

**Trước khi bắt đầu:**

- Máy A (Lead) đã cài xong. Issue kiểm tra kết nối đã có bình luận `pong:lead`.
- **Tài khoản GitHub 2** (khác `minhpdnfhh32934-cell`) đã được mời làm Collaborator của repo.
  Nếu tài khoản này chưa bấm Accept lời mời thì không sao, Claude sẽ tự chấp nhận.

**Cách dùng:**

1. Chuyển file này sang máy B (Zalo, email, USB, Google Drive...) và lưu vào thư mục
   **Downloads**, giữ nguyên tên `BOOTSTRAP_PROMPT.md`.
2. Trên máy B, mở **PowerShell** (bấm phím Windows, gõ `PowerShell`, Enter) rồi chạy:
   ```powershell
   cd $HOME
   ```
   ```powershell
   claude
   ```
3. Kiểm tra Claude đang dùng **gói Pro/Max của tài khoản Claude 2**: dòng thứ hai trên màn hình
   chào phải ghi `Claude Pro` hoặc `Claude Max`, **không** ghi `API Usage Billing`. Nếu sai, gõ
   `/logout`, mở lại `claude`, rồi chọn **Claude account with subscription**.
4. Gõ vào Claude:
   ```
   Làm theo đúng và đầy đủ file Downloads\BOOTSTRAP_PROMPT.md
   ```

**Trong lúc Claude làm, bạn chỉ cần:**

- bấm **Yes** khi Claude Code hỏi quyền chạy lệnh (chọn _"Yes, and don't ask again"_ để ít bị hỏi);
- bấm **Yes** khi Windows hiện hộp thoại quản trị (UAC);
- đăng nhập GitHub khi Claude nhờ. Lưu ý:
  - **mã 8 ký tự hiện trong cửa sổ lệnh, GitHub không gửi mã qua email**;
  - trang GitHub phải ghi _Signed in as \<tài khoản GitHub 2\>_. Nếu ghi `minhpdnfhh32934-cell`,
    bấm ảnh đại diện → **Sign out** rồi đăng nhập lại bằng tài khoản 2;
- trả lời một câu hỏi ở cuối: có bật watcher tự chạy hay không.

Mất khoảng 20–40 phút. Cài Build Tools và Rust là lâu nhất.

## Hướng dẫn cho Claude Code

VAI TRÒ = builder

Bạn là Claude Code trên một máy Windows **mới**, có thể chưa cài gì ngoài bạn. Hãy cài đặt máy này
làm máy **BUILDER** (viết code) của dự án STEM Sim Lab (repo GitHub
`minhpdnfhh32934-cell/stem-sim-lab`), **từ đầu đến cuối, không dừng lại hỏi ý kiến tôi**. Tôi gửi
file này tức là đã đồng ý cho mọi bước dưới đây. Máy A là LEAD (lập kế hoạch, review), dùng tài
khoản GitHub `minhpdnfhh32934-cell`. Hai máy chỉ nối với nhau qua GitHub (issue, PR, nhãn), bằng
script `scripts/agents/watch.ps1`.

**Chỉ dừng lại** khi:

- (a) cần tôi đăng nhập trên trình duyệt;
- (b) gặp lỗi mà thử cách khác vẫn không qua;
- (c) tài khoản GitHub sai hoặc thiếu quyền;
- (d) tới câu hỏi duy nhất ở Bước 10.

**Quy tắc:**

- Chạy lệnh Windows bằng PowerShell. Nếu bạn có công cụ PowerShell thì dùng nó, nếu không thì
  dùng `powershell -NoProfile -ExecutionPolicy Bypass -Command "..."`. Ở **đầu mỗi lệnh**, nạp lại
  PATH để thấy các công cụ vừa cài:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- Không in ra, không lưu token, khóa API hay mật khẩu. Không sửa, commit hay push file nào của
  repo. Không chạy `npm audit fix`.
- Sau mỗi bước, in một dòng ✅/❌/⚠️ bằng tiếng Việt đơn giản (tôi là người mới).

**BƯỚC 1 — Kiểm tra máy.**

- `winget --version`. Nếu không có: DỪNG (b), bảo tôi cài **App Installer** từ Microsoft Store
  rồi gửi lại file này.
- `[bool]$env:ANTHROPIC_API_KEY`, và
  `[bool][Environment]::GetEnvironmentVariable('ANTHROPIC_API_KEY','User')`. Nếu có giá trị nào
  là `True`: ⚠️ cảnh báo tôi rằng Claude Code có thể đang tính tiền theo API thay vì dùng gói Pro.
  Chỉ tôi cách gỡ:
  `[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')`, rồi mở lại
  `claude`. Không in giá trị khóa ra. Sau đó làm tiếp.
- Đảm bảo `claude` chạy được từ một cửa sổ PowerShell mới, vì watcher cần lệnh này. Nếu
  `$env:USERPROFILE\.local\bin\claude.exe` tồn tại mà thư mục `$env:USERPROFILE\.local\bin` chưa
  có trong PATH của **User**, thêm nó vào:
  `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';' + "$env:USERPROFILE\.local\bin", 'User')`.
  Nếu không tìm thấy `claude.exe` ở đó, dùng `(Get-Command claude).Source` để biết thư mục của
  nó.

**BƯỚC 2 — Cài công cụ.** Với mỗi công cụ, kiểm tra trước, thiếu thì mới cài, bằng
`winget install --id <ID> -e --silent --accept-package-agreements --accept-source-agreements`:

- `git` → `Git.Git`
- `gh` → `GitHub.cli`
- `node` (phải ≥ v22.12) → `OpenJS.NodeJS.LTS`
- `cargo` → `Rustlang.Rustup`. Sau đó chạy `rustup default stable` nếu chưa có toolchain.
- Microsoft C++ Build Tools (Rust cần), nếu chưa có thư mục
  `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`:
  `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`.
  Báo tôi rằng có thể phải bấm Yes ở hộp thoại UAC. Nếu cài Build Tools hoặc Rust bị lỗi: ghi ⚠️
  rồi làm tiếp, vì việc kết nối hai máy không cần chúng.

Kiểm tra: `git --version`, `gh --version`, `node --version` đều in ra phiên bản (`cargo` nếu đã
cài được).

**BƯỚC 3 — Đăng nhập GitHub bằng tài khoản GitHub 2.**

- `gh auth status`. Nếu đã đăng nhập, kiểm tra `gh api user --jq .login`:
  - là `minhpdnfhh32934-cell` (tài khoản của máy A): chạy
    `gh auth logout --hostname github.com` rồi đăng nhập lại như dưới đây;
  - là tài khoản khác: chuyển sang phần "Sau khi đăng nhập".
- Đăng nhập: chạy **ở chế độ nền**
  `gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key`. Đọc mã dạng
  `XXXX-XXXX` trong kết quả, đưa tôi mã đó cùng link `https://github.com/login/device`. Dặn tôi:
  trang phải ghi _Signed in as_ **tài khoản GitHub 2**. Nếu trang ghi `minhpdnfhh32934-cell` thì
  phải Sign out trước, rồi dán mã, bấm **Continue**, rồi **Authorize**. Cứ 10 giây kiểm tra
  `gh auth status` một lần, tối đa 10 phút.
- Nếu lệnh báo lỗi vì không có cửa sổ terminal: bảo tôi mở **một cửa sổ PowerShell khác** và tự
  chạy đúng lệnh `gh auth login --hostname github.com --git-protocol https --web`. Dặn tôi thêm:
  gõ `Y` khi được hỏi, và mã hiện trong chính cửa sổ đó. Sau đó tiếp tục kiểm tra
  `gh auth status`.
- **Sau khi đăng nhập:** chạy `gh auth setup-git`. `gh api user --jq .login` phải **khác**
  `minhpdnfhh32934-cell`. Nếu vẫn trùng: DỪNG (c) và giải thích rằng máy B phải dùng tài khoản
  GitHub thứ hai.

**BƯỚC 4 — Quyền vào repo.**

- Tự chấp nhận lời mời nếu có:
  `gh api user/repository_invitations --jq '.[] | [.id, .repository.full_name] | @tsv'`. Lệnh này
  in mỗi lời mời trên một dòng, gồm `id` và tên repo. Viết jq không dùng dấu `"`, vì Windows
  PowerShell 5.1 làm mất dấu nháy kép khi truyền cho `gh`. Nếu có dòng nào ghi
  `minhpdnfhh32934-cell/stem-sim-lab`, chạy `gh api -X PATCH user/repository_invitations/<id>`
  với `id` của dòng đó.
- `gh repo view minhpdnfhh32934-cell/stem-sim-lab --json viewerPermission` phải là `WRITE`,
  `MAINTAIN` hoặc `ADMIN`. Nếu không: DỪNG (c) và báo tôi rằng trên máy A, chủ repo phải mời tài
  khoản này. Chỉ đường: repo → **Settings → Collaborators → Add people**, quyền **Write**.

**BƯỚC 5 — Tên và email cho git.** Nếu `git config --global user.name` trống, đặt bằng
`gh api user --jq .login`. Nếu `user.email` trống, đặt thành
`<id>+<login>@users.noreply.github.com`, trong đó `id` lấy từ `gh api user --jq .id`.

**BƯỚC 6 — Repo** ở `$HOME\stem-sim-lab`.

- Chưa có: `gh repo clone minhpdnfhh32934-cell/stem-sim-lab "$HOME\stem-sim-lab"`.
- Đã có: nếu `git status --porcelain` có thay đổi chưa commit thì DỪNG (b). Không có thì
  `git switch main` rồi `git pull`.
- Phải có đủ: `.claude/commands/sl-implement.md` và `scripts/agents/watch.ps1`.
- Chạy `npm install`. Cảnh báo kiểu _N high severity vulnerability_ là bình thường, bỏ qua.
- Đọc `CLAUDE.md` (mục Two-machine workflow) và `docs/TWO_MACHINE_WORKFLOW.md`.

**BƯỚC 7 — Chạy thử dự án.**

- `npm run check`. Lệnh mất 3–5 phút, phải chờ cho tới khi chạy xong.
- Nếu đã có `cargo`: chạy `cargo test --manifest-path src-tauri/Cargo.toml` (lần đầu mất 5–10
  phút).
- Nếu lỗi: KHÔNG sửa code, ghi lại lỗi vào báo cáo cuối và vẫn làm tiếp.

**BƯỚC 8 — Kiểm tra những gì máy Lead đã làm.**

- `gh label list` phải có `approved`, `in-progress`, `changes-requested`, `needs-review`,
  `needs-human`, `agent-failed`, `agent-ping`.
- `gh issue list --label agent-ping --state open` phải có issue (thường là #2), và issue đó phải
  có bình luận `pong:lead from @minhpdnfhh32934-cell`.
- Thiếu nhãn hoặc thiếu issue: báo tôi "Máy Lead chưa cài xong". Nhắc tôi trên máy A chạy
  `gh issue create -t "Kiểm tra kết nối hai máy" -l agent-ping -b ping`, rồi
  `.\scripts\agents\watch.ps1 -Role lead -Once`. Sau đó cứ 1 phút kiểm tra lại một lần, tối đa 30
  phút. Hết 30 phút thì DỪNG (b).

**BƯỚC 9 — Kết nối hai máy.**

- Chạy trong thư mục repo:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role builder -Once`.
  Kết quả phải có dòng `answered ping on issue #<số>`.
- `gh issue view <số> --comments` phải có CẢ `pong:lead` VÀ `pong:builder`, đến từ HAI tài
  khoản GitHub khác nhau. Nếu đủ: báo "✅ Hai máy đã kết nối", rồi `gh issue close <số>`.
- Nếu thấy dòng `skip cycle: the working tree has uncommitted changes`: chạy `git status`, báo
  tôi file nào bị thay đổi, và DỪNG (b).

**BƯỚC 10 — Watcher tự chạy (câu hỏi duy nhất).** Hỏi tôi đúng một câu: "Bật watcher tự chạy
mỗi khi đăng nhập Windows không? Mỗi lần có việc (issue có nhãn approved, PR có nhãn
changes-requested), máy này sẽ gọi Claude và tốn lượt dùng của tài khoản Claude 2." Mặc định là
**không**.

- **Có:** tạo file
  `$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StemSim-builder.cmd` có đúng một
  dòng:
  `start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\stem-sim-lab\scripts\agents\watch.ps1" -Role builder`.
  Chạy file đó một lần. Sau khoảng 10 giây, `.agent-logs\builder-watch.log` phải có dòng
  `watching as @...`.
- **Không:** chỉ tôi cách chạy tay khi cần, gồm 3 lệnh: `cd $HOME\stem-sim-lab`, rồi
  `Set-ExecutionPolicy -Scope Process Bypass`, rồi `.\scripts\agents\watch.ps1 -Role builder -Once`.

**BƯỚC 11 — Báo cáo cuối cùng** bằng tiếng Việt, dạng checklist ✅/❌/⚠️:

- máy (winget, khóa API);
- công cụ;
- tài khoản GitHub (tên);
- quyền repo;
- repo + `npm install`;
- `npm run check` và `cargo test`;
- nhãn của máy Lead;
- kết nối (`pong:lead` + `pong:builder`);
- watcher.

Cuối báo cáo, thêm các dòng sau:

- "Dùng hằng ngày: `cd $HOME\stem-sim-lab`, rồi `claude`, rồi `/sl-implement <số issue>`. Issue
  phải có nhãn approved."
- Nếu repo đang có PR mở chờ duyệt (`gh pr list --state open`), nhắc tôi rằng tài khoản này có thể
  vào duyệt (Approve) các PR do máy A mở.
- Nếu đã bật watcher: cách tắt là xóa file `StemSim-builder.cmd` trong thư mục Startup (mở thư
  mục đó bằng lệnh `explorer shell:startup`).
