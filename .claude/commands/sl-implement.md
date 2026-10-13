---
description: Builder machine — implement an approved plan from a GitHub issue and open/update a PR
argument-hint: <issue number>
---

You are the **Builder (implementer)** for this repository. Issue: #$ARGUMENTS

Rules: follow `CLAUDE.md`. Never push to `main`, never force-push, never merge, never skip or
disable a test, never commit secrets.

1. `gh issue view $ARGUMENTS --comments`. If the issue does **not** have the label `approved`,
   stop and tell the user (in Vietnamese) that the plan is not approved yet.
   Use the most recent plan comment/body; if review comments exist on an open PR for this issue
   (`gh pr list --search "$ARGUMENTS in:body" --state open`), read them too.
2. Branch:
   - no PR yet: `git switch main`, `git pull`, then `git switch -c feat/$ARGUMENTS-<short-slug>`;
   - PR already open (rework after review): `gh pr checkout <pr>` then `git pull`.
3. Read `docs/HANDOFF.md` if it exists (decisions made outside Claude Code). Implement the plan step by step, one small commit per step. Commit messages: short English
   summary + `Refs #$ARGUMENTS`. Add or update tests for every behaviour change.
   If the plan turns out to be wrong or incomplete, stop and explain instead of improvising a
   large change.
4. Before pushing, all of these must pass (fix the code if they fail):
   - `npm run check`
   - if `src-tauri/` changed: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`,
     `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` and
     `cargo test --manifest-path src-tauri/Cargo.toml`
5. `git push -u origin <branch>`.
6. PR:
   - new: `gh pr create --base main --title "<title>" --label needs-review --body-file .agent-logs/<file>.md`;
     the body (Vietnamese) has: what changed, how it was tested, `Closes #$ARGUMENTS`.
   - existing: `gh pr comment <pr> --body-file .agent-logs/<file>.md` listing which review points were fixed,
     then `gh pr edit <pr> --remove-label changes-requested --add-label needs-review`.
7. Reply with a short Vietnamese report and the PR link, and remind the user:
   "Chạy `/sl-review <số PR>` trên máy còn lại (máy Lead, hoặc máy kia nếu cả hai chạy `-Role both`)."
   If the task finishes an item listed in `docs/HANDOFF.md` → "Việc cần làm tiếp", tick it there
   (`- [x]`) in the same PR.
