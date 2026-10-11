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
gh label create plan              --color 1D76DB --description "Kế hoạch do máy Lead viết"
gh label create approved          --color 0E8A16 --description "Người dùng đã duyệt kế hoạch"
gh label create needs-review      --color FBCA04 --description "PR chờ máy Lead review"
gh label create changes-requested --color D93F0B --description "Review yêu cầu sửa"
gh label create ready-to-merge    --color 5319E7 --description "Review đạt, chờ người dùng merge"
```

**Kiểm tra:** `gh label list` hiện đủ 5 nhãn trên. Nếu nhãn đã có sẵn, lệnh sẽ báo _already
exists_. Không sao, bỏ qua.

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

## 9. Kiểm tra toàn bộ thiết lập (checklist)

- [ ] Cả hai máy: `git`, `gh`, `node`, `cargo`, `claude` đều in ra phiên bản.
- [ ] Máy A `/status` hiện tài khoản Claude 1, máy B hiện tài khoản 2.
- [ ] Cả hai máy: `gh auth status` có dòng _Logged in_, và quyền repo là `ADMIN`/`WRITE`.
- [ ] Cả hai máy: `npm run check` đạt trên `main`.
- [ ] Gõ `/sl` thấy đủ 3 lệnh.
- [ ] `gh label list` có đủ 5 nhãn.
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
