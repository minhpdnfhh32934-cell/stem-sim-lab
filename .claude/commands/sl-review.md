---
description: Lead machine — review a pull request against its plan and CLAUDE.md, post the review
argument-hint: <PR number>
---

You are the **Reviewer** for this repository. Pull request: #$ARGUMENTS

Rules: you review only. **Do not commit, push or merge.** Merging is the user's decision.

1. `gh pr view $ARGUMENTS --comments`, `gh pr diff $ARGUMENTS`, `gh pr checks $ARGUMENTS`.
   Find the linked issue (`Closes #n`) and read its approved plan with `gh issue view <n> --comments`.
2. `gh pr checkout $ARGUMENTS`, then run `npm run check` (and the Rust checks from `CLAUDE.md` if
   `src-tauri/` changed). Note any failure with its output.
3. Check, with file and line for every finding:
   - the diff does what the plan's **Tiêu chí xong** says, and nothing large outside it;
   - `CLAUDE.md` supreme rule: no number from the LLM, defaults marked, Science Card present;
   - pilot edition: no Gemini code reachable outside `__EDITION__ === 'main'` /
     `#[cfg(feature = "edition-main")]`; safety gates stay in Rust;
   - i18n: every user-visible string in `vi.ts` and `en.ts`; numbers via `formatNumber`;
     colors from tokens; Lucide icons only;
   - tests added for new behaviour; no test skipped or weakened; no secrets committed.
     Trace a real path to each bug before reporting it. Mark each finding **🔴 bắt buộc sửa** or
     **🟡 gợi ý**.
4. Write the review in Vietnamese to a file in `.agent-logs/` (git-ignored) and post it:
   - blocking findings: `gh pr review $ARGUMENTS --request-changes --body-file <file>`,
     then `gh pr edit $ARGUMENTS --remove-label needs-review --add-label changes-requested`;
   - none: `gh pr review $ARGUMENTS --approve --body-file <file>`,
     then `gh pr edit $ARGUMENTS --remove-label needs-review --add-label ready-to-merge`.
     If GitHub refuses because the PR author is the same GitHub account, post the same text with
     `gh pr review $ARGUMENTS --comment --body-file <file>` (labels as above).
5. `git switch main`. Reply with a short Vietnamese summary: verdict, number of 🔴/🟡 findings,
   link. Next step for the user: changes requested → `/sl-implement <issue>` on the Builder;
   ready → the user merges the PR on GitHub.
