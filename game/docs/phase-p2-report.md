# Phase P2 report — persistence and progression hardening

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Not committed.

**Verdict: PASS WITH LIMITATIONS**: run history is not persisted (§7), no single full e2e run was
green on this machine (§8), and there was no live GPU check.

## 1. Baseline

HEAD `3d182f7` (phase p1), clean tree. `npm run check` PASS 423/423; `npm run build` PASS (JS
930.86 kB, CSS 17.45 kB). The first full `npm run test:e2e` on the baseline failed
`experiment.spec:184`: the station stayed "configured" because RUN was never read. Cause: `use()` in
`e2e/support.ts` pressed E and returned; the next `Aim.to` freed the mouse, which pauses (P1), and
pausing drops held input (`input.reset()`). At 3–5 FPS the press was dropped before a game frame
had read it. A second hypothesis (a late `pointerlockchange` after the click) was probed and did
not reproduce (0/20), so it was not "fixed".

## 2. What changed

| File                                | Change                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `src/game/GameEvents.ts`            | `ProgressionRecorded { experimentId }`, `SaveFailed { slot, reason }`                 |
| `src/gameplay/ProgressionSystem.ts` | publishes `ProgressionRecorded` when it records a completion for the first time       |
| `src/game/Game.ts`                  | saves on `ProgressionRecorded`                                                        |
| `src/persistence/SaveSystem.ts`     | publishes `SaveFailed` when storage refuses a write (the result is still `fail(...)`) |
| `src/platform/ui/Hud.ts`            | an error notice on `SaveFailed`; `strings.json` holds its Vietnamese                  |
| `e2e/support.ts`                    | `use()` waits one game frame after pressing E (the dropped-press race of §1)          |
| `src/game/progress.test.ts` (new)   | 7 unit tests (§8)                                                                     |
| `e2e/progress.spec.ts` (new)        | 3 e2e tests (§8)                                                                      |
| `docs/persistence.md`, this report  | when it saves, failed saves, the history decision                                     |

## 3. Persistence design

- A completion is saved **when it happens**: `ProgressionSystem` records it (only `endReason
'model'`, only once), publishes `ProgressionRecorded`, and `Game` calls `save()`. That is one
  more autosave boundary next to the existing ones: world `SceneLoaded`, Back to the main menu,
  `pagehide`. Gameplay does not know about saving; the composition root wires it.
- `Game.save()` writes only while playing (unchanged). A completion always happens while playing,
  because a paused run takes no step (P1).
- **A failed save** (storage full or blocked) publishes `SaveFailed`. The HUD shows an error notice
  saying that progress is kept for now and will be saved at the next door, on Back to the main
  menu, or when you leave. The completion stays in memory and is not claimed as saved. The next
  save point writes it (unit-tested). Back to the main menu already asks before leaving after a
  failed save (P1).

## 4. Save schema

Unchanged: `SAVE_VERSION` 2, no migration. P2 adds no field; it only adds when a save happens.
Version-1 saves still upgrade and keep their completions, and a save that is missing its
progression is refused with a reason (both unit-tested).

## 5. Completion semantics

| How the run ends                            | `ExperimentCompleted` | Recorded | Saved as completed      |
| ------------------------------------------- | --------------------- | -------- | ----------------------- |
| By itself (`endReason 'model'`)             | yes                   | yes      | yes, at once            |
| Time limit (`'time-limit'`)                 | yes                   | no       | no                      |
| STOP                                        | no (status `stopped`) | no       | no                      |
| Left running: pause, Back to the main menu  | no                    | no       | no (the run is dropped) |
| A second natural end of the same experiment | yes                   | no       | no new save             |

## 6. Continue and reload

The e2e tests read `localStorage` directly, before any reload, and then reload:

- A natural end is in storage at once.
- After a reload, the catalog shows "Run completed" and Continue shows `Completed: hookes-law`.
- A stopped run is not completed, before or after a reload.
- A run left for the main menu is not completed. Continue brings back the station configured, with
  no run.

## 7. History (RunRecord): not persisted

Measured JSON size of one record (inputs, theory, results and samples):

| Run                          | Size              |
| ---------------------------- | ----------------- |
| Free fall                    | 4 KiB             |
| Projectile                   | 13 KiB            |
| Pendulum (default / long)    | 106 KiB / 467 KiB |
| Hooke's law (default / long) | 111 KiB / 288 KiB |

- With 20 records per station, history would be 2–9 MiB, and `SaveSystem` writes the slot and a
  backup. localStorage holds about 5 M characters per origin.
- In the save slot, history would make saves fail on quota, and the failure would take the
  progression save down with it. That is the opposite of this phase's goal.
- Records also hold a `theory()` closure that JSON cannot carry; it would have to be rebuilt from
  the definition.
- History therefore stays runtime-only, as documented. The proposal is a separate store
  (IndexedDB), versioned on its own and never able to block the progression save. That is a
  decision for you (P2b).

## 8. Tests

| Command                                                                                  | Result                                                     |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run check`                                                                          | **PASS** 430/430                                           |
| `npm run build`                                                                          | **PASS**                                                   |
| `npx playwright test progress.spec --project=dev`                                        | **PASS** 3/3                                               |
| `npm run test:e2e` (3 workers)                                                           | **FAIL** 33 passed, 3 failed, 4 did not run (15.5 min)     |
| `npx playwright test history.spec:152 history.spec:394 results-view.spec:83 --workers=1` | **PASS** 3/3                                               |
| `npx playwright test --project=dev-timed --no-deps`                                      | 3 passed, grab failed once; `grab.spec` alone **PASS** 1/1 |
| `npx playwright test grab.spec --project=dev-timed --no-deps --repeat-each=3`            | **FAIL** 2 passed, 1 failed                                |
| `git diff --check`                                                                       | clean                                                      |

- **Unit tests** (`progress.test.ts`, 7): all on top of the real game boot and real experiment runs.
  - A natural end is recorded once and in storage at once, and a repeat records nothing.
  - A time-limit end is not recorded and nothing is saved.
  - A STOP is completed neither in memory nor in storage.
  - A paused run never completes.
  - A failed save publishes `SaveFailed`, keeps the completion and writes it at the next save.
  - A v1 save upgrades and keeps its completions.
  - A save missing its progression is refused.
  - Without the new subscription in `Game`, 2 of them fail (checked).
- **E2E** (`progress.spec.ts`, 3): §6. No timeout or retry was raised. The three `setTimeout`s in
  the new spec are for its own Hooke runs.
- **Full e2e failures**, classified:
  - The 3 pendulum tests timed out at the 300 s test limit, with their runs still advancing at
    3–5 FPS (3 browsers on a CPU throttled by the "Silent" power scheme). They pass one at a time.
    This is the environment, not the code.
  - `grab.spec:160` failed once in 3 repeats. Distance from spawn was 0.225 instead of more than
    0.3. The spec has its own `Aim` and imports nothing from `support.ts`, and P2 changes no grab
    or physics code.
  - The grab failure is the test's geometry: the 0.3 m check measures 3-D distance. The held ball
    passes it partly through height, and once the ball is dropped only the horizontal part is
    left, which depends on how far the turn got at low FPS. This was not fixed (out of scope).
- All numbers are from headless Edge on SwiftShader (software WebGL). No GPU validation is claimed.

## 9. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 930.86 kB | 931.49 kB | +0.63 kB |
| CSS   | 17.45 kB  | 17.45 kB  | 0        |

## 10. Limitations

- Run history is still lost on reload or Back to the main menu (§7, needs its own store).
- No single full e2e run was green on this machine under load. Every failing test passes when run
  on its own.
- `grab.spec`'s 3-D distance check is flaky at low FPS. This is pre-existing and was not fixed.
- The `SaveFailed` notice was checked by unit tests; it was never seen with a real full
  localStorage in a browser.
- No live GPU check.

## 11. Git

Not committed, not pushed.

- `git diff --stat`: 8 files changed, 50 insertions(+), 3 deletions(-).
- New files: `src/game/progress.test.ts`, `e2e/progress.spec.ts`, this report.
- `git diff --check`: clean.
