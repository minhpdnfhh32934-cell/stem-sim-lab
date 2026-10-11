# Prompt tự cài đặt — máy A (Lead)

**Dùng khi nào:** sau khi đã cài Claude Code và đăng nhập (bước 1–4 trong
`docs/TWO_MACHINE_WORKFLOW.md`), và sau khi PR #1 (các lệnh `/sl-*` + `scripts/agents/`) đã được
merge vào `main`. Làm máy này **trước** máy Builder: Lead tạo nhãn và issue kiểm tra kết nối.

**Cách dùng:**

1. Mở **PowerShell** (không phải Command Prompt `cmd`: ở `cmd`, `$HOME` không hoạt động) và tự
   đăng nhập GitHub bằng **tài khoản GitHub 1**. Claude không làm hộ được bước này vì cần trình duyệt. Dán
   **từng lệnh một**: `gh auth login` sẽ hỏi lại vài câu, nếu dán nhiều dòng cùng lúc thì các dòng
   sau bị coi là câu trả lời. Khi được hỏi _Authenticate Git with your GitHub credentials?_, gõ `Y`
   rồi Enter. Khi thấy _one-time code_, chép mã đó, nhấn Enter để mở trình duyệt, dán mã vào rồi bấm
   **Authorize**.
   ```powershell
   gh auth login --hostname github.com --git-protocol https --web
   ```
2. Mở Claude Code ở thư mục nhà (từng dòng một):
   ```powershell
   cd $HOME
   claude
   ```
3. Dán **toàn bộ** khung prompt bên dưới vào Claude. Không cần sửa gì.

---

```text
VAI TRÒ = lead

Bạn đang cài đặt máy này làm máy LEAD (lập kế hoạch, review) trong quy trình hai máy Claude Code
của dự án STEM Sim Lab (repo GitHub minhpdnfhh32934-cell/stem-sim-lab). Máy kia là BUILDER (viết
code), dùng một tài khoản Claude và một tài khoản GitHub khác. Hai máy kết nối với nhau CHỈ qua GitHub (issue, PR, nhãn), bằng script
scripts/agents/watch.ps1. Hướng dẫn đầy đủ: docs/TWO_MACHINE_WORKFLOW.md.

Quy tắc khi cài đặt:
- Hỏi tôi trước khi cài phần mềm (winget), trước khi tạo issue trên GitHub, và trước khi tạo
  Scheduled Task.
- Không sửa, commit hay push file nào trong repo. Bước này chỉ để cài đặt và kiểm tra.
- Không lưu, không in ra khóa API, token hay mật khẩu.
- Nếu một bước thất bại, dừng lại. Giải thích bằng tiếng Việt đơn giản (tôi là người mới) và nói
  tôi cần làm gì.
- Các lệnh PowerShell dưới đây có thể chạy qua: powershell -NoProfile -Command "..."

BƯỚC 1 — Công cụ. Chạy: git --version, gh --version, node --version, cargo --version,
claude --version. Node phải từ v22.12 trở lên. Thiếu công cụ nào thì đề xuất đúng lệnh winget
trong docs/TWO_MACHINE_WORKFLOW.md mục 1 (nếu repo chưa có trên máy thì dùng:
Git.Git, GitHub.cli, OpenJS.NodeJS.LTS, Rustlang.Rustup) và hỏi tôi trước khi chạy.

BƯỚC 2 — GitHub.
- gh auth status: phải đã đăng nhập. Nếu chưa, bảo tôi chạy gh auth login (ở trên) rồi đợi tôi.
- gh api user --jq .login: ghi nhớ tên tài khoản GitHub của máy này.
- gh repo view minhpdnfhh32934-cell/stem-sim-lab --json viewerPermission: phải là WRITE,
  MAINTAIN hoặc ADMIN.
- git config --global user.name và user.email: nếu trống, hỏi tôi giá trị rồi đặt.

BƯỚC 3 — Repo ở thư mục $HOME\stem-sim-lab.
- Chưa có: gh repo clone minhpdnfhh32934-cell/stem-sim-lab "$HOME\stem-sim-lab"
- Đã có: git -C "$HOME\stem-sim-lab" status. Nếu có thay đổi chưa commit, DỪNG và hỏi tôi.
  Không có thì git switch main rồi git pull.
- Kiểm tra có đủ các file .claude/commands/sl-plan.md, sl-implement.md, sl-review.md,
  scripts/agents/watch.ps1, scripts/agents/setup-labels.ps1. Thiếu file nào thì DỪNG: báo tôi
  rằng PR #1 chưa được merge vào main.
- Từ đây đọc docs/TWO_MACHINE_WORKFLOW.md và CLAUDE.md (mục Two-machine workflow) để hiểu quy
  trình.

BƯỚC 4 — Chạy thử dự án (trong thư mục repo): npm install, rồi npm run check.
Báo kết quả. Nếu lỗi, KHÔNG sửa code: chỉ ghi lại lỗi để báo tôi.

BƯỚC 5 — Nhãn và bảo vệ nhánh:
- powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\setup-labels.ps1
  Kiểm tra: gh label list phải có đủ 10 nhãn: needs-plan, plan, approved, in-progress,
  needs-review, changes-requested, ready-to-merge, needs-human, agent-failed, agent-ping.
- gh api repos/minhpdnfhh32934-cell/stem-sim-lab/branches/main/protection
  Nếu lỗi 404 (chưa bảo vệ nhánh), nhắc tôi làm mục 6.3 của docs/TWO_MACHINE_WORKFLOW.md
  trên trang GitHub. Đừng tự bật bằng API.

BƯỚC 6 — Chạy thử watcher, không làm gì thật:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead -Once -DryRun
Giải thích ngắn kết quả: watcher thấy việc nào và sẽ làm gì.

BƯỚC 7 — Kiểm tra kết nối hai máy:
- Hỏi tôi rồi tạo issue:
  gh issue create --title "Kiểm tra kết nối hai máy" --label agent-ping --body "Mỗi máy trả lời bằng một bình luận pong:<vai trò>."
  Sau đó chạy watcher thật một lần (bỏ -DryRun, giữ -Once). Kiểm tra: issue có bình luận pong:lead.
- Báo tôi: "Giờ chạy prompt docs/agents/builder/BOOTSTRAP_PROMPT.md trên máy Builder". Khi máy
  Builder xong, issue phải có CẢ pong:lead VÀ pong:builder từ HAI tài khoản GitHub khác nhau.

BƯỚC 8 — Cách bật watcher chạy liên tục. Đừng tự bật: hướng dẫn tôi hai cách và hỏi tôi chọn cách
nào.
(a) Mở một cửa sổ PowerShell riêng và để nó chạy:
    cd $HOME\stem-sim-lab
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead
(b) Tự chạy mỗi khi tôi đăng nhập Windows (Scheduled Task). Chỉ tạo khi tôi đồng ý:
    $repo = "$HOME\stem-sim-lab"
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -WorkingDirectory $repo -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$repo\scripts\agents\watch.ps1`" -Role lead"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName "StemSim-Claude-lead" -Action $action -Trigger $trigger -Settings $settings
    Kiểm tra: Get-ScheduledTask -TaskName "StemSim-Claude-lead" phải có State = Ready.
    Chạy ngay: Start-ScheduledTask -TaskName "StemSim-Claude-lead".
    Tắt: Unregister-ScheduledTask -TaskName "StemSim-Claude-lead" -Confirm:$false

BƯỚC 9 — Báo cáo cuối cùng bằng tiếng Việt, dạng checklist ✅/❌: công cụ, tài khoản GitHub (tên),
quyền repo, repo + file /sl-*, npm run check, nhãn (lead), bảo vệ nhánh (lead), dry run, kết nối
(pong). Thêm một dòng "Việc tôi cần làm tiếp".
```

---

**Kiểm tra đã thành công (sau khi làm xong cả hai máy):**

- Issue "Kiểm tra kết nối hai máy" có 2 bình luận: `pong:lead from @<tài khoản 1>` và
  `pong:builder from @<tài khoản 2>`.
- Mỗi máy có thư mục `stem-sim-lab\.agent-logs\`, trong đó có file `lead-watch.log` hoặc
  `builder-watch.log`.
- Thử thật: tạo một issue nhỏ (ví dụ "Sửa lỗi chính tả trong USER_GUIDE"), gắn nhãn
  `needs-plan`. Trong khoảng 5 phút, máy Lead đăng kế hoạch và đổi nhãn thành `plan`. Gắn
  `approved`, máy Builder mở PR. Máy Lead review PR. Bạn bấm Merge.
