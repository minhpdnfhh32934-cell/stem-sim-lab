# Tự cài đặt máy A — Lead (kế hoạch, review)

## Phần dành cho người dùng (Claude: bỏ qua phần này, làm theo phần "Hướng dẫn cho Claude Code")

Làm máy này **trước** máy Builder. Chỉ cần làm 3 việc, phần còn lại Claude tự làm:

1. Mở **PowerShell** (bấm phím Windows, gõ `PowerShell`, Enter; **không dùng `cmd`**). Chạy từng
   dòng một. Dòng nào báo _already installed_ thì đã có rồi, bỏ qua. Nếu `winget` hỏi đồng ý điều
   khoản, gõ `Y`.
   ```powershell
   winget install --id Git.Git -e
   ```
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```
   Nếu sau đó gõ `claude` mà bị báo _not recognized_ (trình cài báo `.local\bin is not in your
PATH`), chạy từng dòng sau. Dòng cuối phải in ra số phiên bản:
   ```powershell
   $bin = "$env:USERPROFILE\.local\bin"
   $old = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$old;$bin", "User")
   $env:Path += ";$bin"
   claude --version
   ```
2. Đóng PowerShell, mở lại, rồi chạy `cd $HOME` và `claude`. Đăng nhập **tài khoản Claude 1**.
3. Gửi file này cho Claude: dán **toàn bộ** nội dung file, hoặc kéo thả file vào Claude.

Trong lúc Claude làm, bạn chỉ cần:

- bấm **Yes** khi Claude Code hỏi quyền chạy lệnh. Chọn _"Yes, and don't ask again"_ thì sẽ ít bị
  hỏi hơn;
- bấm **Yes** khi Windows hiện hộp thoại quản trị (UAC) lúc cài phần mềm;
- khi Claude đưa **mã đăng nhập GitHub**: mở trang Claude đưa, đăng nhập **tài khoản GitHub 1**,
  dán mã rồi bấm **Authorize**.

Toàn bộ quá trình mất khoảng 20–40 phút (cài Build Tools và Rust là lâu nhất).

## Hướng dẫn cho Claude Code

VAI TRÒ = lead

Bạn là Claude Code chạy trên máy Windows của tôi. Hãy cài đặt máy này làm máy **LEAD** (lập kế
hoạch, review) trong quy trình hai máy của dự án STEM Sim Lab (repo GitHub
`minhpdnfhh32934-cell/stem-sim-lab`), **từ đầu đến cuối, không dừng lại hỏi ý kiến tôi**. Tôi gửi
file này tức là đã đồng ý cho mọi bước dưới đây, kể cả cài phần mềm, tạo nhãn, tạo issue, bật bảo
vệ nhánh và cài watcher chạy khi đăng nhập Windows. Máy kia là BUILDER (viết code), dùng tài khoản
Claude và tài khoản GitHub khác. Hai máy chỉ kết nối qua GitHub, bằng `scripts/agents/watch.ps1`.

Chỉ dừng lại và chờ tôi trong 3 trường hợp:

- (a) cần tôi bấm Authorize trên trình duyệt;
- (b) một lỗi mà bạn đã thử cách khác vẫn không qua được;
- (c) tài khoản GitHub không có quyền cần thiết.

Quy tắc:

- Chạy lệnh Windows qua `powershell -NoProfile -ExecutionPolicy Bypass -Command "..."`. Ở **đầu
  mỗi lệnh**, nạp lại PATH để thấy các công cụ vừa cài:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
- Không in ra, không lưu token, khóa API hay mật khẩu. Không sửa, commit hay push file nào của
  repo.
- Sau mỗi bước, in một dòng ✅/❌ bằng tiếng Việt đơn giản (tôi là người mới).

**BƯỚC 1 — Cài công cụ.** Với mỗi công cụ, kiểm tra trước, thiếu thì mới cài, bằng
`winget install --id <ID> -e --silent --accept-package-agreements --accept-source-agreements`:

- `git` → `Git.Git`
- `gh` → `GitHub.cli`
- `node` (phải ≥ v22.12) → `OpenJS.NodeJS.LTS`
- `cargo` → `Rustlang.Rustup`. Sau đó chạy `rustup default stable` nếu chưa có toolchain.
- Microsoft C++ Build Tools: nếu chưa có thư mục `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`,
  cài bằng `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --silent --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`.
  Báo tôi rằng có thể phải bấm Yes ở hộp thoại UAC.

Kiểm tra: `git --version`, `gh --version`, `node --version`, `cargo --version` đều in ra phiên bản.

**BƯỚC 2 — Đăng nhập GitHub.**

- Nếu `gh auth status` báo đã đăng nhập thì chuyển sang phần kiểm tra bên dưới.
- Nếu chưa: chạy **ở chế độ nền**
  `gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key`. Đọc mã 8 ký tự
  (dạng `XXXX-XXXX`) trong kết quả, đưa tôi mã đó cùng link `https://github.com/login/device`, và
  nhắc tôi đăng nhập **tài khoản GitHub 1**. Cứ 10 giây kiểm tra `gh auth status` một lần, tối đa
  10 phút. Nếu lệnh này báo lỗi vì không có cửa sổ terminal, bảo tôi tự chạy đúng lệnh đó trong
  một cửa sổ PowerShell khác (gõ `Y` khi được hỏi), rồi tiếp tục kiểm tra `gh auth status`.
- Sau đó chạy `gh auth setup-git`.
- Kiểm tra: `gh api user --jq .login` (ghi nhớ tên tài khoản), và
  `gh repo view minhpdnfhh32934-cell/stem-sim-lab --json viewerPermission` phải là `ADMIN`,
  `MAINTAIN` hoặc `WRITE`.
- Nếu `git config --global user.name` trống: đặt bằng `gh api user --jq '.name // .login'`. Nếu
  `user.email` trống: đặt thành `<id>+<login>@users.noreply.github.com`, trong đó `id` lấy từ
  `gh api user --jq .id`.

**BƯỚC 3 — Repo** ở `$HOME\stem-sim-lab`.

- Chưa có: `gh repo clone minhpdnfhh32934-cell/stem-sim-lab "$HOME\stem-sim-lab"`.
- Đã có: nếu `git status --porcelain` có thay đổi chưa commit thì DỪNG (trường hợp b). Không có
  thì `git switch main` rồi `git pull`.
- Phải có đủ: `.claude/commands/sl-plan.md`, `sl-implement.md`, `sl-review.md`,
  `scripts/agents/watch.ps1`, `scripts/agents/setup-labels.ps1`. Thiếu thì DỪNG, báo tôi:
  "PR #1 chưa được merge vào main — hãy merge PR #1 rồi gửi lại file này."
- Đọc `CLAUDE.md` (mục Two-machine workflow) và `docs/TWO_MACHINE_WORKFLOW.md`.

**BƯỚC 4 — Chạy thử dự án** (trong thư mục repo): `npm install`, rồi `npm run check`, rồi
`cargo test --manifest-path src-tauri/Cargo.toml`. Lần đầu mất 5–10 phút. Nếu lỗi: KHÔNG sửa
code, ghi lại lỗi vào báo cáo cuối và vẫn làm tiếp các bước sau.

**BƯỚC 5 — Nhãn và bảo vệ nhánh.**

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\setup-labels.ps1` phải in
  ra `OK: 10 labels`.
- Bảo vệ nhánh `main`: nếu
  `gh api repos/minhpdnfhh32934-cell/stem-sim-lab/branches/main/protection` báo 404, ghi file
  `.agent-logs\protection.json` (UTF-8; tạo thư mục `.agent-logs` nếu chưa có) với nội dung:
  ```json
  {
    "required_status_checks": {
      "strict": false,
      "contexts": [
        "Frontend (lint · typecheck · test · build)",
        "End-to-end (Playwright, mocked Gemini)",
        "Rust (fmt · clippy · test) — ubuntu-24.04",
        "Rust (fmt · clippy · test) — windows-latest"
      ]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }
  ```
  rồi chạy
  `gh api -X PUT repos/minhpdnfhh32934-cell/stem-sim-lab/branches/main/protection --input .agent-logs/protection.json`.
  Nếu báo 403/404 (tài khoản không phải admin): ghi ❌ và nhắc tôi làm mục 6.3 của
  `docs/TWO_MACHINE_WORKFLOW.md` bằng tài khoản chủ repo. Không dừng, làm tiếp.

**BƯỚC 6 — Chạy thử watcher:**
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead -Once -DryRun`.
Giải thích ngắn kết quả.

**BƯỚC 7 — Issue kiểm tra kết nối.**

- Nếu `gh issue list --label agent-ping --state open` chưa có issue nào, tạo issue:
  `gh issue create --title "Kiểm tra kết nối hai máy" --label agent-ping --body "Mỗi máy trả lời bằng một bình luận pong:<vai trò>."`
- Chạy watcher thật một lần:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead -Once`.
- Kiểm tra: `gh issue view <số> --comments` có bình luận `pong:lead`.

**BƯỚC 8 — Watcher tự chạy.**

- Tạo Scheduled Task (không cần quyền quản trị):
  ```powershell
  $repo = "$HOME\stem-sim-lab"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $repo -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$repo\scripts\agents\watch.ps1`" -Role lead"
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName "StemSim-Claude-lead" -Action $action -Trigger $trigger -Settings $settings -Force
  Start-ScheduledTask -TaskName "StemSim-Claude-lead"
  ```
- Nếu `Register-ScheduledTask` bị từ chối (Access denied): tạo file
  `$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StemSim-Claude-lead.cmd` có một dòng
  `start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\stem-sim-lab\scripts\agents\watch.ps1" -Role lead`,
  rồi chạy file đó một lần.
- Kiểm tra: sau khoảng 10 giây, `.agent-logs\lead-watch.log` có dòng `watching as @...`.

**BƯỚC 8b — Nhật ký phiên chung (Google Doc).** Tìm bằng kết nối Google Drive tài liệu có tên đúng
`STEM Sim Lab: Nhật ký phiên làm việc Máy A và Máy B` (`search_files`, `title = '…'`). Tìm thấy
đúng 1 tài liệu → ✅ và chỉ đọc, không sửa. Không có kết nối Google Drive / Google Docs, hoặc không
thấy tài liệu → ❌ và nhắc tôi: vào claude.ai → Settings → Connectors, bật **Google Drive** và
**Google Docs**, đăng nhập bằng tài khoản Google đã được chia sẻ tài liệu này. Không tự tạo tài liệu
mới. Cách ghi nhật ký cuối mỗi phiên: `.claude/commands/sl-log.md` (lệnh `/sl-log`).

**BƯỚC 9 — Báo cáo cuối cùng** bằng tiếng Việt, dạng checklist ✅/❌:

- công cụ;
- tài khoản GitHub (tên);
- quyền repo;
- repo + các lệnh `/sl-*`;
- `npm run check` và `cargo test`;
- nhãn;
- bảo vệ nhánh;
- issue ping (số issue + `pong:lead`);
- watcher (Scheduled Task hoặc Startup);
- nhật ký phiên chung (Google Doc).

Cuối báo cáo, ghi đúng dòng:
"Việc tiếp theo: gửi file docs/agents/builder/BOOTSTRAP_PROMPT.md cho Claude Code trên máy
Builder." Thêm cách tắt watcher:
`Unregister-ScheduledTask -TaskName "StemSim-Claude-lead" -Confirm:$false`, hoặc xóa file
`.cmd` trong thư mục Startup.
