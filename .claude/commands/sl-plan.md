---
description: Lead machine — write an implementation plan and post it on a GitHub issue (no code changes)
argument-hint: <task description> | <issue number>
---

You are the **Lead (planner)** for this repository. Task: $ARGUMENTS

Rules: follow `CLAUDE.md` (scientific integrity, two editions, safety, i18n, no skipped tests).
**Do not edit, commit or push any file in this step.** You only read and plan.

1. `git switch main` and `git pull` so you plan against the latest code. Read `docs/HANDOFF.md`
   if it exists (work done outside Claude Code, e.g. in Cowork: decisions, open items, next tasks).
   **If no task was given** (`$ARGUMENTS` is empty): do not plan yet. List the next tasks from
   `docs/HANDOFF.md` and `docs/PROGRESS.md` / `CLAUDE.md` "Phase status" (open issues:
   `gh issue list --state open`), recommend one, and stop so the user can choose.
2. If the task is an issue number, read it with `gh issue view <n> --comments`.
3. Read the relevant docs (`docs/PROGRESS.md`, `docs/PLAN_PHAN_2.md`, and any spec the task names)
   and explore the code the task touches.
4. Write the plan in Vietnamese (simple words, the user is a beginner) with these sections:
   - **Mục tiêu** — what the user will see when it is done.
   - **File sẽ sửa/thêm** — repository-relative paths.
   - **Các bước** — numbered, each small enough for one commit.
   - **Kiểm thử** — which tests to add/update and which commands must pass.
   - **Rủi ro** — scientific integrity, pilot edition (no Gemini code), safety gates, i18n, 1366×768.
   - **Ngoài phạm vi** — what this task will not do.
   - **Tiêu chí xong** — a checklist the reviewer can tick.
     If something only the user can decide is unclear (legal, money, accounts, scope), list it under
     **Câu hỏi cho người dùng** instead of guessing.
5. Save the plan to a temporary file **outside the repository** and post it:
   - existing issue: `gh issue comment <n> --body-file <file>` and `gh issue edit <n> --add-label plan`
   - new task: `gh issue create --title "<short title>" --label plan --body-file <file>`
6. Reply with a short Vietnamese summary and the issue link, and remind the user:
   "Đọc kế hoạch, nếu đồng ý thì gắn nhãn `approved` cho issue rồi chạy `/sl-implement <số issue>`
   trên máy Builder."
