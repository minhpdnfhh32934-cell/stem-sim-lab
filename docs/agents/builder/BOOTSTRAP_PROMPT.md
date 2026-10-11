# Tự cài đặt máy B — Builder (viết code)

## Phần dành cho người dùng (Claude: bỏ qua phần này, làm theo phần "Hướng dẫn cho Claude Code")

Làm máy này **sau** khi máy Lead đã cài xong (đã có issue "Kiểm tra kết nối hai máy"). Chỉ cần
làm 3 việc, phần còn lại Claude tự làm:

1. Mở **PowerShell** (không dùng `cmd`) và chạy từng dòng một. Nếu đã cài rồi thì bỏ qua.
   ```powershell
   winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
   irm https://claude.ai/install.ps1 | iex
   ```
2. Đóng PowerShell, mở lại, rồi chạy `cd $HOME` và `claude`. Đăng nhập **tài khoản Claude 2**.
3. Gửi file này cho Claude: dán **toàn bộ** nội dung file, hoặc kéo thả file vào Claude.

Trong lúc Claude làm, bạn chỉ cần:

- bấm **Yes** khi Claude Code hỏi quyền chạy lệnh. Chọn _"Yes, and don't ask again"_ thì sẽ ít bị
  hỏi hơn;
- bấm **Yes** khi Windows hiện hộp thoại quản trị (UAC) lúc cài phần mềm;
- khi Claude đưa **mã đăng nhập GitHub**: mở trang Claude đưa, đăng nhập **tài khoản GitHub 2**,
  dán mã rồi bấm **Authorize**.

Toàn bộ quá trình mất khoảng 20–40 phút (cài Build Tools và Rust là lâu nhất).

## Hướng dẫn cho Claude Code

VAI TRÒ = builder

Bạn là Claude Code chạy trên máy Windows của tôi. Hãy cài đặt máy này làm máy **BUILDER** (viết
code) trong quy trình hai máy của dự án STEM Sim Lab (repo GitHub
`minhpdnfhh32934-cell/stem-sim-lab`), **từ đầu đến cuối, không dừng lại hỏi ý kiến tôi**. Tôi gửi
file này tức là đã đồng ý cho mọi bước dưới đây, kể cả cài phần mềm, bình luận trên issue kiểm tra
và cài watcher chạy khi đăng nhập Windows. Máy kia là LEAD (lập kế hoạch, review), dùng tài khoản
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
  nhắc tôi đăng nhập **tài khoản GitHub 2**. Cứ 10 giây kiểm tra `gh auth status` một lần, tối đa
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

**BƯỚC 5 — Kiểm tra những gì máy Lead đã làm.**

- `gh label list` phải có `approved`, `in-progress`, `changes-requested`, `needs-review`,
  `needs-human`, `agent-failed`, `agent-ping`.
- `gh issue list --label agent-ping --state open` phải có issue "Kiểm tra kết nối hai máy", và
  issue đó phải có bình luận `pong:lead from @<tên>`. Tên đó phải **khác** tài khoản GitHub của
  máy này. Nếu trùng, DỪNG (trường hợp c) và báo tôi: hai máy đang dùng cùng một tài khoản GitHub.
- Thiếu nhãn hoặc thiếu issue: chờ máy Lead. Báo tôi "Máy Lead chưa cài xong", rồi cứ 1 phút
  kiểm tra lại một lần, tối đa 30 phút. Hết 30 phút thì DỪNG (trường hợp b).

**BƯỚC 6 — Chạy thử watcher:**
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role builder -Once -DryRun`.
Giải thích ngắn kết quả.

**BƯỚC 7 — Kết nối hai máy.**

- Chạy watcher thật một lần:
  `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role builder -Once`.
- Kiểm tra: `gh issue view <số> --comments` có CẢ `pong:lead` VÀ `pong:builder`, đến từ HAI tài
  khoản GitHub khác nhau. Nếu đủ: báo "✅ Hai máy đã kết nối" và đóng issue bằng
  `gh issue close <số>`.

**BƯỚC 8 — Watcher tự chạy.**

- Tạo Scheduled Task (không cần quyền quản trị):
  ```powershell
  $repo = "$HOME\stem-sim-lab"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $repo -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$repo\scripts\agents\watch.ps1`" -Role builder"
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName "StemSim-Claude-builder" -Action $action -Trigger $trigger -Settings $settings -Force
  Start-ScheduledTask -TaskName "StemSim-Claude-builder"
  ```
- Nếu `Register-ScheduledTask` bị từ chối (Access denied): tạo file
  `$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StemSim-Claude-builder.cmd` có một dòng
  `start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\stem-sim-lab\scripts\agents\watch.ps1" -Role builder`,
  rồi chạy file đó một lần.
- Kiểm tra: sau khoảng 10 giây, `.agent-logs\builder-watch.log` có dòng `watching as @...`.

**BƯỚC 9 — Báo cáo cuối cùng** bằng tiếng Việt, dạng checklist ✅/❌:

- công cụ;
- tài khoản GitHub (tên);
- quyền repo;
- repo + các lệnh `/sl-*`;
- `npm run check` và `cargo test`;
- nhãn của máy Lead;
- kết nối (`pong:lead` + `pong:builder`);
- watcher (Scheduled Task hoặc Startup).

Cuối báo cáo, ghi đúng dòng: "Xong! Thử một vòng: tạo issue nhỏ, gắn nhãn needs-plan → máy Lead
lập kế hoạch → bạn gắn approved → máy này viết code và mở PR → máy Lead review → bạn bấm Merge."
Thêm cách tắt watcher:
`Unregister-ScheduledTask -TaskName "StemSim-Claude-builder" -Confirm:$false`, hoặc xóa file
`.cmd` trong thư mục Startup.
