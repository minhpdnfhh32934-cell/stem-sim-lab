# Phase P2b report — run history in IndexedDB

Date: 2026-10-25 · Branch: `main` · Location: `C:\Users\ADMIN\Desktop\SimLab 3D` · Committed as phase p2b.

**Verdict: PASS WITH LIMITATIONS** — every acceptance criterion is met and tested, and the full e2e
run is green. Not verified: IndexedDB in private browsing, a blocked upgrade across tabs, and a
real GPU (§10).

## 1. Baseline

- HEAD `5117e5b` (phase p2), clean tree, not pushed.
- `npm run check` PASS 430/430.
- `npm run build` PASS (JS 931.49 kB, CSS 17.45 kB).
- No full e2e run on the baseline in this phase. The last one (P2) had environment timeouts,
  classified there.

## 2. Architecture audit (before the change)

```
RUN ─► ExperimentSession.start → ExperimentRuntime "<station>#<n>" (n: the session's counter)
ends (advance: completed/failed · stop · reset while running) ─► ExperimentSession.keep()
     → recordRun(): frozen RunRecord (copies of inputs, theory value, results, samples) into
       session.records (oldest first, at most RUN_HISTORY_LIMIT = 20)
     → StationSystem.view() → ResultsPanel: run list · view · compare · CSV (read records only)
New game / Continue / Back to the main menu ─► Game.forgetExperiments() → ExperimentSystem.clear()
     (sessions and their histories dropped; a running run reset)
```

- History owner: `ExperimentSession.records`, one per station, created on first use by
  `ExperimentSystem.session()`.
- Ordering: the run's `sequence` (its number at the station). There is no timestamp, and none
  was added.
- Identity: `runId` = `<station>#<n>`. The counter restarted at 1 in every new session, so ids
  could not be kept across visits as they were: §3.

## 3. Design

```
IndexedDB "simlab.history" (RUN_HISTORY_VERSION 1, unrelated to SAVE_VERSION 2)
└── object store "runs", keyPath "runId", no index
    └── StoredRun: runId, sessionId, sequence, experimentId, status, endReason|null,
        error|null, time, inputs, results|null, theory|null,
        sampleTimes: Float64Array, sampleValues: Float64Array[], sampleCount
```

- **One boundary.**
  - `src/persistence/runHistory.ts` holds the `RunHistoryStore` port (`load`, `put`, `delete`),
    the plain format with its Zod check, the conversions, and `MemoryRunHistoryStore` for tests.
  - `src/platform/runHistoryDb.ts` is the only code that touches `indexedDB`. It opens once, on
    first use, and shares the connection. `onblocked` and `onerror` reject, and
    `onversionchange` closes the connection.
- **RunRecord is unchanged.**
  - The stored form drops what cannot be stored: the definition is kept by its id, and the theory
    closure by its kept value. Loading rebuilds the same frozen record.
  - IndexedDB stores copies, so a stored record and the record in memory share nothing.
- **Stable ids.** `ExperimentSession` takes its station's kept records and continues numbering
  after the highest one, so a run id is never reused.
- **Duplicates.** `put` with the `runId` key replaces any existing entry. Loading writes nothing
  back.
- **Limit.** `RunRecorded` carries the record pushed out by the 21st run, and that record is
  deleted from the store.

## 4. Data flow

```
run ends → frozen RunRecord → session history (memory)
        → ExperimentSystem publishes RunRecorded → Game.keepRun → store.put (+ delete dropped)
                                                     └─ failure → RunHistoryFailed → HUD notice

boot     → Game.loadRunHistory → store.load → validate each → ExperimentSystem.restore
Continue → progression from localStorage (unchanged) · history already in memory from boot
```

What is written:

- Only ended runs: completed, stopped and failed, the existing RunRecord semantics. One write per
  run, never per frame or sample.
- A run still running when the player goes back to the main menu, starts a new game or closes the
  page ends unrecorded. `clear()` publishes nothing, so nothing is written for it.

## 5. Failure isolation

`Game.keepRun` is fire-and-forget behind `Promise.resolve().then(...)` with a `.catch`. A synchronous
throw, a rejection or a failed open is reported, never rethrown, and the save never waits on it.
`Game.loadRunHistory` catches as well: the game boots with an empty history.

Proven by tests:

- **Unit** (`src/game/runHistory.test.ts`): a store whose `put` rejects, one whose `put` throws,
  and one that cannot be read. In each case `RunHistoryFailed` is published, the run stays listed,
  the completion `free-fall` is in the save storage, and `game.save()` succeeds. Boot with an
  unreadable store, then Continue, loads the save and its completion.
- **E2E** (`e2e/run-history.spec.ts`, test 2): `IDBObjectStore.prototype.put` throws
  `QuotaExceededError`, and a projectile run ends.
  - The HUD shows "The run history could not be kept (The quota has been exceeded.)".
  - The save in localStorage already lists `projectile-motion`, before any reload.
  - After a reload, Continue shows `Completed: projectile-motion`.
  - The monitor refuses with "No results yet": the run was not kept, and nothing pretends it was.

## 6. New game, Continue, Back to the main menu

- The run history belongs to the browser, like the language setting, not to a playthrough. New
  game, Continue and Back to the main menu keep the ended runs. In memory, `clear()` keeps each
  station's records; in the store nothing is deleted.
- A run still running is ended unrecorded, as before. The Back to the main menu confirmation now
  counts only those runs: "The N run(s) still running are not…". It used to count every run of
  the session.
- This changes earlier behaviour on purpose. The texts that said history was not saved were
  updated in English and Vietnamese: the run list's note and the confirmation.
- Tests that asserted the old behaviour were updated to the new one:
  - `results-view.spec`: the kept run opens after a reload.
  - `measurement.spec`: after a reload the new run is #3, under #2 and #1.
  - `pause.spec`: the confirmation text.
  - `StationHistory.test`: Continue with the same store brings the runs back, with an empty store
    none.

## 7. Tests

| Command                                              | Result                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`                                      | **PASS** 441/441, 39 files                                                           |
| `npm run build`                                      | **PASS**                                                                             |
| `npx vitest run src/game/runHistory.test.ts`         | **PASS** 11/11                                                                       |
| `npx playwright test run-history.spec --project=dev` | 2 tests, each passed in its own targeted run (not both together after the last edit) |
| `npm run test:e2e`                                   | **PASS** 42/42, 3 workers, no retry (7.9 min)                                        |
| `git diff --check`                                   | clean                                                                                |

- **Unit** (11 tests):
  - round trip: plain data stored, the same frozen record back after a new boot, the same id, and
    the next run is #2;
  - duplicate `put` keeps one entry, and a stored record does not change with later runs or dials;
  - limit: 21 runs leave 20, and #1 is deleted;
  - STOP is kept as stopped, and not completed;
  - Back to the main menu and New game keep ended runs, and a running run is not recorded;
  - invalid, orphaned and junk values are skipped and logged, the rest are loaded;
  - record round trip without the game;
  - isolation: 3 failure modes, plus boot with an unreadable store.
- **E2E** (`run-history.spec.ts`), test 1:
  - two projectile runs are in the database (version 1, store `runs`, keyPath `runId`);
  - the save has no run data and stays under 10 000 characters;
  - after a reload and Continue, both are listed once, newest first, and loading wrote nothing
    back;
  - compared, each with its own measured and theory range;
  - run 1's CSV is byte-identical to the file it gave before the reload;
  - a new run is #3;
  - after New game the database still holds #1–#3.
- **E2E**, test 2: §5.
- The New game check reads the database. Seeing the runs in the game after New game needs the
  cleanroom entry, so it is covered by the unit test instead.
- During the work, two full runs were spoiled by the environment, not by the code. These are not
  counted as results:
  - one was stopped because I edited a source file while the dev server was serving the tests;
  - the next lost its reused dev server midway (`ERR_CONNECTION_REFUSED` on 5199).
- The reported run started from free ports.
- All numbers are from headless Edge with SwiftShader (software WebGL). No GPU validation is
  claimed.

## 8. Bundle

| Asset | Before    | After     | Delta    |
| ----- | --------- | --------- | -------- |
| JS    | 931.49 kB | 936.66 kB | +5.17 kB |
| CSS   | 17.45 kB  | 17.45 kB  | 0        |

No dependency was added: native IndexedDB and the existing Zod are enough. The 1,000,000-byte
budget in `production.spec` passes.

## 9. Files

- **New:**
  - `src/persistence/runHistory.ts`
  - `src/platform/runHistoryDb.ts`
  - `src/game/runHistory.test.ts`
  - `e2e/run-history.spec.ts`
  - this report
- **Changed:**
  - `ExperimentSession` (kept records, numbering), `ExperimentSystem` (`restore`, `clear` keeps
    history, `RunRecorded`; `runCount` removed);
  - `Game` (store option, load at boot, `keepRun`), `GameEvents`, `main.ts`;
  - `Hud` (failure notice), `PauseMenu` (counts running runs), `ResultsPanel` (note),
    `strings.json`;
  - three e2e specs and two unit tests;
  - `docs/persistence.md`, `experiments.md`, `architecture.md`, `interaction.md`, and the
    `CLAUDE.md` rule on history.

## 10. Limitations

- IndexedDB in private browsing and with storage disabled is unverified in a real browser.
  These cases go through the same rejection path the tests inject.
- An upgrade blocked by an older tab (`onblocked`) is handled in code but not exercised (there is
  only version 1).
- A failure to open is remembered for the page, so every later run reports again until a reload.
- History load happens once at boot, before the menu. A very slow IndexedDB would delay the menu.
  There is no timeout.
- Runs not kept because of a failure are lost on reload (stated in the HUD notice). They are not
  backed up in localStorage.
- No live GPU check.

## 11. Git

- Base `5117e5b`; committed as phase p2b, not pushed.
- `git status --short`: 19 modified and 5 new files (this report included).
- `git diff --check`: clean.
- `git diff --stat`: 19 files, +251 −61, not counting new files.
