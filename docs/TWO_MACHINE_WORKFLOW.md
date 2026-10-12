# Hai Claude Code trên hai máy Windows: lập kế hoạch → triển khai → review

Hướng dẫn cho người mới. Làm lần lượt từng bước, mỗi bước có phần **Kiểm tra**: đạt kết quả như
mô tả thì mới làm bước tiếp theo.

## 0. Cách hai máy làm việc với nhau

| Máy                  | Tài khoản Claude | Vai trò                                                        | Lệnh                     |
| -------------------- | ---------------- | -------------------------------------------------------------- | ------------------------ |
| **Máy A — Lead**     | Tài khoản 1      | Lập kế hoạch, review                                           | `/sl-plan`, `/sl-review` |
| **Máy B — Builder**  | Tài khoản 2      | Viết code theo kế hoạch đã duyệt, mở PR                        | `/sl-implement`          |
| **Bạn (người dùng)** | —                | Duyệt kế hoạch (gắn nhãn `approved`), bấm Merge PR trên GitHub | —                        |

Hai máy **không nói chuyện trực tiếp** với nhau. Mọi thứ đi qua GitHub:

```
Máy A  /sl-plan "việc cần làm"   → tạo Issue #12 có kế hoạch (nhãn plan)
Bạn    đọc kế hoạch, gắn nhãn approved cho #12                  ← chốt chặn 1
Máy B  /sl-implement 12          → nhánh feat/12-..., commit, push, mở PR #13 (nhãn needs-review)
Máy A  /sl-review 13             → review trên PR (changes-requested hoặc ready-to-merge)
       (nếu cần sửa) Máy B /sl-implement 12 → sửa trên chính PR #13 → Máy A /sl-review 13
Bạn    bấm Merge trên GitHub                                     ← chốt chặn 2
```

"Bán tự động" ở đây có nghĩa là Claude tự đọc code, sửa code và chạy test. Còn những việc **đưa
ra ngoài** (tạo issue, mở PR, đăng review) thì Claude luôn hỏi trước và bạn bấm đồng ý. Không
Claude nào được merge, push thẳng lên `main` hay phát hành bản mới: các lệnh này bị chặn trong
`.claude/settings.json`.

**Quy tắc vàng:** mỗi issue chỉ có **một** nhánh, và nhánh đó chỉ do **một** máy (Builder) sửa.
Máy Lead chỉ đọc nhánh đó để review, không commit vào.

## 1. Cài công cụ (làm trên CẢ HAI máy)

Mở **PowerShell** (bấm phím Windows → gõ `PowerShell` → Enter) rồi dán từng dòng:

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Rustlang.Rustup -e
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Nếu muốn biết thêm về Rust, Build Tools và WebView2, xem `docs/SETUP_WINDOWS.md`.

**Đóng PowerShell rồi mở lại**, sau đó kiểm tra:

```powershell
git --version     # git version 2.x
gh --version      # gh version 2.x
node --version    # v22.12 trở lên
cargo --version   # cargo 1.x
```

**Kiểm tra:** cả 4 lệnh đều in ra số phiên bản. Nếu có lệnh báo _"is not recognized"_, hãy mở lại
PowerShell. Vẫn lỗi thì cài lại đúng công cụ đó.

## 2. Cài Claude Code (CẢ HAI máy)

```powershell
irm https://claude.ai/install.ps1 | iex
```

Đóng PowerShell, mở lại, rồi chạy:

```powershell
claude --version
claude doctor
```

**Kiểm tra:** `claude --version` in ra số phiên bản, và `claude doctor` không báo lỗi đỏ.

Lỗi hay gặp:

- `claude` _is not recognized_: thêm thư mục cài đặt vào PATH, rồi mở lại PowerShell:
  ```powershell
  [Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.local\bin", "User")
  ```
- Claude Code báo không tìm thấy **Git Bash**: chỉ đường dẫn cho nó, rồi mở lại PowerShell:
  ```powershell
  [Environment]::SetEnvironmentVariable("CLAUDE_CODE_GIT_BASH_PATH", "C:\Program Files\Git\bin\bash.exe", "User")
  ```

## 3. Đăng nhập Claude — mỗi máy một tài khoản

```powershell
claude
```

Lần đầu chạy, Claude Code hỏi cách đăng nhập. Chọn **tài khoản Claude** (Pro/Max), trình duyệt sẽ
mở ra để bạn đăng nhập:

- Máy A đăng nhập **tài khoản 1**.
- Máy B đăng nhập **tài khoản 2**.

Đã lỡ đăng nhập nhầm tài khoản thì gõ `/logout`, rồi gõ `/login` để đăng nhập lại.

**Kiểm tra:** trong Claude Code, gõ `/status`. Dòng tài khoản phải hiện **đúng email** của máy đó.
Gõ `/exit` để thoát.

> Mỗi tài khoản Claude thuộc về một người dùng. Không chia sẻ mật khẩu hay phiên đăng nhập giữa
> hai máy. Việc dùng hai tài khoản có phù hợp với điều khoản của Anthropic trong trường hợp của bạn
> hay không là điều **bạn tự kiểm tra** (Consumer Terms / Usage Policy). Tài liệu này không kết luận
> thay bạn.

## 4. Đăng nhập GitHub (CẢ HAI máy)

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
git config --global user.name  "Tên của bạn"
git config --global user.email "email-github-cua-ban@example.com"
```

`gh auth login` hiện một mã 8 ký tự và mở trình duyệt. Dán mã đó vào trang GitHub rồi bấm
**Authorize**.

**Thiết lập của dự án này:** mỗi máy dùng **một tài khoản GitHub riêng**, và cả hai tài khoản đã
là Collaborator của repo (quyền **Write** trở lên). Nhờ vậy:

- máy B (tài khoản GitHub 2) là người mở PR;
- máy A (tài khoản GitHub 1) **Approve** hoặc **Request changes** thật trên PR đó;
- GitHub không cho ai tự duyệt PR của chính mình, nên PR do máy A mở thì phải do máy B duyệt
  (hoặc ngược lại).

Mỗi máy đặt `user.name`/`user.email` theo **tài khoản GitHub của máy đó**, để lịch sử commit thể
hiện rõ máy nào đã làm.

**Kiểm tra:**

```powershell
gh auth status
gh repo view minhpdnfhh32934-cell/stem-sim-lab --json name,viewerPermission
```

Lệnh đầu phải có dòng `Logged in to github.com`. Lệnh sau phải có `"viewerPermission":"ADMIN"`
hoặc `"WRITE"`.

## 5. Tải repo về và chạy thử (CẢ HAI máy)

```powershell
cd $HOME
gh repo clone minhpdnfhh32934-cell/stem-sim-lab
cd stem-sim-lab
npm install
npm run check
```

**Kiểm tra:**

- `npm run check` kết thúc **không có lỗi** (dòng cuối của Vitest ghi `Tests ... passed`).
- `Test-Path .claude\commands\sl-plan.md` in ra `True`. Nếu ra `False`, nghĩa là nhánh chứa các
  lệnh này chưa được merge vào `main` (xem bước 6.1).

Thử Rust nếu muốn (lần đầu mất khoảng 5–10 phút):

```powershell
cd src-tauri; cargo test; cd ..
```

## 6. Thiết lập repo một lần (chỉ làm trên MÁY A)

### 6.1 Đưa các lệnh `/sl-*` vào `main`

Các file `.claude/settings.json`, `.claude/commands/sl-*.md` và tài liệu này nằm trong Pull
Request từ nhánh `claude/wizardly-galileo-k3vxcs` vào `main`. Hãy Merge PR đó (nếu đã bật bảo vệ
nhánh ở bước 6.3, tài khoản GitHub **không** mở PR phải Approve trước). Xong thì trên cả hai máy
chạy:

```powershell
cd $HOME\stem-sim-lab
git switch main
git pull
```

### 6.2 Tạo nhãn (label)

```powershell
cd $HOME\stem-sim-lab
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\setup-labels.ps1
```

Script tạo (hoặc cập nhật) 10 nhãn: `needs-plan`, `plan`, `approved`, `in-progress`,
`needs-review`, `changes-requested`, `ready-to-merge`, `needs-human`, `agent-failed`, `agent-ping`.
Chạy lại nhiều lần cũng không sao.

**Kiểm tra:** script in ra `OK: 10 labels`, và `gh label list` có đủ 10 nhãn đó.

### 6.3 Bảo vệ nhánh `main`

Trên GitHub: repo → **Settings → Branches → Add classic branch protection rule**:

1. _Branch name pattern_: `main`
2. Tích **Require a pull request before merging**.
   - _Required approvals_ = **1** (người duyệt phải là tài khoản GitHub còn lại).
   - Tích **Dismiss stale pull request approvals when new commits are pushed**, để khi Builder
     push bản sửa thì Lead phải review lại.
3. Tích **Require status checks to pass before merging**. Gõ tìm và thêm các check của CI:
   `Frontend (lint · typecheck · test · build)`, `End-to-end (Playwright, mocked Gemini)`, các
   dòng `Rust (fmt · clippy · test) — ...`. Một check chỉ hiện trong danh sách sau khi nó đã chạy ít
   nhất một lần trên một PR.
4. **Không** tích _Allow force pushes_.
5. Bấm **Create**.

**Kiểm tra:** chạy thử `git push origin main` từ máy B (trên một commit thử). GitHub phải từ chối
với thông báo _protected branch_. (Claude cũng bị chặn lệnh này ngay từ máy.)

## 7. Mở Claude đúng chỗ

Luôn mở Claude **trong thư mục repo**, nhờ vậy nó đọc được `CLAUDE.md` và các lệnh `/sl-*`:

```powershell
cd $HOME\stem-sim-lab
git switch main
git pull
claude
```

**Kiểm tra:** gõ `/sl` trong Claude, danh sách gợi ý phải hiện `/sl-plan`, `/sl-implement`,
`/sl-review` kèm mô tả.

Chế độ quyền (nhấn **Shift+Tab** để đổi qua lại, chế độ hiện tại hiển thị ở dưới ô nhập):

- **Máy A (Lead):** để chế độ mặc định. Lead chỉ đọc code, nên chỉ phải bấm đồng ý khi đăng issue
  hoặc review.
- **Máy B (Builder):** chọn **accept edits**. Claude được sửa file mà không hỏi từng lần. Các lệnh
  git/npm/cargo cơ bản đã được cho phép trong `.claude/settings.json`. Mở PR thì vẫn phải hỏi bạn.

Không dùng `--dangerously-skip-permissions`.

## 8. Một vòng làm việc đầy đủ (ví dụ)

**① Máy A — lập kế hoạch**

```
/sl-plan Thêm thử thách thứ hai cho chủ đề ném xiên
```

Claude đọc code, viết kế hoạch rồi hỏi bạn có cho tạo issue không. Bấm đồng ý.
**Kiểm tra:** Claude trả về link `https://github.com/minhpdnfhh32934-cell/stem-sim-lab/issues/<số>`.
Mở link, thấy kế hoạch bằng tiếng Việt và nhãn `plan`.

**② Bạn — duyệt.** Đọc kế hoạch trên GitHub. Đồng ý thì gắn nhãn `approved`, hoặc chạy trên
máy A:

```powershell
gh issue edit 12 --add-label approved
```

Muốn sửa kế hoạch thì viết bình luận vào issue, rồi chạy lại `/sl-plan 12` trên máy A.

**③ Máy B — triển khai**

```
/sl-implement 12
```

**Kiểm tra:** Claude báo `npm run check` đã đạt và trả về link PR. Trên GitHub, PR có nhãn
`needs-review`, phần mô tả có dòng `Closes #12`, và CI bắt đầu chạy (biểu tượng vàng, sau đó xanh).
Nếu issue chưa có nhãn `approved`, Claude sẽ dừng lại và báo cho bạn. Đó là hành vi đúng.

**④ Máy A — review**

```
/sl-review 13
```

**Kiểm tra:** PR có thêm một review bằng tiếng Việt. Mỗi điểm được đánh dấu 🔴 (bắt buộc sửa)
hoặc 🟡 (gợi ý). Nhãn PR đổi thành `changes-requested` hoặc `ready-to-merge`.

**⑤ Nếu cần sửa:** máy B chạy lại `/sl-implement 12`. Claude sửa trên **cùng** PR và ghi lại những
điểm đã sửa. Sau đó máy A chạy lại `/sl-review 13`.

**⑥ Bạn — merge.** Khi nhãn là `ready-to-merge` và CI xanh, bấm **Merge pull request** trên
GitHub. Sau đó cả hai máy chạy `git switch main; git pull`.

## 8b. Kết nối tự động hai máy (watcher)

**Hai Claude Code có "nói chuyện" trực tiếp với nhau được không?** Không. Hai máy dùng hai tài
khoản Claude khác nhau, mà Claude Code chỉ nhắn được giữa các phiên của **cùng một** tài khoản.
Phiên Claude trên cloud (phiên đã viết tài liệu này) cũng không làm "máy thứ ba" lâu dài được, vì
nó bị thu hồi khi không dùng. Vì vậy GitHub là đường nối duy nhất. Script
`scripts/agents/watch.ps1` giúp đường nối đó **gần như tự động**: cứ 5 phút, nó xem GitHub có
việc gì cho vai trò của máy mình không, rồi tự gọi Claude Code để làm.

| Nhãn trên GitHub                  | Máy nhận việc | Việc nó làm                                               |
| --------------------------------- | ------------- | --------------------------------------------------------- |
| Issue `needs-plan`                | Lead          | `/sl-plan <issue>`, sau đó đổi nhãn thành `plan`          |
| Issue `approved` (do **bạn** gắn) | Builder       | Gắn `in-progress`, chạy `/sl-implement <issue>`, mở PR    |
| PR `needs-review`                 | Lead          | `/sl-review <pr>`                                         |
| PR `changes-requested`            | Builder       | Sửa theo review trên cùng PR                              |
| Issue `agent-ping`                | Cả hai        | Bình luận `pong:lead` / `pong:builder` (kiểm tra kết nối) |

Hai chốt chặn của bạn vẫn giữ nguyên: **gắn `approved`** và **bấm Merge**. Watcher dừng tự động
và gắn nhãn `needs-human` khi một PR đã qua 3 vòng yêu cầu sửa, hoặc gắn `agent-failed` khi một
lần chạy Claude bị lỗi (xem log trong `.agent-logs\`). Gỡ nhãn đó đi thì watcher thử lại. Builder
sẽ bỏ qua một lượt nếu thư mục repo đang có thay đổi chưa commit (ví dụ bạn đang tự sửa).

**Cách nhanh nhất:** dùng prompt trong `docs/agents/lead/BOOTSTRAP_PROMPT.md` (máy A) và
`docs/agents/builder/BOOTSTRAP_PROMPT.md` (máy B). Dán prompt vào Claude
Code trên từng máy (Lead trước, Builder sau), Claude sẽ tự kiểm tra, tạo nhãn, chạy thử và kiểm
tra kết nối.

**Làm tay:**

```powershell
cd $HOME\stem-sim-lab
# Chạy thử: chỉ in ra việc sẽ làm, không làm gì thật
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead -Once -DryRun
# Chạy liên tục (để cửa sổ này mở). Máy B thay lead bằng builder
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\agents\watch.ps1 -Role lead
```

**Kiểm tra kết nối:** trên máy A, chạy
`gh issue create --title "Kiểm tra kết nối hai máy" --label agent-ping --body "ping"`.
Trong vòng 5 phút, issue đó phải có hai bình luận `pong:lead from @…` và `pong:builder from @…`,
đến từ hai tài khoản GitHub khác nhau.

Mỗi lần chạy, watcher dùng lượt của tài khoản Claude trên máy đó. Muốn dừng thì đóng cửa sổ
PowerShell, hoặc nhấn Ctrl+C.

## 9. Kiểm tra toàn bộ thiết lập (checklist)

- [ ] Cả hai máy: `git`, `gh`, `node`, `cargo`, `claude` đều in ra phiên bản.
- [ ] Máy A `/status` hiện tài khoản Claude 1, máy B hiện tài khoản 2.
- [ ] Cả hai máy: `gh auth status` có dòng _Logged in_, và quyền repo là `ADMIN`/`WRITE`.
- [ ] Cả hai máy: `npm run check` đạt trên `main`.
- [ ] Gõ `/sl` thấy đủ 3 lệnh.
- [ ] `gh label list` có đủ 10 nhãn.
- [ ] Issue `agent-ping` có cả `pong:lead` và `pong:builder`.
- [ ] Push thẳng lên `main` bị từ chối.
- [ ] Chạy thử một vòng ①→⑥ với một việc nhỏ (ví dụ: sửa một câu chữ trong tài liệu).

## 10. Gỡ rối

| Hiện tượng                                     | Cách xử lý                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Không thấy lệnh `/sl-*`                        | Chưa mở Claude trong thư mục repo, hoặc `main` chưa có `.claude/commands` (bước 6.1, `git pull`).               |
| `gh: To get started with GitHub CLI...`        | Chạy lại `gh auth login` (bước 4).                                                                              |
| `npm run check` báo lỗi Prettier trên mọi file | Repo đã có `.gitattributes` (LF). Chạy `git add --renormalize .` rồi `git status`; hỏi Claude nếu còn lỗi.      |
| Review báo không thể "request changes"         | Hai máy dùng cùng tài khoản GitHub. Bình thường, review sẽ được đăng dạng bình luận.                            |
| Hai máy cùng sửa một nhánh, bị xung đột        | Trái quy tắc vàng. Để máy B giữ nhánh; máy A chạy `git switch main` và không commit vào nhánh đó.               |
| Hết lượt dùng Claude trên một máy              | Đợi đến khi lượt được làm mới. Không đăng nhập tài khoản của máy kia để làm tiếp.                               |
| Claude hỏi quyền quá nhiều                     | Chỉ thêm lệnh **chỉ đọc** vào `allow` trong `.claude/settings.json`. Không thêm `gh pr merge`, push lên `main`. |

## 11. Chuyển công việc từ Cowork sang (`docs/HANDOFF.md`)

Nếu bạn làm một phần việc trong Claude Cowork, hãy dán prompt trong `docs/COWORK_HANDOFF_PROMPT.md`
vào Cowork. Cowork sẽ viết `docs/HANDOFF.md`: đã làm gì, quyết định gì, còn dở gì và cần làm gì
tiếp, rồi đưa file lên GitHub qua một PR. Sau khi PR đó được merge:

- máy A chạy `/sl-plan` (không kèm nội dung). Claude đọc `docs/HANDOFF.md` và đề xuất việc tiếp
  theo; bạn chọn việc nào thì chạy `/sl-plan <việc đó>`;
- `/sl-plan` và `/sl-implement` luôn đọc `docs/HANDOFF.md` trước khi làm.

**Kiểm tra:** sau `git pull` trên `main`, `Test-Path docs\HANDOFF.md` in ra `True`.

## 12. Ghi tiến độ

Sau mỗi PR được merge, Builder (hoặc bạn) thêm một dòng vào `docs/PROGRESS.md` như các bước trước
đây. Việc này giúp phiên Claude nào mở sau, trên máy nào, cũng biết dự án đang ở đâu.

## 13. Nhật ký phiên chung trên Google Drive (CẢ HAI máy)

Ngoài GitHub, hai máy ghi chung một Google Doc tên **"STEM Sim Lab: Nhật ký phiên làm việc Máy A và
Máy B"**: mỗi phiên làm việc xong, máy vừa làm thêm một mục (đã làm, kiểm tra đã chạy, việc còn dở)
và cập nhật bảng "Việc cần làm". Nhờ vậy bạn đọc một chỗ là biết hai máy đang ở đâu, kể cả khi một
máy hết lượt dùng giữa chừng.

**Cài một lần:**

1. Tài liệu nằm trong Google Drive của tài khoản máy A và đã chia sẻ quyền chỉnh sửa cho tài khoản
   Google của máy B. Link tài liệu **không** ghi trong repo (repo công khai).
2. Trên **mỗi** tài khoản Claude (máy A và máy B): claude.ai → Settings → Connectors → bật
   **Google Drive** và **Google Docs**, đăng nhập bằng tài khoản Google tương ứng. Thiếu Google Docs
   thì Claude chỉ đọc được, không thêm mục mới vào tài liệu được.
3. Nên tắt chế độ "Bất kỳ ai có đường liên kết": mở tài liệu → Chia sẻ → Quyền truy cập chung →
   **Bị hạn chế**. Chỉ hai tài khoản đã thêm mới mở được.

**Cách dùng:**

- `/sl-plan`, `/sl-implement`, `/sl-review` tự ghi nhật ký ở bước cuối.
- Phiên làm việc khác (không qua `/sl-*`): gõ `/sl-log` trước khi kết thúc, có thể kèm ghi chú,
  ví dụ `/sl-log đã thử Gemma 1B`.
- Watcher chạy không người trông (`claude -p`) thường không dùng được kết nối Google: khi đó mục nhật
  ký được ghi tạm vào `.agent-logs/session-log-pending.md` và đăng thành bình luận trên issue/PR; lần
  `/sl-log` tiếp theo trên máy đó sẽ chép lên tài liệu.
- Claude chỉ coi nhật ký là thông tin. Việc cần làm vẫn giao qua issue có nhãn `approved`.

**Kiểm tra:** trên mỗi máy, mở Claude Code trong repo và gõ `/sl-log thử kết nối` → tài liệu có
thêm một mục mới ở đầu phần "Nhật ký phiên".
