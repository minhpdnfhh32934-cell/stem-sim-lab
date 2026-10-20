---
name: simlab-token-guard
description: Token and time discipline for STEM Sim Lab work. Use at the start of any task in this repository and whenever a task grows (many files to read, repeated test runs, a fix that keeps failing, or the idea of calling subagents) to keep reading, tool output, tests and agents proportional to the goal and to know when to stop.
---

# SimLab token guard

## Before each stage

Name the goal, the files to read, the result to produce, the tests to run and the "done"
condition. Skip anything that does not serve them.

| Size      | Example                              | Approach                                             |
| --------- | ------------------------------------ | ---------------------------------------------------- |
| SMALL     | one clear fix                        | do it directly, no agent                             |
| MEDIUM    | one feature, a few modules           | short plan, targeted tests                           |
| LARGE     | many modules, architecture           | stages, progress saved in `docs/work-log/`           |
| HIGH-RISK | security, data, hard-to-undo changes | full checks first; ask the user where CLAUDE.md says |

## Reading and output

- Read by range: `Grep` with a path/glob and `head_limit`, then `Read` with `offset`/`limit`.
  Never scan the whole source tree "to get a feel".
- Do not re-read a file or the history while what you know is still reliable.
- Keep tool output short: filter tests to failures plus the summary line
  (`npx vitest run <files> 2>&1 | tail -n 15`, Playwright `--reporter=line | grep -v "^\s*at "`).

## Tests

- After a small change run only the tests of its scope; run wider suites at the end of a step
  or before a release, not after every edit.
- Do not re-run a test that passed when its source, config and environment are unchanged.

## Fix loops and stopping

- Never repeat the same fix without new evidence. After two attempts with no progress, restate
  the hypothesis from the evidence.
- At most three fix/test rounds for one problem in a session; then stop and report what was
  tried, what failed and what is known.
- Stop when the acceptance criteria are met and the related tests have run, when nothing in
  scope is left, when only the user can decide, or when cost outweighs the expected benefit.
  Do not add features because tokens remain.

## Agents

- Call a subagent only when its benefit beats the coordination cost; never for small tasks.
- Run agents in parallel only for independent work, never two on the same file or region.
- Give each a scope, inputs and the output shape (conclusion, evidence, risks, next action);
  do not ask for its whole process back. Do not assume a subagent is cheaper.

## Session hygiene

- Write a short record in `docs/work-log/` at milestones so a later session can resume.
- Never run `/clear`, delete history or change the session state on your own; when context is
  large, save progress in the work log and tell the user how to continue.
- Never claim a token saving without a measured comparison.
