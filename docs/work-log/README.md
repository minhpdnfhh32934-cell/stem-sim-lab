# Work log

Short records of the important milestones of a piece of work, so a later session can continue
without rereading the whole conversation. The log is a guide, not the source of truth: always
compare it with `git status`, the source and fresh test results.

## Files

- One file per step: `YYYY-MM-DD-<ID>.md` (for example `2026-10-19-S1-core-physics.md`).
- Add a new file (or a new dated section at the end of an existing one) instead of rewriting
  history. Correct a wrong record with a new note that says what was wrong.

## Statuses

| Status        | Meaning                                                     |
| ------------- | ----------------------------------------------------------- |
| `PLANNED`     | Agreed scope, nothing changed yet.                          |
| `IN_PROGRESS` | Work started; the record says what is done and what is not. |
| `PASS`        | Done and the listed checks were actually run and passed.    |
| `FAIL`        | Checks were run and failed; the record lists the failures.  |
| `BLOCKED`     | Needs a decision, access or a fix outside the step's scope. |
| `SKIPPED`     | Deliberately not done; the record says why.                 |

## Record format

```
# <ID> — <short title>

- **Goal:** …
- **Date/time:** real time from the machine (`date`), with time zone
- **Status:** PASS | FAIL | BLOCKED | …
- **Branch / base:** …

## Files
## Key decisions
## Commands run (real results, summary lines only)
## Tests
## Errors and fixes
## Evidence
## Next steps and limits
```

Rules: no chain-of-thought, no secrets (keys, tokens, passwords, personal data), no invented
times, tests, commits or results. Keep only summaries and the errors that mattered.

## How to resume

1. Read the newest record here and `docs/PROGRESS.md`.
2. Run `git status` and `git diff --cached --stat`: staged files are finished checkpoints,
   unstaged/untracked files are work in progress.
3. Re-run the targeted tests named in the newest record before continuing.
4. Continue with its "Next steps"; add a new record when the next milestone is reached.
